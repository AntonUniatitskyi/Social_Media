from django.db.models import Count
from rest_framework import viewsets, permissions, mixins, status
from rest_framework.decorators import action
from rest_framework.response import Response
from social.models import Profile
from social.services import notify

from social.models import Publication, Comment, Notification
from .serializers import PublicationSerializer, PublicationWriteSerializer, CommentSerializer, ProfileSerializer, \
    NotificationSerializer, MarkReadSerializer
from .permissions import IsOwnerOrReadOnly

from django.db.models import Exists, OuterRef


class PublicationViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def get_queryset(self):
        return (
            Publication.objects
            .select_related("profile")
            .prefetch_related("media_items")
            .annotate(
                likes_total=Count("likes", distinct=True),
                comments_total=Count("comments", distinct=True),
            )
            .order_by("-timestamp")
        )

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return PublicationWriteSerializer
        return PublicationSerializer

    def perform_create(self, serializer):
        profile = self.request.user.profile
        publication = serializer.save(profile=profile)
        for follower in profile.followers.all():
            notify(follower, self.request.user,
                   f"{self.request.user.username} створив нову публікацію")

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def like(self, request, pk=None):
        pub = self.get_object()
        if pub.likes.filter(id=request.user.id).exists():
            pub.likes.remove(request.user)
            liked = False
        else:
            pub.likes.add(request.user)
            liked = True
        return Response({"liked": liked, "likes_total": pub.likes.count()})

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        instance = self.get_queryset().get(pk=serializer.instance.pk)
        data = PublicationSerializer(instance, context=self.get_serializer_context()).data
        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def feed(self, request):
        qs = self.get_queryset().annotate(
            is_followed=Exists(
                Profile.followers.through.objects.filter(
                    profile_id=OuterRef("profile_id"), user_id=request.user.id
                )
            )
        ).order_by("-is_followed", "-timestamp")
        page = self.paginate_queryset(qs)
        serializer = PublicationSerializer(page, many=True, context=self.get_serializer_context())
        return self.get_paginated_response(serializer.data)

    @action(detail=True, methods=["post"], url_path="save",
            permission_classes=[permissions.IsAuthenticated])
    def toggle_save(self, request, pk=None):
        pub = self.get_object()
        if pub.saved.filter(id=request.user.id).exists():
            pub.saved.remove(request.user)
            saved = False
        else:
            pub.saved.add(request.user)
            saved = True
        return Response({"saved": saved})

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def saved(self, request):
        qs = self.get_queryset().filter(saved=request.user)
        page = self.paginate_queryset(qs)
        serializer = PublicationSerializer(page, many=True, context=self.get_serializer_context())
        return self.get_paginated_response(serializer.data)

class CommentViewSet(viewsets.ModelViewSet):
    owner_field = "user"
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def get_queryset(self):
        queryset = (
            Comment.objects
            .select_related("user", "user__user")
            .order_by("created_at")
        )
        publication_id = self.request.query_params.get("publication")
        if publication_id:
            queryset = queryset.filter(publication_id=publication_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user.profile)


class ProfileViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    owner_field = "user"
    lookup_field = "uusername"
    lookup_value_regex = r"[^/]+"

    def get_queryset(self):
        return Profile.objects.select_related("user").order_by("uusername")

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        serializer = self.get_serializer(request.user.profile)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def follow(self, request, uusername=None):
        profile = self.get_object()
        if profile.user == request.user:
            return Response({"detail": "Не можна підписатись на себе."},
                            status=status.HTTP_400_BAD_REQUEST)
        profile.followers.add(request.user)
        notify(profile.user, request.user, f"{request.user.username} підписався(лась) на вас")
        return Response({"is_following": True,
                         "followers_count": profile.followers.count()})


    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def unfollow(self, request, uusername=None):
        profile = self.get_object()
        profile.followers.remove(request.user)
        return Response({"is_following": False,
                         "followers_count": profile.followers.count()})


class NotificationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Notification.objects
            .filter(recipient=self.request.user)  # только свои
            .select_related("sender__profile")
            .order_by('-created_at')
        )

    @action(detail=False, methods=["post"])
    def read(self, request):
        serializer = MarkReadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated = (
            self.get_queryset()
            .filter(id__in=serializer.validated_data["ids"], is_read=False)
            .update(is_read=True)
        )
        unread = self.get_queryset().filter(is_read=False).count()
        return Response({"marked": updated, "unread": unread})

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        count = self.get_queryset().filter(is_read=False).count()
        return Response({"unread": count})
