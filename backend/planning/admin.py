from django.contrib import admin

from .models import AsignacionDocente, TipoActividad, Actividad

# Register your models here.
@admin.register(AsignacionDocente)
class AsignacionDocenteAdmin(admin.ModelAdmin):
    list_display = ('docente', 'espacio_curricular__plan_estudio__carrera', 'categoria')
    list_filter = ('categoria',)
    search_fields = ('docente__username', 'espacio_curricular__nombre')
    
@admin.register(TipoActividad)
class TipoActividadAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'tipo_dedicacion', 'modalidad_trabajo')
    search_fields = ('nombre',)
    
@admin.register(Actividad)
class ActividadAdmin(admin.ModelAdmin):
    list_display = ('asignacion_docente', 'tipo_actividad', 'descripcion', 'horas')
    search_fields = ('asignacion_docente__docente__username', 'descripcion')