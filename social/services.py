# social/services.py
from io import BytesIO
from django.core.files.base import ContentFile
from PIL import Image
from .models import Notification, MediaItem

def notify(recipient, sender, message, kind=Notification.Kind.OTHER, publication=None):
    if recipient != sender:
        Notification.objects.create(
            recipient=recipient, sender=sender, message=message, kind=kind, publication=publication
        )

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
    Notification.objects.bulk_create([
        Notification(recipient=r, sender=sender, message=message, kind=kind, publication=publication)
        for r in recipients if r != sender
    ])