from rest_framework.routers import DefaultRouter
from .views import PublicationViewSet, CommentViewSet, ProfileViewSet, NotificationViewSet

router = DefaultRouter()
router.register("publications", PublicationViewSet, basename="publication")
router.register('comments', CommentViewSet, basename="comment")
router.register("profiles", ProfileViewSet, basename="profile")
router.register("notifications", NotificationViewSet, basename="notification")
urlpatterns = router.urls