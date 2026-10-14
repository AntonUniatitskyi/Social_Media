from rest_framework import permissions

class IsOwnerOrReadOnly(permissions.BasePermission):
    owner_field = "profile"

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        owner = getattr(obj, getattr(view, "owner_field", self.owner_field))
        owner_user = getattr(owner, "user", owner)
        return owner_user == request.user


class IsSiteAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return u.is_authenticated and (u.is_superuser or u.groups.filter(name="Адміністратор").exists())