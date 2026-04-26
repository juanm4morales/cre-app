from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

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


class UnidadAcademicaViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = UnidadAcademicaSerializer

    def get_queryset(self):
        return UnidadAcademica.objects.all().order_by("sigla")


class CarreraViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CarreraSerializer

    def get_queryset(self):
        return Carrera.objects.select_related("unidad_academica").order_by("nombre")


class ConfiguracionCREViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ConfiguracionCRESerializer

    def get_queryset(self):
        return ConfiguracionCRE.objects.all().order_by("-actualizado_en")


class PlanEstudioViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PlanEstudioSerializer

    def get_queryset(self):
        return PlanEstudio.objects.select_related("carrera").order_by("nombre")


class PlanEstudioECViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PlanEstudioECSerializer

    def get_queryset(self):
        return PlanEstudioEC.objects.select_related("plan_estudio", "espacio_curricular").order_by("id")


class EspacioCurricularViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = EspacioCurricularSerializer

    def get_queryset(self):
        return EspacioCurricular.objects.all().order_by("nombre")


class CompetenciaViewSet(viewsets.ModelViewSet):
    serializer_class = CompetenciaSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            return [IsAdminProfile()]
        return [IsAuthenticated()]

    def get_queryset(self):
        queryset = Competencia.objects.filter(activo=True).select_related("plan_estudio")
        plan_estudio_id = self.request.query_params.get("plan_estudio_id")
        if plan_estudio_id:
            queryset = queryset.filter(plan_estudio_id=plan_estudio_id)
        return queryset.order_by("plan_estudio_id", "codigo")
