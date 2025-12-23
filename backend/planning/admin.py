from django.contrib import admin

from .models import AsignacionDocente, TipoActividad, Actividad

# Register your models here.
@admin.register(AsignacionDocente)
class AsignacionDocenteAdmin(admin.ModelAdmin):
    list_display = ('docente', 'espacio_curricular', 'categoria')
    list_filter = ('categoria',)
    search_fields = ('docente__username', 'espacio_curricular__nombre')
    
@admin.register(TipoActividad)
class TipoActividadAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'tipo_dedicacion', 'modalidad_trabajo')
    search_fields = ('nombre',)
    
@admin.register(Actividad)
class ActividadAdmin(admin.ModelAdmin):
    list_display = ('programa', 'modulo', 'tipo_actividad', 'descripcion', 'horas')
    list_filter = ('modulo', 'tipo_actividad')
    search_fields = ('programa__plan_estudio_ec__espacio_curricular__nombre', 'descripcion')