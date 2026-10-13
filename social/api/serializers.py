from rest_framework import serializers
from social.models import Publication, Comment, Profile, MediaItem


class ProfileMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ('id', 'uusername', 'avatar')


class ProfileSerializers(serializers.ModelSerializer):
    followers_count = serializers.IntegerField(read_only=True)
    following_count = serializers.IntegerField(read_only=True)
    publications_count = serializers.IntegerField(read_only=True)
    is_following = serializers.SerializerMethodField()
    class Meta:
        model = Profile
        fields = (
            'id', 'username', 'bio', 'avatar',
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
    class Meta:
        model = Publication
        fields = ("id", "text")
        read_only_fields = ("id",)
