from rest_framework.permissions import BasePermission


class IsAdminProfile(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        profile = getattr(user, "profile", None)
        if not profile:
            return False

        return profile.role == "ADMIN"
