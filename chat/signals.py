from django.db.models import Max
from django.db.models.signals import m2m_changed
from django.dispatch import receiver

from .models import ChatGroup, ChatRead, GroupMessage


@receiver(m2m_changed, sender=ChatGroup.members.through)
def sync_reads(sender, instance, action, reverse, pk_set, **kwargs):
    if not pk_set:
        return
    if action == "post_add":
        pairs = [(pk, instance.pk) for pk in pk_set] if reverse else [(instance.pk, uid) for uid in pk_set]
        for chat_id, user_id in pairs:                # новый участник не получает «непрочитанным» всю историю
            last = GroupMessage.objects.filter(group_id=chat_id).aggregate(m=Max("id"))["m"] or 0
            ChatRead.objects.get_or_create(chat_id=chat_id, user_id=user_id, defaults={"last_read_id": last})
    elif action == "post_remove":
        qs = ChatRead.objects.filter(user=instance, chat_id__in=pk_set) if reverse \
            else ChatRead.objects.filter(chat=instance, user_id__in=pk_set)
        qs.delete()