from django.db.models import Count, QuerySet
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from social.models import Publication, Comment
from .serializers import PublicationSerializer, PublicationWriteSerializer, CommentSerializer
from .permissions import IsOwnerOrReadOnly


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
        serializer.save(profile=self.request.user.profile)

    @action(detail=True, methods=["post"])
    def like(self, request, pk=None):
        pub = self.get_object()
        if pub.likes.filter(id=request.user.id).exists():
            pub.likes.remove(request.user)
            liked = False
        else:
            pub.likes.add(request.user)
            liked = True
        return Response({"liked": liked, "likes_total": pub.likes.count()})

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