from django.contrib.auth import get_user_model
from rest_framework import mixins, viewsets
from rest_framework.response import Response
from rest_framework import status

from .permissions import IsAdminProfile
from .serializers import UserCreateSerializer, UserSerializer, UserUpdateSerializer


User = get_user_model()


class UserViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAdminProfile]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return User.objects.none()

        # Admin solo puede ver/gestionar usuarios docentes
        return User.objects.select_related("profile").filter(
            profile__role="DOCENTE",
            is_superuser=False
        ).order_by("username")

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        if self.action in {"update", "partial_update"}:
            return UserUpdateSerializer
        return UserSerializer

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        user.is_active = False
        user.save(update_fields=["is_active"])
        return Response({"detail": "Usuario desactivado"}, status=status.HTTP_200_OK)
