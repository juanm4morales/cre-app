from django.contrib.auth import login, logout
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .permissions import ACTIVE_ROLE_SESSION_KEY, get_active_role, get_available_roles
from .serializers import LoginSerializer


def _auth_payload(request, user):
	return {
		"username": user.username,
		"name": user.get_full_name() or user.username,
		"role": get_active_role(user, request.session),
		"available_roles": get_available_roles(user),
	}


@api_view(["GET"])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def csrf(request):
	return Response({"detail": "CSRF cookie set"})


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
	serializer = LoginSerializer(data=request.data)
	serializer.is_valid(raise_exception=True)
	user = serializer.validated_data["user"]
	login(request, user)
	request.session[ACTIVE_ROLE_SESSION_KEY] = serializer.validated_data["role"]

	return Response(_auth_payload(request, user))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
	request.session.pop(ACTIVE_ROLE_SESSION_KEY, None)
	logout(request)
	return Response({"detail": "Logout ok"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def switch_role(request):
	user = request.user
	available_roles = get_available_roles(user)
	role = request.data.get("role")

	if role not in available_roles:
		return Response(
			{"detail": f"No tenes permisos para ingresar como {role}."},
			status=400,
		)

	request.session[ACTIVE_ROLE_SESSION_KEY] = role
	return Response(_auth_payload(request, user))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
	user = request.user
	return Response(_auth_payload(request, user))
