import math

from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import Actividad, AsignacionDocente, Programa, TipoActividad, Unidad
from .models import ClaseCalendario, DiaClasePrograma
from academics.models import ConfiguracionCRE, EspacioCurricular, PlanEstudio, PlanEstudioEC
from accounts.permissions import IsAdminProfile, is_admin_user
from .serializers import (
    AsignacionDocenteSerializer,
    ActividadCreateSerializer,
    ActividadAjusteCreateSerializer,
    ActividadAjusteSerializer,
    ActividadSerializer,
    ActividadUpdateSerializer,
    ClaseCalendarioGeneracionSerializer,
    ClaseCalendarioSerializer,
    DiaClaseProgramaSerializer,
    ProgramaCreateSerializer,
    ProgramaSerializer,
    ProgramaUpdateSerializer,
    TipoActividadSerializer,
    UnidadCreateSerializer,
    UnidadCompetenciaAssignSerializer,
    UnidadSerializer,
    UnidadUpdateSerializer,
)
from academics.serializers import EspacioCurricularSerializer
from .services.calendar_generation import generate_calendar_classes_for_range


def _is_admin(user, session=None):
    return is_admin_user(user, session)


def _assigned_ec_ids(user, session=None):
    """Get IDs of curricular spaces currently assigned to user."""
    if _is_admin(user, session):
        return None

    return AsignacionDocente.objects.activas(fecha=timezone.now().date()).filter(
        docente=user
    ).values_list("espacio_curricular_id", flat=True)


class TipoActividadViewSet(viewsets.ModelViewSet):
    serializer_class = TipoActividadSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            return [IsAdminProfile()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return TipoActividad.objects.all().order_by("nombre")


class AsignacionDocenteViewSet(viewsets.ModelViewSet):
    serializer_class = AsignacionDocenteSerializer
    permission_classes = [IsAdminProfile]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return AsignacionDocente.objects.none()

        queryset = AsignacionDocente.objects.select_related(
            "docente",
            "docente__profile",
            "espacio_curricular",
        )

        docente_id = self.request.query_params.get("docente_id")
        if docente_id:
            queryset = queryset.filter(docente_id=docente_id)

        espacio_curricular_id = self.request.query_params.get("espacio_curricular_id")
        if espacio_curricular_id:
            queryset = queryset.filter(espacio_curricular_id=espacio_curricular_id)

        return queryset.order_by("docente__last_name", "docente__first_name", "-vigente_desde")


class EspaciosCurricularesAsignadosViewSet(viewsets.ViewSet):
    """
    Endpoint que retorna espacios curriculares asignados al docente actual.
    Solo para docentes (no admin).
    """
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """Retorna espacios curriculares asignados al docente actual."""
        if _is_admin(request.user, request.session):
            # Admin ve todos los espacios
            espacios = EspacioCurricular.objects.all().order_by("nombre")
        else:
            # Docente ve solo sus espacios asignados
            assigned_ids = AsignacionDocente.objects.activas(
                fecha=timezone.now().date()
            ).filter(docente=request.user).values_list(
                "espacio_curricular_id", flat=True
            )
            espacios = EspacioCurricular.objects.filter(
                id__in=assigned_ids
            ).order_by("nombre")

        serializer = EspacioCurricularSerializer(espacios, many=True)
        return Response(serializer.data)

    @staticmethod
    def _parse_positive_int(value, field_name, *, allow_zero=False):
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            raise ValidationError({field_name: "Ingresá un número válido."})

        if allow_zero:
            if parsed < 0:
                raise ValidationError({field_name: "El valor no puede ser negativo."})
        elif parsed < 1:
            raise ValidationError({field_name: "El valor debe ser mayor a 0."})

        return parsed

    @staticmethod
    def _calculate_creditos_from_hours(horas_ip, horas_ta):
        total_horas = horas_ip + horas_ta
        if total_horas <= 0:
            raise ValidationError(
                {"horas_ta": "La suma de Horas IP y Horas TA debe ser mayor a 0 para calcular créditos."}
            )
        horas_por_cre = ConfiguracionCRE.get_hours_per_cre()
        return max(1, math.ceil(total_horas / horas_por_cre))

    @staticmethod
    def _ensure_docente_self_service_user(request):
        profile = getattr(request.user, "profile", None)
        if not profile or profile.role != "DOCENTE":
            raise ValidationError(
                {"detail": "Esta acción temporal está habilitada solo para usuarios docentes."}
            )

    @action(detail=False, methods=["post"], url_path="temporal/espacio")
    def create_temporal_espacio(self, request):
        """
        TEMPORAL para pruebas docentes: permite crear o reutilizar un espacio
        curricular, vincularlo a un plan de estudio y asignarlo al docente actual.

        Debe retirarse cuando la asignación institucional definitiva esté integrada.
        """
        self._ensure_docente_self_service_user(request)

        codigo = str(request.data.get("codigo") or "").strip().upper()
        nombre = str(request.data.get("nombre") or "").strip()
        tipo_espacio = str(request.data.get("tipo_espacio") or "T1").strip()
        periodo = str(request.data.get("periodo") or "ANUAL").strip()
        plan_estudio_id = request.data.get("plan_estudio")

        if not codigo:
            raise ValidationError({"codigo": "El código del espacio curricular es requerido."})
        if not nombre:
            raise ValidationError({"nombre": "El nombre del espacio curricular es requerido."})
        if tipo_espacio not in EspacioCurricular.TipoEspacio.values:
            raise ValidationError({"tipo_espacio": "Tipo de espacio curricular inválido."})
        if periodo not in EspacioCurricular.Periodo.values:
            raise ValidationError({"periodo": "Período inválido."})

        anio_cursada = self._parse_positive_int(request.data.get("anio_cursada", 1), "anio_cursada")
        horas_ip = self._parse_positive_int(request.data.get("horas_ip", 0), "horas_ip", allow_zero=True)
        horas_ta = self._parse_positive_int(request.data.get("horas_ta", 0), "horas_ta", allow_zero=True)
        creditos = self._calculate_creditos_from_hours(horas_ip, horas_ta)

        try:
            plan_estudio = PlanEstudio.objects.get(pk=plan_estudio_id)
        except PlanEstudio.DoesNotExist:
            raise ValidationError({"plan_estudio": "Seleccioná un plan de estudio válido."})

        today = timezone.now().date()
        with transaction.atomic():
            espacio, espacio_created = EspacioCurricular.objects.get_or_create(
                codigo=codigo,
                defaults={
                    "nombre": nombre,
                    "tipo_espacio": tipo_espacio,
                    "anio_cursada": anio_cursada,
                    "periodo": periodo,
                    "creditos": creditos,
                    "horas_ip": horas_ip,
                    "horas_ta": horas_ta,
                },
            )
            if not espacio_created:
                espacio.nombre = nombre
                espacio.tipo_espacio = tipo_espacio
                espacio.anio_cursada = anio_cursada
                espacio.periodo = periodo
                espacio.creditos = creditos
                espacio.horas_ip = horas_ip
                espacio.horas_ta = horas_ta
                try:
                    espacio.full_clean()
                except DjangoValidationError as exc:
                    raise ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)
                espacio.save(
                    update_fields=["nombre", "tipo_espacio", "anio_cursada", "periodo", "creditos", "horas_ip", "horas_ta"]
                )
            plan_ec, plan_ec_created = PlanEstudioEC.objects.get_or_create(
                plan_estudio=plan_estudio,
                espacio_curricular=espacio,
            )
            assignment_exists = AsignacionDocente.objects.activas(fecha=today).filter(
                docente=request.user,
                espacio_curricular=espacio,
            ).exists()
            if not assignment_exists:
                AsignacionDocente.objects.create(
                    docente=request.user,
                    espacio_curricular=espacio,
                    categoria=AsignacionDocente.Categoria.TITULAR,
                    vigente_desde=today,
                )

        return Response(
            {
                "espacio": EspacioCurricularSerializer(espacio).data,
                "plan_estudio_ec_id": plan_ec.id,
                "espacio_created": espacio_created,
                "plan_estudio_ec_created": plan_ec_created,
                "assignment_created": not assignment_exists,
                "temporary": True,
            },
            status=status.HTTP_201_CREATED if espacio_created or not assignment_exists else status.HTTP_200_OK,
        )

    @action(detail=False, methods=["patch"], url_path="temporal/carga-horaria")
    def update_temporal_carga_horaria(self, request):
        """
        TEMPORAL para pruebas docentes: permite ajustar horas IP/TA del espacio
        asignado y recalcula créditos con la equivalencia horas/CRE configurada.

        Debe retirarse cuando estos valores provengan del sistema académico oficial.
        """
        self._ensure_docente_self_service_user(request)

        espacio_id = request.data.get("espacio_curricular_id")
        try:
            espacio = EspacioCurricular.objects.get(pk=espacio_id)
        except EspacioCurricular.DoesNotExist:
            raise ValidationError({"espacio_curricular_id": "Espacio curricular no encontrado."})

        has_assignment = AsignacionDocente.objects.activas(fecha=timezone.now().date()).filter(
            docente=request.user,
            espacio_curricular=espacio,
        ).exists()
        if not has_assignment:
            return Response(
                {"detail": "No tenés asignado este espacio curricular."},
                status=status.HTTP_403_FORBIDDEN,
            )

        espacio.horas_ip = self._parse_positive_int(request.data.get("horas_ip", 0), "horas_ip", allow_zero=True)
        espacio.horas_ta = self._parse_positive_int(request.data.get("horas_ta", 0), "horas_ta", allow_zero=True)
        espacio.creditos = self._calculate_creditos_from_hours(espacio.horas_ip, espacio.horas_ta)
        try:
            espacio.full_clean()
        except DjangoValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)
        espacio.save(update_fields=["creditos", "horas_ip", "horas_ta"])

        return Response({"espacio": EspacioCurricularSerializer(espacio).data, "temporary": True})

    @action(detail=False, methods=["post"], url_path="temporal/asignarme")
    def assign_existing_temporal_espacio(self, request):
        """
        TEMPORAL para pruebas docentes: permite autoasignarse un espacio
        curricular existente y vincularlo al plan seleccionado si hace falta.

        Debe retirarse cuando la asignación institucional definitiva esté integrada.
        """
        self._ensure_docente_self_service_user(request)

        espacio_id = request.data.get("espacio_curricular")
        plan_estudio_id = request.data.get("plan_estudio")

        try:
            espacio = EspacioCurricular.objects.get(pk=espacio_id)
        except EspacioCurricular.DoesNotExist:
            raise ValidationError({"espacio_curricular": "Seleccioná un espacio curricular válido."})

        try:
            plan_estudio = PlanEstudio.objects.get(pk=plan_estudio_id)
        except PlanEstudio.DoesNotExist:
            raise ValidationError({"plan_estudio": "Seleccioná un plan de estudio válido."})

        today = timezone.now().date()
        with transaction.atomic():
            plan_ec, plan_ec_created = PlanEstudioEC.objects.get_or_create(
                plan_estudio=plan_estudio,
                espacio_curricular=espacio,
            )
            assignment_exists = AsignacionDocente.objects.activas(fecha=today).filter(
                docente=request.user,
                espacio_curricular=espacio,
            ).exists()
            if not assignment_exists:
                AsignacionDocente.objects.create(
                    docente=request.user,
                    espacio_curricular=espacio,
                    categoria=AsignacionDocente.Categoria.TITULAR,
                    vigente_desde=today,
                )

        return Response(
            {
                "espacio": EspacioCurricularSerializer(espacio).data,
                "plan_estudio_ec_id": plan_ec.id,
                "plan_estudio_ec_created": plan_ec_created,
                "assignment_created": not assignment_exists,
                "temporary": True,
            },
            status=status.HTTP_201_CREATED if not assignment_exists else status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"])
    def create_programa_if_needed(self, request):
        """
        Crea un programa para el año actual si no existe.
        Copia actividades del año anterior si existen.
        
        Request body: {"plan_estudio_ec_id": <id>}
        """
        plan_ec_id = request.data.get("plan_estudio_ec_id")
        if not plan_ec_id:
            return Response(
                {"error": "plan_estudio_ec_id es requerido"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            plan_ec = PlanEstudioEC.objects.get(id=plan_ec_id)
        except PlanEstudioEC.DoesNotExist:
            return Response(
                {"error": "PlanEstudioEC no encontrado"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Verificar que el docente tiene asignado este espacio
        if not _is_admin(request.user, request.session):
            has_assignment = AsignacionDocente.objects.activas(
                fecha=timezone.now().date()
            ).filter(
                docente=request.user,
                espacio_curricular=plan_ec.espacio_curricular
            ).exists()
            if not has_assignment:
                return Response(
                    {"error": "No tienes asignado este espacio curricular"},
                    status=status.HTTP_403_FORBIDDEN
                )

        current_year = timezone.now().year
        programa, created = Programa.objects.get_or_create(
            plan_estudio_ec=plan_ec,
            anio_academico=current_year,
            defaults={"descripcion": "", "activo": True}
        )

        if not created and not programa.activo:
            programa.activo = True
            programa.save(update_fields=["activo"])

        # Si se creó nuevo, copiar actividades del año anterior
        if created:
            programa_anterior = Programa.objects.filter(
                plan_estudio_ec=plan_ec,
                anio_academico=current_year - 1,
                activo=True,
            ).first()

            if programa_anterior:
                unidades_map = {}
                for unidad_anterior in programa_anterior.unidades.filter(activo=True).order_by("numero"):
                    nueva_unidad = Unidad.objects.create(
                        programa=programa,
                        numero=unidad_anterior.numero,
                        descripcion=unidad_anterior.descripcion,
                    )
                    unidades_map[unidad_anterior.id] = nueva_unidad

                for actividad in programa_anterior.actividades.filter(activo=True).prefetch_related("unidades").all():
                    nueva_actividad = Actividad.objects.create(
                        programa=programa,
                        tipo_actividad=actividad.tipo_actividad,
                        descripcion=actividad.descripcion,
                        horas=actividad.horas,
                        modalidad_trabajo=actividad.modalidad_trabajo,
                    )
                    nuevas_unidades = [
                        unidades_map[unidad.id].id
                        for unidad in actividad.unidades.all()
                        if unidad.id in unidades_map
                    ]
                    if nuevas_unidades:
                        nueva_actividad.unidades.set(nuevas_unidades)

        serializer = ProgramaSerializer(programa)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class ProgramaViewSet(viewsets.ModelViewSet):
    serializer_class = ProgramaSerializer

    def get_serializer_class(self):
        if self.action == "create":
            return ProgramaCreateSerializer
        if self.action in {"update", "partial_update"}:
            return ProgramaUpdateSerializer
        return ProgramaSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Programa.objects.none()

        queryset = Programa.objects.select_related(
            "plan_estudio_ec",
            "plan_estudio_ec__espacio_curricular",
            "plan_estudio_ec__plan_estudio",
        ).filter(activo=True)

        assigned_ids = _assigned_ec_ids(self.request.user, self.request.session)
        if assigned_ids is not None:
            queryset = queryset.filter(
                plan_estudio_ec__espacio_curricular_id__in=assigned_ids,
            )

        plan_ec_id = self.request.query_params.get("plan_estudio_ec_id")
        if plan_ec_id:
            queryset = queryset.filter(plan_estudio_ec_id=plan_ec_id)

        return queryset.order_by("-anio_academico")

    def destroy(self, request, *args, **kwargs):
        programa = self.get_object()
        programa.activo = False
        programa.save(update_fields=["activo"])
        programa.unidades.update(activo=False)
        programa.actividades.update(activo=False)
        return Response(status=status.HTTP_204_NO_CONTENT)

class ActividadViewSet(viewsets.ModelViewSet):
    serializer_class = ActividadSerializer

    def get_serializer_class(self):
        if self.action == "create":
            return ActividadCreateSerializer
        if self.action in {"update", "partial_update"}:
            return ActividadUpdateSerializer
        return ActividadSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Actividad.objects.none()

        queryset = Actividad.objects.select_related(
            "programa",
            "programa__plan_estudio_ec",
            "tipo_actividad",
            "clase_calendario",
        ).prefetch_related("unidades").filter(
            activo=True,
            programa__activo=True,
        )

        assigned_ids = _assigned_ec_ids(self.request.user, self.request.session)
        if assigned_ids is not None:
            queryset = queryset.filter(
                programa__plan_estudio_ec__espacio_curricular_id__in=assigned_ids,
            )

        programa_id = self.request.query_params.get("programa_id")
        if programa_id:
            queryset = queryset.filter(programa_id=programa_id)

        plan_ec_id = self.request.query_params.get("plan_estudio_ec_id")
        if plan_ec_id:
            queryset = queryset.filter(programa__plan_estudio_ec_id=plan_ec_id)

        return queryset.order_by("programa__anio_academico", "descripcion")

    def destroy(self, request, *args, **kwargs):
        actividad = self.get_object()
        actividad.activo = False
        actividad.save(update_fields=["activo"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get", "post"], url_path="ajustes")
    def ajustes(self, request, pk=None):
        actividad = self.get_object()
        if request.method.lower() == "get":
            queryset = actividad.ajustes.select_related("creado_por", "clase_destino")
            serializer = ActividadAjusteSerializer(queryset, many=True)
            return Response(serializer.data)

        serializer = ActividadAjusteCreateSerializer(
            data=request.data,
            context={"request": request, "actividad": actividad},
        )
        serializer.is_valid(raise_exception=True)
        ajuste = serializer.save()
        return Response(ActividadAjusteSerializer(ajuste).data, status=status.HTTP_201_CREATED)


class UnidadViewSet(viewsets.ModelViewSet):
    serializer_class = UnidadSerializer

    def get_serializer_class(self):
        if self.action == "create":
            return UnidadCreateSerializer
        if self.action in {"update", "partial_update"}:
            return UnidadUpdateSerializer
        return UnidadSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Unidad.objects.none()

        queryset = Unidad.objects.select_related(
            "programa",
            "programa__plan_estudio_ec",
        ).filter(
            activo=True,
            programa__activo=True,
        )

        assigned_ids = _assigned_ec_ids(self.request.user, self.request.session)
        if assigned_ids is not None:
            queryset = queryset.filter(
                programa__plan_estudio_ec__espacio_curricular_id__in=assigned_ids,
            )

        programa_id = self.request.query_params.get("programa_id")
        if programa_id:
            queryset = queryset.filter(programa_id=programa_id)

        plan_ec_id = self.request.query_params.get("plan_estudio_ec_id")
        if plan_ec_id:
            queryset = queryset.filter(programa__plan_estudio_ec_id=plan_ec_id)

        return queryset.order_by("programa__anio_academico", "numero")

    def destroy(self, request, *args, **kwargs):
        unidad = self.get_object()
        unidad.activo = False
        unidad.save(update_fields=["activo"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="competencias")
    def competencias(self, request, pk=None):
        unidad = self.get_object()
        serializer = UnidadCompetenciaAssignSerializer(
            data=request.data,
            context={"request": request, "unidad": unidad},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UnidadSerializer(unidad).data)


class DiaClaseProgramaViewSet(viewsets.ModelViewSet):
    serializer_class = DiaClaseProgramaSerializer

    def _raise_friendly_integrity_error(self, exc: IntegrityError):
        error_message = str(exc)

        if "check_dia_clase_hora_inicio_menor_hora_fin" in error_message:
            raise ValidationError(
                {"hora_fin": ["La hora de fin debe ser posterior a la hora de inicio."]}
            )

        if "unique_dia_clase_programa_slot" in error_message:
            raise ValidationError(
                {
                    "non_field_errors": [
                        "Ya existe ese día y franja horaria para el programa seleccionado."
                    ]
                }
            )

        raise ValidationError(
            {
                "non_field_errors": [
                    "No se pudo guardar el día de cursado. Revisa los datos ingresados."
                ]
            }
        )

    def perform_create(self, serializer):
        try:
            serializer.save()
        except IntegrityError as exc:
            self._raise_friendly_integrity_error(exc)

    def perform_update(self, serializer):
        try:
            serializer.save()
        except IntegrityError as exc:
            self._raise_friendly_integrity_error(exc)

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return DiaClasePrograma.objects.none()

        queryset = DiaClasePrograma.objects.select_related(
            "programa",
            "programa__plan_estudio_ec",
        ).filter(activo=True, programa__activo=True)

        assigned_ids = _assigned_ec_ids(self.request.user, self.request.session)
        if assigned_ids is not None:
            queryset = queryset.filter(
                programa__plan_estudio_ec__espacio_curricular_id__in=assigned_ids
            )

        programa_id = self.request.query_params.get("programa_id")
        if programa_id:
            queryset = queryset.filter(programa_id=programa_id)

        plan_ec_id = self.request.query_params.get("plan_estudio_ec_id")
        if plan_ec_id:
            queryset = queryset.filter(programa__plan_estudio_ec_id=plan_ec_id)

        return queryset.order_by("programa__anio_academico", "dia_semana", "hora_inicio", "id")

    def destroy(self, request, *args, **kwargs):
        dia_clase = self.get_object()
        dia_clase.activo = False
        dia_clase.save(update_fields=["activo"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ClaseCalendarioViewSet(viewsets.ModelViewSet):
    serializer_class = ClaseCalendarioSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ClaseCalendario.objects.none()

        queryset = ClaseCalendario.objects.select_related(
            "programa",
            "programa__plan_estudio_ec",
            "dia_clase",
        ).filter(programa__activo=True)

        assigned_ids = _assigned_ec_ids(self.request.user, self.request.session)
        if assigned_ids is not None:
            queryset = queryset.filter(
                programa__plan_estudio_ec__espacio_curricular_id__in=assigned_ids
            )

        programa_id = self.request.query_params.get("programa_id")
        if programa_id:
            queryset = queryset.filter(programa_id=programa_id)

        plan_ec_id = self.request.query_params.get("plan_estudio_ec_id")
        if plan_ec_id:
            queryset = queryset.filter(programa__plan_estudio_ec_id=plan_ec_id)

        desde = self.request.query_params.get("desde")
        hasta = self.request.query_params.get("hasta")
        if desde:
            queryset = queryset.filter(fecha__gte=desde)
        if hasta:
            queryset = queryset.filter(fecha__lte=hasta)

        return queryset.order_by("fecha", "id")

    @action(detail=False, methods=["post"], url_path="generar-rango")
    def generar_rango(self, request):
        serializer = ClaseCalendarioGeneracionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        programa_id = serializer.validated_data["programa_id"]
        fecha_desde = serializer.validated_data["fecha_desde"]
        fecha_hasta = serializer.validated_data["fecha_hasta"]
        sobrescribir = serializer.validated_data["sobrescribir"]

        programa_qs = Programa.objects.filter(id=programa_id, activo=True)
        assigned_ids = _assigned_ec_ids(request.user, request.session)
        if assigned_ids is not None:
            programa_qs = programa_qs.filter(
                plan_estudio_ec__espacio_curricular_id__in=assigned_ids
            )

        programa = programa_qs.first()
        if not programa:
            return Response(
                {"detail": "Programa no encontrado o sin permisos."},
                status=status.HTTP_404_NOT_FOUND,
            )

        result = generate_calendar_classes_for_range(
            programa=programa,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            sobrescribir=sobrescribir,
        )

        return Response(
            {
                "programa_id": programa.id,
                "fecha_desde": fecha_desde,
                "fecha_hasta": fecha_hasta,
                **result,
            },
            status=status.HTTP_200_OK,
        )
