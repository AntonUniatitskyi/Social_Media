from django.contrib.auth.models import User
from rest_framework import serializers

from chat.models import ChatGroup, ChatInvitation, GroupMessage

IMAGE_EXT = (".jpg", ".jpeg", ".png", ".gif", ".webp")
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 МБ


class UserMiniSerializer(serializers.ModelSerializer):
    uusername = serializers.CharField(source="profile.uusername", read_only=True)
    avatar = serializers.ImageField(source="profile.avatar", read_only=True)

    class Meta:
        model = User
        fields = ("id", "uusername", "avatar")


class TargetUserSerializer(serializers.Serializer):
    uusername = serializers.CharField()

    def validate(self, attrs):
        try:
            attrs["user"] = User.objects.select_related("profile").get(
                profile__uusername__iexact=attrs["uusername"], is_active=True
            )
        except User.DoesNotExist:
            raise serializers.ValidationError({"uusername": "Користувача не знайдено."})
        return attrs


class MessageSerializer(serializers.ModelSerializer):
    author = UserMiniSerializer(read_only=True)
    filename = serializers.CharField(read_only=True)
    is_image = serializers.SerializerMethodField()

    class Meta:
        model = GroupMessage
        fields = ("id", "author", "body", "file", "filename", "is_image", "created")
        read_only_fields = fields

    def get_is_image(self, obj):
        return bool(obj.file) and obj.filename.lower().endswith(IMAGE_EXT)


class MessageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = GroupMessage
        fields = ("body", "file")

    def validate_file(self, f):
        if f.size > MAX_FILE_SIZE:
            raise serializers.ValidationError("Файл завеликий (максимум 10 МБ).")
        return f

    def validate(self, attrs):
        body = (attrs.get("body") or "").strip()
        if not body and not attrs.get("file"):
            raise serializers.ValidationError("Повідомлення не може бути порожнім.")
        attrs["body"] = body or None
        return attrs

    def to_representation(self, instance):
        return MessageSerializer(instance, context=self.context).data


class ChatSerializer(serializers.ModelSerializer):
    title = serializers.SerializerMethodField()
    is_admin = serializers.SerializerMethodField()
    members = UserMiniSerializer(many=True, read_only=True)
    last_message_body = serializers.SerializerMethodField()
    last_message_at = serializers.SerializerMethodField()

    class Meta:
        model = ChatGroup
        fields = (
            "group_name", "title", "is_private", "is_admin", "members",
            "last_message_body", "last_message_at",
        )

    def get_title(self, obj):
        if obj.group_chat_name:
            return obj.group_chat_name
        me = self.context["request"].user
        other = next((m for m in obj.members.all() if m.id != me.id), None)
        return other.profile.uusername if other else "Чат"

    def get_is_admin(self, obj):
        return obj.admin_id == self.context["request"].user.id

    def get_last_message_body(self, obj):
        return getattr(obj, "last_message_body", None)

    def get_last_message_at(self, obj):
        return getattr(obj, "last_message_at", None)


class GroupChatWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatGroup
        fields = ("group_chat_name",)
        extra_kwargs = {
            "group_chat_name": {"required": True, "allow_null": False, "allow_blank": False}
        }

    def to_representation(self, instance):
        return ChatSerializer(instance, context=self.context).data


class InvitationSerializer(serializers.ModelSerializer):
    from_user = UserMiniSerializer(read_only=True)
    group_name = serializers.CharField(source="chat_group.group_name", read_only=True)
    chat_title = serializers.CharField(source="chat_group.group_chat_name", read_only=True)

    class Meta:
        model = ChatInvitation
        fields = ("id", "from_user", "group_name", "chat_title", "timestamp")
        read_only_fields = fields