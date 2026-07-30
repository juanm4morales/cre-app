from datetime import date, datetime
from decimal import Decimal

from django.db import models
from rest_framework import serializers
from django.utils import timezone

from academics.models import Competencia
from academics.serializers import CompetenciaSerializer
from accounts.permissions import is_admin_user
from academics.models import PlanEstudioEC
from .models import (
    Actividad,
    ActividadAjuste,
    AsignacionDocente,
    ClaseCalendario,
    DiaClasePrograma,
    Programa,
    TipoActividad,
    Unidad,
    UnidadCompetencia,
)


def _docente_asignado(user, espacio_curricular_id, session=None):
    """Check if user has an active assignment to the curricular space.
    Admin users bypass the check (they can create/edit for any space)."""
    if is_admin_user(user, session):
        return True
    return (
        AsignacionDocente.objects.activas(fecha=timezone.now().date())
        .filter(docente=user, espacio_curricular_id=espacio_curricular_id)
        .exists()
    )


def _clase_duration_hours(clase_calendario: ClaseCalendario) -> Decimal | None:
    dia_clase = clase_calendario.dia_clase
    if not dia_clase or not dia_clase.hora_inicio or not dia_clase.hora_fin:
        return None

    inicio = datetime.combine(clase_calendario.fecha, dia_clase.hora_inicio)
    fin = datetime.combine(clase_calendario.fecha, dia_clase.hora_fin)
    seconds = (fin - inicio).total_seconds()
    if seconds <= 0:
        return Decimal("0")
    return Decimal(str(seconds / 3600)).quantize(Decimal("0.01"))


def _validate_ip_hours_within_class_duration(
    *,
    programa: Programa,
    tipo_actividad: TipoActividad | None,
    clase_calendario: ClaseCalendario | None,
    horas,
    instance: Actividad | None = None,
) -> None:
    if (
        not tipo_actividad
        or tipo_actividad.tipo_dedicacion != TipoActividad.TipoDedicacion.INTERACCION_PEDAGOGICA
        or clase_calendario is None
        or horas is None
    ):
        return

    duracion = _clase_duration_hours(clase_calendario)
    if duracion is None:
        return

    horas = Decimal(horas)
    existing_qs = Actividad.objects.filter(
        programa=programa,
        clase_calendario=clase_calendario,
        tipo_actividad__tipo_dedicacion=TipoActividad.TipoDedicacion.INTERACCION_PEDAGOGICA,
        activo=True,
    )
    if instance and instance.pk:
        existing_qs = existing_qs.exclude(pk=instance.pk)

    horas_existentes = sum(existing_qs.values_list("horas", flat=True), Decimal("0"))
    total = horas_existentes + horas
    if total > duracion:
        raise serializers.ValidationError(
            {
                "horas": (
                    "Las horas IP de la clase no pueden superar la duración definida "
                    f"en la agenda de cursado ({duracion} h). Ya hay {horas_existentes} h cargadas."
                )
            }
        )


class TipoActividadSerializer(serializers.ModelSerializer):
    class Meta:
        model = TipoActividad
        fields = ["id", "nombre", "descripcion", "tipo_dedicacion"]


class AsignacionDocenteSerializer(serializers.ModelSerializer):
    docente_nombre = serializers.SerializerMethodField()
    espacio_curricular_codigo = serializers.CharField(
        source="espacio_curricular.codigo",
        read_only=True,
    )
    espacio_curricular_nombre = serializers.CharField(
        source="espacio_curricular.nombre",
        read_only=True,
    )
    categoria_display = serializers.CharField(source="get_categoria_display", read_only=True)
    activo = serializers.BooleanField(read_only=True)

    class Meta:
        model = AsignacionDocente
        fields = [
            "id",
            "docente",
            "docente_nombre",
            "espacio_curricular",
            "espacio_curricular_codigo",
            "espacio_curricular_nombre",
            "categoria",
            "categoria_display",
            "vigente_desde",
            "vigente_hasta",
            "activo",
        ]
        read_only_fields = [
            "docente_nombre",
            "espacio_curricular_codigo",
            "espacio_curricular_nombre",
            "categoria_display",
            "activo",
        ]

    def get_docente_nombre(self, obj: AsignacionDocente) -> str:
        return obj.docente.get_full_name() or obj.docente.username

    def validate_docente(self, value):
        profile = getattr(value, "profile", None)
        if value.is_superuser or not profile or profile.role != "DOCENTE":
            raise serializers.ValidationError("La asignación solo puede vincular usuarios docentes.")
        if not value.is_active:
            raise serializers.ValidationError("No se puede asignar un docente inactivo.")
        return value

    def validate(self, attrs):
        docente = attrs.get("docente")
        espacio_curricular = attrs.get("espacio_curricular")
        vigente_desde = attrs.get("vigente_desde")
        vigente_hasta = attrs.get("vigente_hasta")

        if self.instance is not None:
            docente = attrs.get("docente", self.instance.docente)
            espacio_curricular = attrs.get("espacio_curricular", self.instance.espacio_curricular)
            vigente_desde = attrs.get("vigente_desde", self.instance.vigente_desde)
            vigente_hasta = attrs.get("vigente_hasta", self.instance.vigente_hasta)

        if vigente_hasta and vigente_desde and vigente_desde > vigente_hasta:
            raise serializers.ValidationError(
                {"vigente_hasta": "La fecha hasta no puede ser anterior a la fecha desde."}
            )

        if docente and espacio_curricular and vigente_desde:
            upper_bound = vigente_hasta or date.max
            overlaps = AsignacionDocente.objects.filter(
                docente=docente,
                espacio_curricular=espacio_curricular,
                vigente_desde__lte=upper_bound,
            ).filter(
                models.Q(vigente_hasta__isnull=True)
                | models.Q(vigente_hasta__gte=vigente_desde)
            )
            if self.instance is not None:
                overlaps = overlaps.exclude(pk=self.instance.pk)

            overlapping = overlaps.first()
            if overlapping:
                raise serializers.ValidationError(
                    {
                        "vigente_desde": (
                            "Esta asignación se solapa con una existente "
                            f"({overlapping.vigente_desde} - "
                            f"{overlapping.vigente_hasta or 'actualidad'})."
                        )
                    }
                )

        return attrs


class ProgramaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Programa
        fields = ["id", "plan_estudio_ec", "anio_academico", "descripcion"]


class UnidadSerializer(serializers.ModelSerializer):
    competencias = serializers.SerializerMethodField()

    class Meta:
        model = Unidad
        fields = [
            "id",
            "programa",
            "numero",
            "descripcion",
            "competencias",
        ]

    def get_competencias(self, obj):
        relaciones = obj.competencias_rel.select_related("competencia").order_by("orden", "id")
        return [
            {
                "id": rel.id,
                "orden": rel.orden,
                "competencia": CompetenciaSerializer(rel.competencia).data,
            }
            for rel in relaciones
        ]


class UnidadCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unidad
        fields = [
            "id",
            "programa",
            "numero",
            "descripcion",
        ]

    def validate_programa(self, value: Programa):
        if not value.activo:
            raise serializers.ValidationError("El programa seleccionado está dado de baja.")
        request = self.context.get("request")
        if request and not _docente_asignado(request.user, value.plan_estudio_ec.espacio_curricular_id, request.session):
            raise serializers.ValidationError("No tienes asignado este espacio curricular.")
        return value


class UnidadUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unidad
        fields = ["numero", "descripcion"]


class ProgramaCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Programa
        fields = ["id", "plan_estudio_ec", "anio_academico", "descripcion"]

    def validate_plan_estudio_ec(self, value: PlanEstudioEC):
        request = self.context.get("request")
        if request and not _docente_asignado(request.user, value.espacio_curricular_id, request.session):
            raise serializers.ValidationError("No tienes asignado este espacio curricular.")
        return value


class ProgramaUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Programa
        fields = ["anio_academico", "descripcion"]


class ActividadSerializer(serializers.ModelSerializer):
    unidad_ids = serializers.PrimaryKeyRelatedField(
        source="unidades",
        many=True,
        read_only=True,
    )
    es_ip = serializers.SerializerMethodField()
    es_ta = serializers.SerializerMethodField()
    tiene_ajustes = serializers.SerializerMethodField()

    class Meta:
        model = Actividad
        fields = [
            "id",
            "programa",
            "tipo_actividad",
            "descripcion",
            "horas",
            "modalidad_trabajo",
            "unidad_ids",
            "clase_calendario",
            "fecha_inicio_ta",
            "fecha_fin_ta",
            "es_ip",
            "es_ta",
            "tiene_ajustes",
        ]

    def get_es_ip(self, obj: Actividad) -> bool:
        return obj.tipo_actividad.tipo_dedicacion == TipoActividad.TipoDedicacion.INTERACCION_PEDAGOGICA

    def get_es_ta(self, obj: Actividad) -> bool:
        return obj.tipo_actividad.tipo_dedicacion == TipoActividad.TipoDedicacion.TRABAJO_AUTONOMO

    def get_tiene_ajustes(self, obj: Actividad) -> bool:
        return obj.ajustes.exists()


class ActividadCreateSerializer(serializers.ModelSerializer):
    unidad_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
        write_only=True,
    )

    class Meta:
        model = Actividad
        fields = [
            "id",
            "programa",
            "tipo_actividad",
            "descripcion",
            "horas",
            "modalidad_trabajo",
            "unidad_ids",
            "clase_calendario",
            "fecha_inicio_ta",
            "fecha_fin_ta",
        ]
        extra_kwargs = {
            "tipo_actividad": {"required": False},
        }

    def validate_programa(self, value: Programa):
        if not value.activo:
            raise serializers.ValidationError("El programa seleccionado está dado de baja.")
        request = self.context.get("request")
        if request and not _docente_asignado(request.user, value.plan_estudio_ec.espacio_curricular_id, request.session):
            raise serializers.ValidationError("No tienes asignado este espacio curricular.")
        return value

    def validate(self, attrs):
        programa = attrs.get("programa")
        unidad_ids = attrs.get("unidad_ids", [])

        if not programa:
            return attrs

        tipo_actividad = attrs.get("tipo_actividad")
        clase_calendario = attrs.get("clase_calendario")
        fecha_inicio_ta = attrs.get("fecha_inicio_ta")
        fecha_fin_ta = attrs.get("fecha_fin_ta")
        horas = attrs.get("horas")

        if tipo_actividad and tipo_actividad.tipo_dedicacion == TipoActividad.TipoDedicacion.INTERACCION_PEDAGOGICA:
            if clase_calendario is None:
                raise serializers.ValidationError(
                    {"clase_calendario": "Las actividades IP deben vincularse a una clase del calendario."}
                )
            if clase_calendario.programa_id != programa.id:
                raise serializers.ValidationError(
                    {"clase_calendario": "La clase elegida no pertenece al programa seleccionado."}
                )
            dias_validos = set(
                programa.dias_clase.filter(activo=True).values_list("dia_semana", flat=True)
            )
            if dias_validos and clase_calendario.fecha.weekday() not in dias_validos:
                raise serializers.ValidationError(
                    {"clase_calendario": "La fecha elegida no coincide con los dias de clase del programa."}
                )
            if fecha_inicio_ta or fecha_fin_ta:
                raise serializers.ValidationError(
                    {"fecha_inicio_ta": "Las actividades IP no usan rango de fechas TA."}
                )
            _validate_ip_hours_within_class_duration(
                programa=programa,
                tipo_actividad=tipo_actividad,
                clase_calendario=clase_calendario,
                horas=horas,
            )
        else:
            if clase_calendario is not None:
                raise serializers.ValidationError(
                    {"clase_calendario": "Las actividades TA no deben vincularse a una clase de calendario."}
                )
            if fecha_inicio_ta and fecha_fin_ta and fecha_inicio_ta > fecha_fin_ta:
                raise serializers.ValidationError(
                    {"fecha_fin_ta": "La fecha de fin no puede ser anterior a la fecha de inicio."}
                )

        unidades_validas = set(
            Unidad.objects.filter(
                id__in=unidad_ids,
                programa=programa,
                activo=True,
            ).values_list("id", flat=True)
        )
        if len(unidades_validas) != len(set(unidad_ids)):
            raise serializers.ValidationError(
                {"unidad_ids": "Todas las unidades deben pertenecer al programa seleccionado."}
            )
        return attrs

    def create(self, validated_data):
        unidad_ids = validated_data.pop("unidad_ids", [])
        actividad = Actividad.objects.create(**validated_data)
        actividad.unidades.set(unidad_ids)
        return actividad


class ActividadUpdateSerializer(serializers.ModelSerializer):
    unidad_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
        write_only=True,
        required=False,
    )

    class Meta:
        model = Actividad
        fields = [
            "tipo_actividad",
            "descripcion",
            "horas",
            "modalidad_trabajo",
            "unidad_ids",
            "clase_calendario",
            "fecha_inicio_ta",
            "fecha_fin_ta",
        ]
        extra_kwargs = {
            "tipo_actividad": {"required": False},
        }

    def validate(self, attrs):
        actividad = self.instance

        tipo_actividad = attrs.get("tipo_actividad", actividad.tipo_actividad)
        clase_calendario = attrs.get("clase_calendario", actividad.clase_calendario)
        fecha_inicio_ta = attrs.get("fecha_inicio_ta", actividad.fecha_inicio_ta)
        fecha_fin_ta = attrs.get("fecha_fin_ta", actividad.fecha_fin_ta)
        horas = attrs.get("horas", actividad.horas)

        if tipo_actividad and tipo_actividad.tipo_dedicacion == TipoActividad.TipoDedicacion.INTERACCION_PEDAGOGICA:
            if clase_calendario is None:
                raise serializers.ValidationError(
                    {"clase_calendario": "Las actividades IP deben vincularse a una clase del calendario."}
                )
            if clase_calendario.programa_id != actividad.programa_id:
                raise serializers.ValidationError(
                    {"clase_calendario": "La clase elegida no pertenece al programa de la actividad."}
                )
            dias_validos = set(
                actividad.programa.dias_clase.filter(activo=True).values_list("dia_semana", flat=True)
            )
            if dias_validos and clase_calendario.fecha.weekday() not in dias_validos:
                raise serializers.ValidationError(
                    {"clase_calendario": "La fecha elegida no coincide con los dias de clase del programa."}
                )
            if fecha_inicio_ta or fecha_fin_ta:
                raise serializers.ValidationError(
                    {"fecha_inicio_ta": "Las actividades IP no usan rango de fechas TA."}
                )
            _validate_ip_hours_within_class_duration(
                programa=actividad.programa,
                tipo_actividad=tipo_actividad,
                clase_calendario=clase_calendario,
                horas=horas,
                instance=actividad,
            )
        else:
            if clase_calendario is not None:
                raise serializers.ValidationError(
                    {"clase_calendario": "Las actividades TA no deben vincularse a una clase de calendario."}
                )
            if fecha_inicio_ta and fecha_fin_ta and fecha_inicio_ta > fecha_fin_ta:
                raise serializers.ValidationError(
                    {"fecha_fin_ta": "La fecha de fin no puede ser anterior a la fecha de inicio."}
                )

        unidad_ids = attrs.get("unidad_ids")
        if unidad_ids is None:
            return attrs

        unidades_validas = set(
            Unidad.objects.filter(
                id__in=unidad_ids,
                programa=actividad.programa,
                activo=True,
            ).values_list("id", flat=True)
        )
        if len(unidades_validas) != len(set(unidad_ids)):
            raise serializers.ValidationError(
                {"unidad_ids": "Todas las unidades deben pertenecer al programa de la actividad."}
            )
        return attrs

    def update(self, instance, validated_data):
        unidad_ids = validated_data.pop("unidad_ids", None)
        instance = super().update(instance, validated_data)
        if unidad_ids is not None:
            instance.unidades.set(unidad_ids)
        return instance


class UnidadCompetenciaSerializer(serializers.ModelSerializer):
    competencia_detail = CompetenciaSerializer(source="competencia", read_only=True)

    class Meta:
        model = UnidadCompetencia
        fields = ["id", "competencia", "competencia_detail", "orden"]


class UnidadCompetenciaAssignSerializer(serializers.Serializer):
    competencia_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=True,
    )

    def validate_competencia_ids(self, value):
        unidad: Unidad = self.context["unidad"]
        expected_plan_id = unidad.programa.plan_estudio_ec.plan_estudio_id
        valid_ids = set(
            Competencia.objects.filter(
                id__in=value,
                plan_estudio_id=expected_plan_id,
                activo=True,
            ).values_list("id", flat=True)
        )
        if len(valid_ids) != len(set(value)):
            raise serializers.ValidationError(
                "Todas las competencias deben pertenecer al plan de estudio del programa."
            )
        return value

    def save(self, **kwargs):
        unidad: Unidad = self.context["unidad"]
        competencia_ids = self.validated_data.get("competencia_ids", [])
        UnidadCompetencia.objects.filter(unidad=unidad).delete()
        for orden, competencia_id in enumerate(competencia_ids, start=1):
            UnidadCompetencia.objects.create(
                unidad=unidad,
                competencia_id=competencia_id,
                orden=orden,
            )
        return unidad


class DiaClaseProgramaSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiaClasePrograma
        fields = ["id", "programa", "dia_semana", "hora_inicio", "hora_fin", "activo"]

    def validate_programa(self, value: Programa):
        if not value.activo:
            raise serializers.ValidationError("El programa seleccionado está dado de baja.")

        request = self.context.get("request")
        if request and not _docente_asignado(request.user, value.plan_estudio_ec.espacio_curricular_id, request.session):
            raise serializers.ValidationError("No tienes asignado este espacio curricular.")
        return value

    def validate(self, attrs):
        hora_inicio = attrs.get("hora_inicio")
        hora_fin = attrs.get("hora_fin")

        if self.instance is not None:
            hora_inicio = attrs.get("hora_inicio", self.instance.hora_inicio)
            hora_fin = attrs.get("hora_fin", self.instance.hora_fin)

        if bool(hora_inicio) != bool(hora_fin):
            raise serializers.ValidationError(
                {
                    "hora_fin": (
                        "Debes completar hora de inicio y hora de fin, "
                        "o dejar ambas vacías."
                    )
                }
            )

        if hora_inicio and hora_fin and hora_inicio >= hora_fin:
            raise serializers.ValidationError(
                {"hora_fin": "La hora de fin debe ser posterior a la hora de inicio."}
            )

        return attrs


class ClaseCalendarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClaseCalendario
        fields = ["id", "programa", "dia_clase", "fecha", "estado", "observaciones"]


class ClaseCalendarioGeneracionSerializer(serializers.Serializer):
    programa_id = serializers.IntegerField(min_value=1)
    fecha_desde = serializers.DateField()
    fecha_hasta = serializers.DateField()
    sobrescribir = serializers.BooleanField(default=False)

    def validate(self, attrs):
        if attrs["fecha_desde"] > attrs["fecha_hasta"]:
            raise serializers.ValidationError(
                {"fecha_hasta": "La fecha hasta no puede ser anterior a fecha desde."}
            )
        return attrs


class ActividadAjusteSerializer(serializers.ModelSerializer):
    creado_por_username = serializers.CharField(source="creado_por.username", read_only=True)

    class Meta:
        model = ActividadAjuste
        fields = [
            "id",
            "actividad",
            "tipo",
            "motivo",
            "horas_ip_extra",
            "fecha_evento",
            "clase_destino",
            "creado_por",
            "creado_por_username",
            "creado_en",
        ]
        read_only_fields = ["creado_por", "creado_en", "creado_por_username"]


class ActividadAjusteCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActividadAjuste
        fields = ["tipo", "motivo", "horas_ip_extra", "fecha_evento", "clase_destino"]

    def validate(self, attrs):
        actividad: Actividad = self.context["actividad"]
        clase_destino = attrs.get("clase_destino")
        if clase_destino and clase_destino.programa_id != actividad.programa_id:
            raise serializers.ValidationError(
                {"clase_destino": "La clase destino no pertenece al programa de la actividad."}
            )
        if (
            attrs.get("tipo") == ActividadAjuste.Tipo.EXTENSION
            and attrs.get("horas_ip_extra", 0) <= 0
        ):
            raise serializers.ValidationError(
                {"horas_ip_extra": "Para extension, las horas IP extra deben ser mayores a 0."}
            )
        return attrs

    def create(self, validated_data):
        actividad: Actividad = self.context["actividad"]
        user = self.context["request"].user
        return ActividadAjuste.objects.create(
            actividad=actividad,
            creado_por=user,
            **validated_data,
        )
