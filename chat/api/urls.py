from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import ChatViewSet, InvitationViewSet, MessageViewSet

router = SimpleRouter()
router.register("chats", ChatViewSet, basename="chat")
router.register("invitations", InvitationViewSet, basename="invitation")

urlpatterns = [
    path(
        "chats/<str:group_name>/messages/",
        MessageViewSet.as_view({"get": "list", "post": "create"}),
        name="chat-messages",
    ),
] + router.urls