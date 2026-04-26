from django.contrib.auth import login, logout
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .serializers import LoginSerializer


def _role_from_profile(user):
	profile = getattr(user, "profile", None)
	if not profile:
		return "docente"
	return "admin" if profile.role == "ADMIN" else "docente"


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

	return Response(
		{
			"username": user.username,
			"name": user.get_full_name() or user.username,
			"role": _role_from_profile(user),
		}
	)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
	logout(request)
	return Response({"detail": "Logout ok"})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
	user = request.user
	return Response(
		{
			"username": user.username,
			"name": user.get_full_name() or user.username,
			"role": _role_from_profile(user),
		}
	)
