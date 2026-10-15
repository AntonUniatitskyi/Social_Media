from django.db import transaction
from django.db.models import Count, Exists, OuterRef, Case, F, IntegerField, Value, When
from rest_framework import viewsets, permissions, mixins, status, generics, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from social.models import Profile, Complaint
from social.services import notify, notify_many

from social.models import Publication, Comment, Notification
from .serializers import (
    CommentSerializer,
    ComplaintCreateSerializer,
    ComplaintSerializer,
    MarkReadSerializer,
    NotificationSerializer,
    ProfileCardSerializer,
    ProfileMiniSerializer,
    ProfileSerializer,
    PublicationSerializer,
    PublicationWriteSerializer,
    RegisterSerializer,
)
from .permissions import IsOwnerOrReadOnly, IsSiteAdmin

from django.db.models import Exists, OuterRef
from django.db.models.functions import Mod

class ProfileViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    owner_field = "user"
    lookup_field = "uusername"
    lookup_value_regex = r"[^/]+"
    filter_backends = [filters.SearchFilter]
    search_fields = ["uusername"]

    def get_permissions(self):
        if self.action in ("list", "followers", "following"):
            return [permissions.IsAuthenticated()]
        return super().get_permissions()

    def get_queryset(self):
        qs = Profile.objects.select_related("user").order_by("uusername")
        user = self.request.user
        if self.action == "list" and user.is_authenticated:
            qs = qs.annotate(following_by_me=Exists(
                Profile.followers.through.objects.filter(profile_id=OuterRef("pk"), user_id=user.id)
            ))
        return qs

    def get_serializer_class(self):
        return ProfileCardSerializer if self.action == "list" else ProfileSerializer

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        return Response(self.get_serializer(request.user.profile).data)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def follow(self, request, uusername=None):
        profile = self.get_object()
        if profile.user == request.user:
            return Response({"detail": "Не можна підписатись на себе."},
                            status=status.HTTP_400_BAD_REQUEST)
        if not profile.followers.filter(id=request.user.id).exists():
            profile.followers.add(request.user)
            notify(profile.user, request.user, f"{request.user.username} підписався(лась) на вас",
                   Notification.Kind.FOLLOW)
        return Response({"is_following": True, "followers_count": profile.followers.count()})

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def unfollow(self, request, uusername=None):
        profile = self.get_object()
        profile.followers.remove(request.user)
        return Response({"is_following": False, "followers_count": profile.followers.count()})

    def _page(self, qs):
        page = self.paginate_queryset(qs)
        data = ProfileMiniSerializer(page, many=True, context=self.get_serializer_context()).data
        return self.get_paginated_response(data)

    @action(detail=True, methods=["get"])
    def followers(self, request, uusername=None):
        profile = self.get_object()
        return self._page(Profile.objects.filter(user__following_profiles=profile).order_by("uusername"))

    @action(detail=True, methods=["get"])
    def following(self, request, uusername=None):
        profile = self.get_object()
        return self._page(profile.user.following_profiles.order_by("uusername"))

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def recommended(self, request):
        qs = (Profile.objects.exclude(user=request.user)
              .exclude(followers=request.user).order_by("?")[:5])
        return Response(ProfileMiniSerializer(qs, many=True, context=self.get_serializer_context()).data)

class PublicationViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def get_queryset(self):
        qs = (
            Publication.objects
            .select_related("profile")
            .prefetch_related("media_items")
            .annotate(
                likes_total=Count("likes", distinct=True),
                comments_total=Count("comments", distinct=True),
            )
        )
        user = self.request.user
        if user.is_authenticated:
            qs = qs.annotate(
                is_liked=Exists(Publication.likes.through.objects.filter(
                    publication_id=OuterRef("pk"), user_id=user.id)),
                is_saved=Exists(Publication.saved.through.objects.filter(
                    publication_id=OuterRef("pk"), user_id=user.id)),
            )
        if self.action == "list":                       # сетка публикаций на странице профиля
            author = self.request.query_params.get("author")
            if author:
                qs = qs.filter(profile__uusername__iexact=author)
        return qs.order_by("-timestamp")

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return PublicationWriteSerializer
        return PublicationSerializer

    def perform_create(self, serializer):
        profile = self.request.user.profile
        publication = serializer.save(profile=profile)
        notify_many(
            profile.followers.all(), self.request.user,
            f"{self.request.user.username} створив нову публікацію",
            Notification.Kind.POST, publication,
        )

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
        try:
            seed = min(max(1, int(request.query_params.get("seed", 1))), 1_000_000)
        except ValueError:
            seed = 1

        qs = (
            self.get_queryset()
            .exclude(profile=request.user.profile)
            .annotate(
                is_followed=Exists(
                    Profile.followers.through.objects.filter(
                        profile_id=OuterRef("profile_id"), user_id=request.user.id
                    )
                ),
                rand_key=Mod(F("id") * seed, 1000003),
            )
            .order_by(
                "-is_followed",                                  # сначала подписки
                Case(                                            # у подписок ключ один, решает дата
                    When(is_followed=True, then=Value(0)),
                    default=F("rand_key"),                       # у остальных решает seed
                    output_field=IntegerField(),
                ),
                "-timestamp",
                "-id",                                           # стабильная пагинация при равных ключах
            )
        )
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
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

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
        comment = serializer.save(user=self.request.user.profile)
        notify(comment.publication.profile.user, self.request.user,
            f"{self.request.user.username} залишив коментар до вашої публікації",
            Notification.Kind.COMMENT, comment.publication)


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


class ComplaintViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    def get_queryset(self):
        qs = Complaint.objects.select_related("user__profile", "publication").order_by('-created_at')
        if self.action != "list":
            return qs

        accepted_param = self.request.query_params.get("accepted", "").lower()

        if accepted_param == "true":
            return qs.filter(accepted=True)
        if accepted_param == "false":
            return qs.filter(accepted=False)
        if accepted_param == "all":
            return qs
        return qs.filter(accepted=None)

    def get_serializer_class(self):
        if self.action == "create":
            return ComplaintCreateSerializer
        return ComplaintSerializer

    def get_permissions(self):
        if self.action == "create":
            return [permissions.IsAuthenticated()]
        return [IsSiteAdmin()]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        complaint = self.get_object()
        if complaint.accepted is not None:
            return Response(
                {"detail": "Ця скарга вже була розглянута раніше."},
                status=status.HTTP_400_BAD_REQUEST
            )
        complaint.accept_complaint()
        return Response({"detail": "Скаргу прийнято. Публікацію видалено.", "accepted": True})

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        complaint = self.get_object()
        if complaint.accepted is not None:
            return Response(
                {"detail": "Ця скарга вже була розглянута раніше."},
                status=status.HTTP_400_BAD_REQUEST
            )

        complaint.reject_complaint()
        return Response({"detail": "Скаргу відхилено.", "accepted": False})


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        response_data = {
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email
            },
            "tokens": {
                "refresh": str(refresh),
                "access": str(refresh.access_token),
            }
        }

        return Response(response_data, status=status.HTTP_201_CREATED)