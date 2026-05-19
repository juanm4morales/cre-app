from django.urls import include, path
from rest_framework.routers import DefaultRouter

from academics.viewsets import (
    CarreraViewSet,
    CompetenciaViewSet,
    ConfiguracionCREViewSet,
    EspacioCurricularViewSet,
    PlanEstudioECViewSet,
    PlanEstudioViewSet,
    UnidadAcademicaViewSet,
)
from planning.viewsets import (
    ActividadViewSet,
    AsignacionDocenteViewSet,
    ClaseCalendarioViewSet,
    DiaClaseProgramaViewSet,
    ProgramaViewSet,
    TipoActividadViewSet,
    EspaciosCurricularesAsignadosViewSet,
    UnidadViewSet,
)
from accounts import views as accounts_views
from accounts.viewsets import UserViewSet

router = DefaultRouter(trailing_slash=False)

router.register("unidades-academicas", UnidadAcademicaViewSet, basename="unidad-academica")
router.register("carreras", CarreraViewSet, basename="carrera")
router.register("configuracion-cre", ConfiguracionCREViewSet, basename="configuracion-cre")
router.register("planes-estudio", PlanEstudioViewSet, basename="plan-estudio")
router.register("planes-estudio-ec", PlanEstudioECViewSet, basename="plan-estudio-ec")
router.register("competencias", CompetenciaViewSet, basename="competencia")
router.register("espacios-curriculares", EspacioCurricularViewSet, basename="espacio-curricular")
router.register("espacios-asignados", EspaciosCurricularesAsignadosViewSet, basename="espacios-asignados")
router.register("tipos-actividad", TipoActividadViewSet, basename="tipo-actividad")
router.register("asignaciones-docentes", AsignacionDocenteViewSet, basename="asignacion-docente")
router.register("programas", ProgramaViewSet, basename="programa")
router.register("dias-clase", DiaClaseProgramaViewSet, basename="dia-clase")
router.register("clases-calendario", ClaseCalendarioViewSet, basename="clase-calendario")
router.register("unidades", UnidadViewSet, basename="unidad")
router.register("actividades", ActividadViewSet, basename="actividad")
router.register("usuarios", UserViewSet, basename="usuario")

urlpatterns = [
    path("auth/csrf", accounts_views.csrf, name="auth-csrf"),
    path("auth/login", accounts_views.login_view, name="auth-login"),
    path("auth/logout", accounts_views.logout_view, name="auth-logout"),
    path("auth/me", accounts_views.me, name="auth-me"),
    path("", include(router.urls)),
]
