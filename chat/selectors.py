from django.db.models import BigIntegerField, Case, Count, Exists, IntegerField, OuterRef, Q, Subquery, Value, When
from django.db.models.functions import Coalesce

from .models import ChatGroup, ChatRead, GroupMessage


def visible_chats(user):
    mine = ChatGroup.members.through.objects.filter(chatgroup_id=OuterRef("pk"), user_id=user.id)
    return ChatGroup.objects.filter(Exists(mine) | Q(is_public=True))


def with_unread(qs, user):
    last_read = ChatRead.objects.filter(chat=OuterRef("pk"), user=user).values("last_read_id")[:1]
    unread = (
        GroupMessage.objects
        .filter(group=OuterRef("pk"), id__gt=OuterRef("my_last_read"))
        .exclude(author=user)
        .order_by().values("group").annotate(c=Count("id")).values("c")[:1]
    )
    return qs.annotate(
        my_last_read=Coalesce(Subquery(last_read), 0, output_field=BigIntegerField())
    ).annotate(
        unread_count=Case(
            When(is_public=True, then=Value(0)),     # у общего чата счётчика нет
            default=Coalesce(Subquery(unread, output_field=IntegerField()), 0),
            output_field=IntegerField(),
        )
    )


def unread_total(user):
    return sum(with_unread(visible_chats(user), user).values_list("unread_count", flat=True))