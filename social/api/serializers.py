from django.contrib.auth.models import User, Group
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from social.models import Publication, Comment, Profile, MediaItem, Notification, Complaint

from social.services import attach_media

import os
from django.db import transaction
from PIL import UnidentifiedImageError

ALLOWED_MEDIA_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".mov"}
MAX_MEDIA_SIZE = 50 * 1024 * 1024

class ProfileMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ('id', 'uusername', 'avatar')


class ProfileSerializer(serializers.ModelSerializer):
    followers_count = serializers.IntegerField(read_only=True)
    following_count = serializers.IntegerField(read_only=True)
    publications_count = serializers.IntegerField(read_only=True)
    is_following = serializers.SerializerMethodField()
    class Meta:
        model = Profile
        fields = (
            'id', 'uusername', 'bio', 'avatar',
            'followers_count', 'following_count', 'publications_count',
            'is_following'
        )
        read_only_fields = ('id',)

    def get_is_following(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.followers.filter(id=request.user.id).exists()


class MediaItemSerializer(serializers.ModelSerializer):
    is_video = serializers.BooleanField(read_only=True)

    class Meta:
        model = MediaItem
        fields = ("id", "file", "is_video")


class CommentSerializer(serializers.ModelSerializer):
    # в модели поле называется user, но это Profile, поэтому на выходе даём author
    author = ProfileMiniSerializer(source="user", read_only=True)

    class Meta:
        model = Comment
        fields = ("id", "publication", "author", "text_com", "created_at")
        read_only_fields = ("id", "author", "created_at")


class PublicationSerializer(serializers.ModelSerializer):
    profile = ProfileMiniSerializer(read_only=True)
    media_items = MediaItemSerializer(many=True, read_only=True)
    likes_total = serializers.IntegerField(read_only=True)
    comments_total = serializers.IntegerField(read_only=True)
    is_liked = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()

    class Meta:
        model = Publication
        fields = (
            "id", "profile", "text", "timestamp", "media_items",
            "likes_total", "comments_total", "is_liked", "is_saved",
        )

    def _user(self):
        request = self.context.get("request")
        return request.user if request and request.user.is_authenticated else None

    def get_is_liked(self, obj):
        user = self._user()
        return obj.is_liked_by(user) if user else False

    def get_is_saved(self, obj):
        user = self._user()
        return obj.is_saved_by(user) if user else False


class PublicationWriteSerializer(serializers.ModelSerializer):
    media = serializers.ListField(
        child=serializers.FileField(), write_only=True,
        required=False, max_length=10,
    )

    class Meta:
        model = Publication
        fields = ("id", "text", "media")
        read_only_fields = ("id",)

    def validate(self, attrs):
        if self.instance is None and not attrs.get("media"):
            raise serializers.ValidationError("Потрібно додати хоча б один файл медіа.")
        return attrs

    def validate_media(self, files):
        for f in files:
            if os.path.splitext(f.name)[1].lower() not in ALLOWED_MEDIA_EXT:
                raise serializers.ValidationError("Підтримуються JPG, PNG, GIF, WebP, MP4 і MOV.")
            if f.size > MAX_MEDIA_SIZE:
                raise serializers.ValidationError("Файл завеликий: максимум 50 МБ.")
        return files

    def create(self, validated_data):
        files = validated_data.pop("media", [])
        try:
            with transaction.atomic():
                publication = super().create(validated_data)
                attach_media(publication, files)
        except (UnidentifiedImageError, OSError):
            raise serializers.ValidationError({"media": "Не вдалося обробити один із файлів."})
        return publication

    def update(self, instance, validated_data):
        validated_data.pop("media", None)
        return super().update(instance, validated_data)


class NotificationSerializer(serializers.ModelSerializer):
    sender = ProfileMiniSerializer(source="sender.profile", read_only=True)

    class Meta:
        model = Notification
        fields = ('id', 'sender', 'message', 'is_read', 'created_at')
        read_only_fields = fields


class MarkReadSerializer(serializers.Serializer):
    ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
        max_length=200,
    )


class ComplaintCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Complaint
        fields = ('publication', 'reason', 'text')

    def validate(self, attrs):
        request = self.context.get("request")
        user = request.user
        publication = attrs.get("publication")

        if publication.profile.user == user:
            raise ValidationError("Ви не можете поскаржитися на власну публікацію.")

        if Complaint.objects.filter(user=user, publication=publication, accepted=None).exists():
            raise ValidationError("Ви вже подали скаргу на цю публікацію, вона знаходиться на розгляді.")

        return attrs


class ComplaintSerializer(serializers.ModelSerializer):
    user = ProfileMiniSerializer(source="user.profile", read_only=True)

    class Meta:
        model = Complaint
        fields = ('id', 'user', 'publication', 'reason', 'text', 'created_at', 'accepted')
        read_only_fields = fields


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password]
    )
    email = serializers.EmailField(required=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password')
        extra_kwargs = {"username": {"max_length": 30}}

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Користувач з таким email вже існує.")
        return value

    def validate_username(self, value):
        if (User.objects.filter(username__iexact=value).exists()
                or Profile.objects.filter(uusername__iexact=value).exists()):
            raise serializers.ValidationError("Користувач з таким ім'ям вже існує.")
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )

        user_group, created = Group.objects.get_or_create(name='Користувач')
        user.groups.add(user_group)
        return user