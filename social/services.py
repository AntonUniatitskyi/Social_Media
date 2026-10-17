# social/services.py
from io import BytesIO
from django.core.files.base import ContentFile
from PIL import Image
from .models import Notification, MediaItem

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction

from chat import presence

def _push_notification(user_ids):
    online = presence.online_among(user_ids)               # тем, кто офлайн, сигнал не нужен
    if not online:
        return
    send = async_to_sync(get_channel_layer().group_send)
    for uid in online:
        send(f"user.{uid}", {"type": "user.notification"})

def notify(recipient, sender, message, kind=Notification.Kind.OTHER, publication=None):
    if recipient != sender:
        Notification.objects.create(
            recipient=recipient, sender=sender, message=message, kind=kind, publication=publication
        )
        transaction.on_commit(lambda: _push_notification([recipient.id]))

def crop_to_aspect_ratio(image, target_ratio=(4, 3)):
    if image.mode in ('RGBA', 'LA'):
        image = image.convert('RGB')
    img_width, img_height = image.size
    target_w, target_h = target_ratio
    target_ratio_float = target_w / target_h
    current_ratio = img_width / img_height

    if current_ratio > target_ratio_float:
        # ширина надлишкова — обрізати по ширині
        new_width = int(img_height * target_ratio_float)
        offset = (img_width - new_width) // 2
        box = (offset, 0, offset + new_width, img_height)
    else:
        # висота надлишкова — обрізати по висоті
        new_height = int(img_width / target_ratio_float)
        offset = (img_height - new_height) // 2
        box = (0, offset, img_width, offset + new_height)

    return image.crop(box)

def attach_media(publication, files):
    for f in files:
        if f.content_type.startswith("image/"):
            with Image.open(f) as img:
                fmt = img.format or "JPEG"
                img = crop_to_aspect_ratio(img)
                buf = BytesIO()
                img.save(buf, format=fmt)
            MediaItem.objects.create(publication=publication,
                                     file=ContentFile(buf.getvalue(), name=f.name))
        else:
            MediaItem.objects.create(publication=publication, file=f)

def notify_many(recipients, sender, message, kind=Notification.Kind.OTHER, publication=None):
    users = [r for r in recipients if r != sender]
    Notification.objects.bulk_create([
        Notification(recipient=r, sender=sender, message=message, kind=kind, publication=publication)
        for r in users
    ])
    ids = [u.id for u in users]
    transaction.on_commit(lambda: _push_notification(ids))