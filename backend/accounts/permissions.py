from rest_framework.permissions import BasePermission


ACTIVE_ROLE_SESSION_KEY = "active_role"


def get_available_roles(user):
    if not user or not user.is_authenticated:
        return []

    roles = []
    profile = getattr(user, "profile", None)

    if user.is_superuser or user.is_staff or bool(profile and profile.role == "ADMIN"):
        roles.append("admin")

    if not profile or profile.role == "DOCENTE":
        roles.append("docente")

    return roles


def get_active_role(user, session=None):
    available_roles = get_available_roles(user)
    if not available_roles:
        return None

    session_role = session.get(ACTIVE_ROLE_SESSION_KEY) if session else None
    if session_role in available_roles:
        return session_role

    if "admin" in available_roles:
        return "admin"

    return available_roles[0]


def is_admin_user(user, session=None):
    return get_active_role(user, session) == "admin"


class IsAdminProfile(BasePermission):
    def has_permission(self, request, view):
        return is_admin_user(request.user, request.session)
