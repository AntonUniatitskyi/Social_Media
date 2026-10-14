from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

User = get_user_model()


@database_sync_to_async
def get_user(user_id):
    return User.objects.filter(id=user_id, is_active=True).first()


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        token = parse_qs(scope.get("query_string", b"").decode()).get("token", [None])[0]
        if token:
            try:
                user = await get_user(AccessToken(token)["user_id"])
            except TokenError:
                user = None
            if user:
                scope["user"] = user
        return await super().__call__(scope, receive, send)