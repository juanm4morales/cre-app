from django.contrib import admin


# from .models import ...
from .models import (
    UnidadAcademica,
    ConfiguracionCRE,
    Carrera,
    PlanEstudio,
    EspacioCurricular,
    PlanEstudioEC,
    Competencia,
)
# Register your models here.

@admin.register(UnidadAcademica)
class FacultadAdmin(admin.ModelAdmin):
    list_display = ('sigla', 'nombre')
    search_fields = ('sigla', 'nombre')
    
@admin.register(Carrera)
class CarreraAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'nombre', 'unidad_academica', 'nivel')
    list_filter = ('unidad_academica', 'nivel')
    search_fields = ('codigo', 'nombre')

@admin.register(ConfiguracionCRE)
class ConfiguracionCREAdmin(admin.ModelAdmin):
    list_display = ('horas_por_cre', 'actualizado_en')
    
    def has_add_permission(self, request):
        # Only allow one instance (singleton)
        return not ConfiguracionCRE.objects.exists()
    
    def has_delete_permission(self, request, obj=None):
        # Don't allow deletion of the configuration
        return False
    
@admin.register(PlanEstudio)
class PlanEstudioAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'carrera', 'vigente_desde', 'vigente_hasta', 'creditos')
    list_filter = ('carrera',) 
    search_fields = ('nombre',)
    

# Inline para asociar Planes de Estudio a un Espacio Curricular
class PlanEstudioECInline(admin.TabularInline):
    model = PlanEstudioEC
    extra = 1
    autocomplete_fields = ['plan_estudio']

@admin.register(EspacioCurricular)
class EspacioCurricularAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'codigo', 'creditos')
    search_fields = ('nombre', 'codigo')
    inlines = [PlanEstudioECInline]


@admin.register(Competencia)
class CompetenciaAdmin(admin.ModelAdmin):
    list_display = ("codigo", "nombre", "plan_estudio", "activo")
    list_filter = ("plan_estudio", "activo")
    search_fields = ("codigo", "nombre")
