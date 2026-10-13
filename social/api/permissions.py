from rest_framework import permissions

class IsOwnerOrReadOnly(permissions.BasePermission):
    owner_field = "profile"

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        owner_profile = getattr(obj, getattr(view, "owner_field", self.owner_field))
        return owner_profile.user == request.user