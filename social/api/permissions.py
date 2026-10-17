from rest_framework import permissions

class IsOwnerOrReadOnly(permissions.BasePermission):
    owner_field = "profile"

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        owner = getattr(obj, getattr(view, "owner_field", self.owner_field))
        owner_user = getattr(owner, "user", owner)
        return owner_user == request.user


def is_site_admin(user):
    return user.is_authenticated and (
        user.is_superuser or user.groups.filter(name="Адміністратор").exists()
    )


class IsSiteAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return is_site_admin(request.user)