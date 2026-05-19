from django.db.models import ProtectedError
from rest_framework import status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsAdminProfile
from .models import (
    Carrera,
    Competencia,
    ConfiguracionCRE,
    EspacioCurricular,
    PlanEstudio,
    PlanEstudioEC,
    UnidadAcademica,
)
from .serializers import (
    CarreraSerializer,
    CompetenciaSerializer,
    ConfiguracionCRESerializer,
    EspacioCurricularSerializer,
    PlanEstudioECSerializer,
    PlanEstudioSerializer,
    UnidadAcademicaSerializer,
)


class AdminWritePermissionMixin:
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            return [IsAdminProfile()]
        return [IsAuthenticated()]


class ProtectedDeleteMixin:
    protected_delete_message = (
        "No se puede eliminar este registro porque está siendo utilizado por otros datos."
    )

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            raise ValidationError({"detail": self.protected_delete_message})


class UnidadAcademicaViewSet(AdminWritePermissionMixin, ProtectedDeleteMixin, viewsets.ModelViewSet):
    serializer_class = UnidadAcademicaSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return UnidadAcademica.objects.none()
        return UnidadAcademica.objects.all().order_by("sigla")


class CarreraViewSet(AdminWritePermissionMixin, ProtectedDeleteMixin, viewsets.ModelViewSet):
    serializer_class = CarreraSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Carrera.objects.none()

        queryset = Carrera.objects.select_related("unidad_academica")
        unidad_academica_id = self.request.query_params.get("unidad_academica_id")
        if unidad_academica_id:
            queryset = queryset.filter(unidad_academica_id=unidad_academica_id)
        return queryset.order_by("nombre")


class ConfiguracionCREViewSet(AdminWritePermissionMixin, ProtectedDeleteMixin, viewsets.ModelViewSet):
    serializer_class = ConfiguracionCRESerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ConfiguracionCRE.objects.none()
        return ConfiguracionCRE.objects.all().order_by("-actualizado_en")


class PlanEstudioViewSet(AdminWritePermissionMixin, ProtectedDeleteMixin, viewsets.ModelViewSet):
    serializer_class = PlanEstudioSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return PlanEstudio.objects.none()

        queryset = PlanEstudio.objects.select_related("carrera", "carrera__unidad_academica")
        carrera_id = self.request.query_params.get("carrera_id")
        if carrera_id:
            queryset = queryset.filter(carrera_id=carrera_id)
        return queryset.order_by("carrera__nombre", "nombre")


class PlanEstudioECViewSet(AdminWritePermissionMixin, ProtectedDeleteMixin, viewsets.ModelViewSet):
    serializer_class = PlanEstudioECSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return PlanEstudioEC.objects.none()

        queryset = PlanEstudioEC.objects.select_related(
            "plan_estudio",
            "plan_estudio__carrera",
            "espacio_curricular",
        )
        plan_estudio_id = self.request.query_params.get("plan_estudio_id")
        if plan_estudio_id:
            queryset = queryset.filter(plan_estudio_id=plan_estudio_id)
        espacio_curricular_id = self.request.query_params.get("espacio_curricular_id")
        if espacio_curricular_id:
            queryset = queryset.filter(espacio_curricular_id=espacio_curricular_id)
        return queryset.order_by("plan_estudio__nombre", "espacio_curricular__nombre")

    def destroy(self, request, *args, **kwargs):
        plan_ec = self.get_object()
        if plan_ec.programas.exists():
            raise ValidationError(
                {
                    "detail": (
                        "No se puede desvincular el espacio curricular porque ya tiene "
                        "programas asociados."
                    )
                }
            )
        return super().destroy(request, *args, **kwargs)


class EspacioCurricularViewSet(AdminWritePermissionMixin, ProtectedDeleteMixin, viewsets.ModelViewSet):
    serializer_class = EspacioCurricularSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return EspacioCurricular.objects.none()
        return EspacioCurricular.objects.all().order_by("nombre")


class CompetenciaViewSet(AdminWritePermissionMixin, viewsets.ModelViewSet):
    serializer_class = CompetenciaSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Competencia.objects.none()

        queryset = Competencia.objects.select_related("plan_estudio")
        include_inactive = self.request.query_params.get("include_inactive") == "1"
        if not include_inactive:
            queryset = queryset.filter(activo=True)
        plan_estudio_id = self.request.query_params.get("plan_estudio_id")
        if plan_estudio_id:
            queryset = queryset.filter(plan_estudio_id=plan_estudio_id)
        return queryset.order_by("plan_estudio_id", "codigo")

    def destroy(self, request, *args, **kwargs):
        competencia = self.get_object()
        competencia.activo = False
        competencia.save(update_fields=["activo"])
        return Response(status=status.HTTP_204_NO_CONTENT)
