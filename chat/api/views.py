from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import F, OuterRef, Prefetch, Subquery
from django.shortcuts import get_object_or_404
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.pagination import CursorPagination
from rest_framework.response import Response

from chat.models import ChatGroup, ChatInvitation, GroupMessage
from chat.services import broadcast_message
from .serializers import (
    ChatSerializer, GroupChatWriteSerializer, InvitationSerializer,
    MessageCreateSerializer, MessageSerializer, TargetUserSerializer,
)


class ChatViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "group_name"
    lookup_value_regex = r"[^/]+"
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]  # без PUT

    def get_queryset(self):
        last = GroupMessage.objects.filter(group=OuterRef("pk")).order_by("-created")
        return (
            ChatGroup.objects.filter(members=self.request.user)   # только мои чаты
            .prefetch_related(
                Prefetch("members", queryset=User.objects.select_related("profile"))
            )
            .annotate(
                last_message_body=Subquery(last.values("body")[:1]),
                last_message_at=Subquery(last.values("created")[:1]),
            )
            .order_by(F("last_message_at").desc(nulls_last=True), "-id")
        )

    def get_serializer_class(self):
        if self.action in ("create", "partial_update"):
            return GroupChatWriteSerializer
        return ChatSerializer

    def _require_admin(self, chat):
        if chat.admin_id != self.request.user.id:
            raise PermissionDenied("Лише адміністратор чату може це робити.")

    def _chat_data(self, chat):
        chat = self.get_queryset().get(pk=chat.pk)
        return ChatSerializer(chat, context=self.get_serializer_context()).data

    def perform_create(self, serializer):
        chat = serializer.save(admin=self.request.user)
        chat.members.add(self.request.user)

    def perform_update(self, serializer):
        self._require_admin(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self._require_admin(instance)
        instance.delete()

    @action(detail=False, methods=["post"])
    def direct(self, request):
        ser = TargetUserSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        other = ser.validated_data["user"]
        if other == request.user:
            raise ValidationError({"uusername": "Для нотаток використовуйте /chats/favorites/."})

        chat = (
            ChatGroup.objects.filter(is_private=True, members=request.user)
            .filter(members=other)
            .first()
        )
        created = chat is None
        if created:
            chat = ChatGroup.objects.create(is_private=True)
            chat.members.add(request.user, other)
        return Response(
            self._chat_data(chat),
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"])
    def favorites(self, request):
        chat, created = ChatGroup.objects.get_or_create(
            group_name=f"favorites_{request.user.username}",
            defaults={
                "is_private": True,
                "group_chat_name": f"Вибране ({request.user.username})",
            },
        )
        if created:
            chat.members.add(request.user)
        return Response(self._chat_data(chat))

    @action(detail=True, methods=["post"])
    def invite(self, request, group_name=None):
        chat = self.get_object()
        self._require_admin(chat)
        ser = TargetUserSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        to_user = ser.validated_data["user"]
        if chat.members.filter(id=to_user.id).exists():
            raise ValidationError({"uusername": "Користувач уже в чаті."})
        ChatInvitation.objects.get_or_create(
            to_user=to_user, chat_group=chat, defaults={"from_user": request.user}
        )
        return Response(status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["delete"], url_path=r"members/(?P<user_id>\d+)")
    def remove_member(self, request, group_name=None, user_id=None):
        chat = self.get_object()
        self._require_admin(chat)
        if int(user_id) == chat.admin_id:
            raise ValidationError("Адміністратора не можна видалити з чату.")
        chat.members.remove(int(user_id))
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def leave(self, request, group_name=None):
        chat = self.get_object()
        if chat.is_private:
            raise ValidationError("Приватний чат не можна покинути.")
        if chat.admin_id == request.user.id:
            raise ValidationError("Адміністратор не може покинути чат. Видаліть його.")
        chat.members.remove(request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MessagePagination(CursorPagination):
    page_size = 30
    ordering = "-created"


class MessageViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = MessagePagination

    def get_chat(self):
        if not hasattr(self, "_chat"):
            self._chat = get_object_or_404(
                ChatGroup, group_name=self.kwargs["group_name"], members=self.request.user
            )
        return self._chat

    def get_queryset(self):
        return (
            GroupMessage.objects.filter(group=self.get_chat())
            .select_related("author__profile")
            .order_by("-created")
        )

    def get_serializer_class(self):
        return MessageCreateSerializer if self.action == "create" else MessageSerializer

    def perform_create(self, serializer):
        message = serializer.save(author=self.request.user, group=self.get_chat())
        transaction.on_commit(lambda: broadcast_message(message))


class InvitationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = InvitationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            ChatInvitation.objects
            .filter(to_user=self.request.user, accepted__isnull=True)
            .select_related("from_user__profile", "chat_group")
            .order_by("-timestamp")
        )

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        invite = self.get_object()
        group_name = invite.chat_group.group_name
        invite.chat_group.members.add(request.user)
        invite.delete()
        return Response({"group_name": group_name})

    @action(detail=True, methods=["post"])
    def decline(self, request, pk=None):
        self.get_object().delete()
        return Response(status=status.HTTP_204_NO_CONTENT)