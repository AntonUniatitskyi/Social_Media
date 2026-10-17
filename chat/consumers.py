import json

from asgiref.sync import async_to_sync
from channels.generic.websocket import JsonWebsocketConsumer, WebsocketConsumer
from django.template.loader import render_to_string

from . import presence
from .models import ChatGroup, GroupMessage
from .selectors import visible_chats
from .services import broadcast_message, notify_presence_change

MAX_BODY = 400


# ============================================================
#  Новый JSON-протокол: /ws/v1/...
# ============================================================

class SafeJsonConsumer(JsonWebsocketConsumer):
    group = None

    @classmethod
    def decode_json(cls, text_data):
        try:
            return json.loads(text_data)
        except ValueError:
            return None

    def error(self, detail):
        self.send_json({"type": "error", "detail": detail})


class UserConsumer(SafeJsonConsumer):
    """Один сокет на открытое приложение: присутствие и сигналы «обновите список чатов»."""

    def connect(self):
        self.user = self.scope["user"]
        self.accept()
        if not self.user.is_authenticated:
            return self.close(code=4401)
        self.group = f"user.{self.user.pk}"
        async_to_sync(self.channel_layer.group_add)(self.group, self.channel_name)
        if presence.add(self.user.pk, self.channel_name):
            notify_presence_change(self.user.pk)
        self.send_json({"type": "ready"})

    def disconnect(self, code):
        if self.group is None:                       # соединение отклонено в connect()
            return
        async_to_sync(self.channel_layer.group_discard)(self.group, self.channel_name)
        if presence.remove(self.user.pk, self.channel_name):
            notify_presence_change(self.user.pk)

    def receive_json(self, content, **kwargs):
        if isinstance(content, dict) and content.get("type") == "ping":
            presence.touch(self.user.pk, self.channel_name)
            self.send_json({"type": "pong"})

    # события из channel layer
    def user_inbox(self, event):
        self.send_json({"type": "inbox", "group_name": event.get("group_name")})   # None = «обновить всё»

    def user_notification(self, event):
        self.send_json({"type": "notification"})


class ChatConsumer(SafeJsonConsumer):
    def connect(self):
        self.user = self.scope["user"]
        self.accept()
        if not self.user.is_authenticated:
            return self.close(code=4401)
        name = self.scope["url_route"]["kwargs"]["group_name"]
        chat = visible_chats(self.user).filter(group_name=name).first()
        if chat is None:
            return self.close(code=4404)
        self.chat = chat
        self.group = f"chat.{chat.pk}"
        async_to_sync(self.channel_layer.group_add)(self.group, self.channel_name)
        self.send_presence()

    def disconnect(self, code):
        if self.group is not None:
            async_to_sync(self.channel_layer.group_discard)(self.group, self.channel_name)

    def send_presence(self):
        if self.chat.is_public:
            return
        ids = list(self.chat.members.values_list("id", flat=True))
        self.send_json({"type": "presence", "online": sorted(presence.online_among(ids))})

    def receive_json(self, content, **kwargs):
        if not isinstance(content, dict):
            return self.error("Невірний формат.")
        kind = content.get("type")

        if kind == "ping":
            self.send_json({"type": "pong"})
            return self.send_presence()                 # заодно лечит устаревший статус «онлайн»

        if kind == "message":
            body = content.get("body")
            if not isinstance(body, str) or not body.strip():
                return self.error("Повідомлення не може бути порожнім.")
            if len(body) > MAX_BODY:
                return self.error(f"Максимум {MAX_BODY} символів.")
            # членство проверяется по базе на каждое сообщение: исключённый не пишет даже при потерянном событии
            if not self.chat.is_public and not self.chat.members.filter(pk=self.user.pk).exists():
                return self.close(code=4403)
            message = GroupMessage.objects.create(body=body.strip(), author=self.user, group=self.chat)
            return broadcast_message(message)

        self.error("Невідомий тип повідомлення.")

    # события из channel layer
    def chat_message(self, event):
        if message := event.get("message"):
            self.send_json({"type": "message", "message": message})

    def chat_message_deleted(self, event):
        if (mid := event.get("id")) is not None:
            self.send_json({"type": "message_deleted", "id": mid})

    def chat_presence_change(self, event):
        self.send_presence()

    def chat_kick(self, event):
        if event.get("user_id") == self.user.id:
            self.send_json({"type": "kicked"})
            self.close(code=4403)


# ============================================================
#  Старый HTMX-чат: /ws/chatroom/...  (удалить вместе со старыми шаблонами)
# ============================================================

class ChatroomConsumer(WebsocketConsumer):
    def connect(self):
        self.user = self.scope['user']
        self.chatroom_name = self.scope['url_route']['kwargs']['chatroom_name']
        self.chatroom = ChatGroup.objects.filter(group_name=self.chatroom_name).first()

        # раньше любой, даже анонимный, мог подключиться к любой комнате
        allowed = (
            self.chatroom is not None
            and self.user.is_authenticated
            and (self.chatroom.is_public or self.chatroom.members.filter(pk=self.user.pk).exists())
        )
        if not allowed:
            self.chatroom = None
            self.close()
            return

        async_to_sync(self.channel_layer.group_add)(self.chatroom_name, self.channel_name)

        # Юзери онлайн
        if self.user not in self.chatroom.users_online.all():
            self.chatroom.users_online.add(self.user)
            self.update_online_count()

        self.accept()

    def disconnect(self, close_code):
        if self.chatroom is None:                    # соединение отклонено в connect()
            return
        async_to_sync(self.channel_layer.group_discard)(self.chatroom_name, self.channel_name)

        # Юзери онлайн
        if self.user in self.chatroom.users_online.all():
            self.chatroom.users_online.remove(self.user)
            self.update_online_count()

    def receive(self, text_data=None):
        try:
            body = json.loads(text_data)['body']
        except (TypeError, ValueError, KeyError):
            return
        if not isinstance(body, str) or not body.strip() or len(body) > MAX_BODY:
            return

        message = GroupMessage.objects.create(
            body=body.strip(),
            author=self.user,
            group=self.chatroom,
        )
        async_to_sync(self.channel_layer.group_send)(
            self.chatroom_name, {'type': 'message_handler', 'message_id': message.id}
        )

    def message_handler(self, event):
        message = GroupMessage.objects.filter(id=event['message_id']).first()
        if message is None:                          # сообщение уже удалили
            return
        html = render_to_string('chat/partials/chat_message.html', context={
            'message': message,
            'user': self.user,
        })
        self.send(text_data=html)

    def update_online_count(self):
        online_count = self.chatroom.users_online.count() - 1
        async_to_sync(self.channel_layer.group_send)(
            self.chatroom_name, {'type': 'online_count_handler', 'online_count': online_count}
        )

    def online_count_handler(self, event):
        html = render_to_string("chat/partials/online_count.html", {
            'online_count': event['online_count'],
            'chat_group': self.chatroom,
        })
        self.send(text_data=html)