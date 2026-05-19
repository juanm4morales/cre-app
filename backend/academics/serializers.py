from rest_framework import serializers

from .models import (
    Carrera,
    Competencia,
    ConfiguracionCRE,
    EspacioCurricular,
    PlanEstudio,
    PlanEstudioEC,
    UnidadAcademica,
)


class UnidadAcademicaSerializer(serializers.ModelSerializer):
    class Meta:
        model = UnidadAcademica
        fields = ["id", "nombre", "sigla"]


class CarreraSerializer(serializers.ModelSerializer):
    class Meta:
        model = Carrera
        fields = ["id", "nombre", "codigo", "unidad_academica", "nivel"]


class ConfiguracionCRESerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfiguracionCRE
        fields = ["id", "horas_por_cre", "actualizado_en"]


class PlanEstudioSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanEstudio
        fields = [
            "id",
            "carrera",
            "nombre",
            "ordenanza",
            "descripcion",
            "creditos",
            "vigente_desde",
            "vigente_hasta",
        ]

    def validate(self, attrs):
        vigente_desde = attrs.get("vigente_desde")
        vigente_hasta = attrs.get("vigente_hasta")

        if self.instance is not None:
            vigente_desde = attrs.get("vigente_desde", self.instance.vigente_desde)
            vigente_hasta = attrs.get("vigente_hasta", self.instance.vigente_hasta)

        if vigente_desde and vigente_hasta and vigente_desde > vigente_hasta:
            raise serializers.ValidationError(
                {"vigente_hasta": "La fecha hasta no puede ser anterior a la fecha desde."}
            )

        return attrs


class PlanEstudioECSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanEstudioEC
        fields = ["id", "plan_estudio", "espacio_curricular"]


class EspacioCurricularSerializer(serializers.ModelSerializer):
    class Meta:
        model = EspacioCurricular
        fields = [
            "id",
            "codigo",
            "nombre",
            "tipo_espacio",
            "anio_cursada",
            "periodo",
            "creditos",
            "horas_ip",
            "horas_ta",
        ]


class CompetenciaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Competencia
        fields = ["id", "plan_estudio", "codigo", "nombre", "descripcion", "activo"]
