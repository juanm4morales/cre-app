from django.contrib import admin


from .models import Facultad, ConfiguracionCRE, Carrera, PlanEstudio, EspacioCurricular
# Register your models here.

@admin.register(Facultad)
class FacultadAdmin(admin.ModelAdmin):
    list_display = ('sigla', 'nombre')
    search_fields = ('sigla', 'nombre')
    
@admin.register(Carrera)
class CarreraAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'nombre', 'facultad', 'nivel', 'creditos')
    list_filter = ('facultad', 'nivel')
    search_fields = ('codigo', 'nombre')

@admin.register(ConfiguracionCRE)
class ConfiguracionCREAdmin(admin.ModelAdmin):
    list_display = ('horas_por_cre', 'actualizado_en')
    
@admin.register(PlanEstudio)
class PlanEstudioAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'carrera', 'vigente_desde', 'vigente_hasta')
    list_filter = ('carrera',) 
    search_fields = ('nombre',)
    
@admin.register(EspacioCurricular)
class EspacioCurricularAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'plan_estudio', 'codigo', 'creditos')
    list_filter = ('plan_estudio',)
    search_fields = ('nombre', 'codigo')