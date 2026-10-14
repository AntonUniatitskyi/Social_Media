from channels.generic.websocket import WebsocketConsumer
from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string
from asgiref.sync import async_to_sync
import json

from channels.generic.websocket import JsonWebsocketConsumer

from .models import ChatGroup, GroupMessage
from .services import broadcast_message

MAX_BODY = 400


class ChatroomConsumer(WebsocketConsumer):
    def connect(self):
        self.user = self.scope['user']
        self.chatroom_name = self.scope['url_route']['kwargs']['chatroom_name']
        self.chatroom = get_object_or_404(ChatGroup, group_name=self.chatroom_name)
        async_to_sync(self.channel_layer.group_add)(
            self.chatroom_name, self.channel_name
        )

        # Юзери онлайн
        if self.user not in self.chatroom.users_online.all():
            self.chatroom.users_online.add(self.user)
            self.update_online_count()

        self.accept()

    def disconnect(self, close_code):
        async_to_sync(self.channel_layer.group_discard)(
            self.chatroom_name, self.channel_name
        )

        # Юзери онлайн
        if self.user in self.chatroom.users_online.all():
            self.chatroom.users_online.remove(self.user)
            self.update_online_count()

    def receive(self, text_data=None):
        text_data_json = json.loads(text_data)
        body = text_data_json['body']

        message = GroupMessage.objects.create(
            body = body,
            author = self.user,
            group = self.chatroom
        )

        event = {
            'type': 'message_handler',
            'message_id': message.id
        }

        async_to_sync(self.channel_layer.group_send)(
            self.chatroom_name, event
        )

    def message_handler(self, event):
        message_id = event['message_id']
        message = GroupMessage.objects.get(id=message_id)
        context = {
            'message': message,
            'user': self.user
        }

        html = render_to_string('chat/partials/chat_message.html', context=context)
        self.send(text_data=html)

    def update_online_count(self):
        online_count = self.chatroom.users_online.count() -1

        event = {
            'type': 'online_count_handler',
            'online_count': online_count
        }
        async_to_sync(self.channel_layer.group_send)(self.chatroom_name, event)

    
    def online_count_handler(self, event):
        online_count = event['online_count']
        context = {
            'online_count': online_count,
            'chat_group': self.chatroom
        }
        html = render_to_string("chat/partials/online_count.html", context)
        self.send(text_data=html)


class ChatConsumer(JsonWebsocketConsumer):
    group = None

    @classmethod
    def decode_json(cls, text_data):
        try:
            return json.loads(text_data)
        except ValueError:
            return None

    def connect(self):
        self.user = self.scope["user"]
        self.accept()
        if not self.user.is_authenticated:
            return self.close(code=4401)
        name = self.scope["url_route"]["kwargs"]["group_name"]
        self.chat = ChatGroup.objects.filter(group_name=name, members=self.user).first()
        if self.chat is None:
            return self.close(code=4404)

        self.group = f"chat.{self.chat.pk}"
        async_to_sync(self.channel_layer.group_add)(self.group, self.channel_name)
        self.chat.users_online.add(self.user)
        self.broadcast_presence()

    def disconnect(self, code):
        if self.group is None:
            return
        async_to_sync(self.channel_layer.group_discard)(self.group, self.channel_name)
        self.chat.users_online.remove(self.user)
        self.broadcast_presence()

    def receive_json(self, content, **kwargs):
        if not isinstance(content, dict):
            return self.error("Невірний формат.")
        kind = content.get("type")

        if kind == "ping":
            return self.send_json({"type": "pong"})

        if kind == "message":
            body = content.get("body")
            if not isinstance(body, str) or not body.strip():
                return self.error("Повідомлення не може бути порожнім.")
            if len(body) > MAX_BODY:
                return self.error(f"Максимум {MAX_BODY} символів.")
            if not self.chat.members.filter(pk=self.user.pk).exists():
                return self.close(code=4403)
            message = GroupMessage.objects.create(
                body=body.strip(), author=self.user, group=self.chat
            )
            return broadcast_message(message)

        self.error("Невідомий тип повідомлення.")

    def error(self, detail):
        self.send_json({"type": "error", "detail": detail})

    def chat_message(self, event):
        self.send_json({"type": "message", "message": event["message"]})

    def chat_presence(self, event):
        self.send_json({"type": "presence", "online": event["online"]})

    def chat_kick(self, event):
        if event["user_id"] == self.user.id:
            self.send_json({"type": "kicked"})
            self.close(code=4403)

    def broadcast_presence(self):
        online = list(self.chat.users_online.values_list("id", flat=True))
        async_to_sync(self.channel_layer.group_send)(
            self.group, {"type": "chat.presence", "online": online}
        )