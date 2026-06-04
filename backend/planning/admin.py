from django.contrib import admin
from django.core.exceptions import ValidationError

from .models import (
    Actividad,
    ActividadAjuste,
    AsignacionDocente,
    ClaseCalendario,
    DiaClasePrograma,
    TipoActividad,
    Unidad,
    UnidadCompetencia,
)


@admin.register(AsignacionDocente)
class AsignacionDocenteAdmin(admin.ModelAdmin):
    list_display = ('docente', 'espacio_curricular', 'categoria', 'vigente_desde', 'vigente_hasta', 'estado_actual')
    list_filter = ('categoria', 'vigente_desde')
    search_fields = ('docente__username', 'espacio_curricular__nombre')
    date_hierarchy = 'vigente_desde'
    
    def estado_actual(self, obj):
        return '✓ Vigente' if obj.activo else '✗ Inactiva'
    estado_actual.short_description = 'Estado'
    
    # No override needed - Django Admin handles validation automatically via form.is_valid() → full_clean()
    # CheckConstraint at DB level provides temporal range safety (vigente_desde <= vigente_hasta)
    
@admin.register(TipoActividad)
class TipoActividadAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'tipo_dedicacion')
    search_fields = ('nombre',)
    
@admin.register(Actividad)
class ActividadAdmin(admin.ModelAdmin):
    list_display = (
        'programa',
        'descripcion',
        'tipo_actividad',
        'modalidad_trabajo',
        'horas',
        'clase_calendario',
        'fecha_inicio_ta',
        'fecha_fin_ta',
        'activo',
    )
    list_filter = ('tipo_actividad', 'activo')
    search_fields = ('programa__plan_estudio_ec__espacio_curricular__nombre', 'descripcion')
    filter_horizontal = ('unidades',)


@admin.register(Unidad)
class UnidadAdmin(admin.ModelAdmin):
    list_display = ('programa', 'numero', 'descripcion', 'activo')
    list_filter = ('programa__anio_academico', 'activo')
    search_fields = ('programa__plan_estudio_ec__espacio_curricular__nombre', 'descripcion')


@admin.register(UnidadCompetencia)
class UnidadCompetenciaAdmin(admin.ModelAdmin):
    list_display = ('unidad', 'competencia', 'orden')
    list_filter = ('unidad__programa__anio_academico',)
    search_fields = ('unidad__descripcion', 'competencia__codigo', 'competencia__nombre')


@admin.register(DiaClasePrograma)
class DiaClaseProgramaAdmin(admin.ModelAdmin):
    list_display = ('programa', 'dia_semana', 'hora_inicio', 'hora_fin', 'activo')
    list_filter = ('dia_semana', 'activo')
    search_fields = ('programa__plan_estudio_ec__espacio_curricular__nombre',)


@admin.register(ClaseCalendario)
class ClaseCalendarioAdmin(admin.ModelAdmin):
    list_display = ('programa', 'fecha', 'dia_clase', 'estado')
    list_filter = ('estado',)
    search_fields = ('programa__plan_estudio_ec__espacio_curricular__nombre',)
    date_hierarchy = 'fecha'


@admin.register(ActividadAjuste)
class ActividadAjusteAdmin(admin.ModelAdmin):
    list_display = ('actividad', 'tipo', 'horas_ip_extra', 'fecha_evento', 'creado_por', 'creado_en')
    list_filter = ('tipo', 'creado_en')
    search_fields = ('actividad__descripcion', 'motivo', 'creado_por__username')
