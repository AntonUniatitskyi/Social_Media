import json

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from rest_framework.renderers import JSONRenderer
from django.contrib.auth.models import User
from django.db import transaction
from . import presence
from .models import ChatGroup


def _send():
    return async_to_sync(get_channel_layer().group_send)


def push_inbox(user_ids, group_name=None):
    send = _send()
    for uid in set(user_ids):
        send(f"user.{uid}", {"type": "user.inbox", "group_name": group_name})


def broadcast_message(message):
    from chat.api.serializers import MessageSerializer

    data = json.loads(JSONRenderer().render(MessageSerializer(message, context={"request": None}).data))
    chat = message.group
    _send()(f"chat.{chat.pk}", {"type": "chat.message", "message": data})

    if not chat.is_public:
        member_ids = list(chat.members.values_list("id", flat=True))
        push_inbox(presence.online_among(member_ids), chat.group_name)

    try:
        _send()(chat.group_name, {"type": "message_handler", "message_id": message.id})
    except ValueError:
        pass


def kick_from_chat(chat_pk, user_id):
    _send()(f"chat.{chat_pk}", {"type": "chat.kick", "user_id": user_id})


def notify_presence_change(user_id):
    send = _send()
    for pk in ChatGroup.objects.filter(is_public=False, members=user_id).values_list("pk", flat=True):
        send(f"chat.{pk}", {"type": "chat.presence_change"})


@transaction.atomic
def get_favorites(user):
    User.objects.select_for_update().get(pk=user.pk)
    chat = ChatGroup.objects.filter(is_favorites=True, members=user).order_by("id").first()
    if chat:
        return chat, False
    chat = ChatGroup.objects.create(is_private=True, is_favorites=True, group_chat_name="Вибране")
    chat.members.add(user)
    return chat, True

def broadcast_deleted(chat_pk, message_id):
    _send()(f"chat.{chat_pk}", {"type": "chat.message_deleted", "id": message_id})