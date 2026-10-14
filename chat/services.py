from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def broadcast_message(message):
    async_to_sync(get_channel_layer().group_send)(
        message.group.group_name,
        {"type": "message_handler", "message_id": message.id},
    )