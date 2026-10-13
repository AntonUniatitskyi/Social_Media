from rest_framework.routers import DefaultRouter
from .views import PublicationViewSet, CommentViewSet

router = DefaultRouter()
router.register("publications", PublicationViewSet, basename="publication")
router.register('comments', CommentViewSet, basename="comment")
urlpatterns = router.urls