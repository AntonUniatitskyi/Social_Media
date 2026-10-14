import json
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from rest_framework.renderers import JSONRenderer


def broadcast_message(message):
    from chat.api.serializers import MessageSerializer
    data = json.loads(
        JSONRenderer().render(MessageSerializer(message, context={"request": None}).data)
    )
    send = async_to_sync(get_channel_layer().group_send)
    send(f"chat.{message.group_id}", {"type": "chat.message", "message": data})
    try:
        send(message.group.group_name, {"type": "message_handler", "message_id": message.id})
    except ValueError:
        pass


def kick_from_chat(chat_pk, user_id):
    async_to_sync(get_channel_layer().group_send)(
        f"chat.{chat_pk}", {"type": "chat.kick", "user_id": user_id}
    )