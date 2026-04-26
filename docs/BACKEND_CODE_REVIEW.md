# Code Review - Backend Django

**Fecha:** 12 de febrero de 2026  
**Versión:** 1.0  
**Estado:** ✅ MVP Funcional con mejoras sugeridas

---

## 📊 Resumen General

**Puntuación:** 7.5/10

### Fortalezas
- ✅ Estructura clara de modelos con relaciones bien definidas
- ✅ DRF API completamente funcional con 9 endpoints
- ✅ Control de acceso basado en AsignacionDocente (temporal)
- ✅ Validaciones críticas: solapamiento de asignaciones, unicidad de programas
- ✅ Tests de validación (5 tests pass)
- ✅ Seguridad: variables sensibles en .env, CORS/CSRF configurados
- ✅ Migraciones limpias

### Áreas a Mejorar
- ⚠️ Optimización de queries (potencial N+1 en algunas vistas)
- ⚠️ Manejo de errores inconsistente
- ⚠️ Type hints faltantes
- ⚠️ Code style inconsistente (tabs vs spaces)
- ⚠️ Duplicación de lógica temporal en múltiples lugares
- ⚠️ Falta de logging

---

## 🐛 Problemas Identificados

### 1. **CRÍTICO: Indentación inconsistente**
**Archivo:** `backend/planning/views.py`  
**Problema:** Mezcla de tabs y spaces  
**Línea:** 1-321

```python
# ❌ Mal: algunos usan tabs, otros spaces
def _asignacion_docente_qs(user):
	"""docstring con tab"""
	# código con tabs
	
def _programa_accesible_qs(user, ec_id):
	# más tabs
```

**Solución:** Estandarizar a 4 spaces (PEP 8)

---

### 2. **IMPORTANTE: Imports redundantes y mal organizados**
**Archivo:** `backend/planning/views.py` (línea 1-10)  
**Problema:** 
- `timezone` se importa localmente en múltiples funciones
- `models` se importa pero se usa solo en algunas llamadas

```python
# ❌ Mal
from django.db import models  # al inicio
def _asignacion_docente_qs(user):
    from django.utils import timezone  # re-import
```

**Solución:**
```python
# ✅ Bien
from django.utils import timezone
from django.db import models
from django.db.models import Q, Sum
```

---

### 3. **IMPORTANTE: Duplicación de lógica temporal**
**Archivos:** `views.py`, `serializers.py`, `viewsets.py`  
**Problema:** El código para filtrar asignaciones vigentes se repite 4 veces

```python
# Patrón repetido en 3 lugar
hoy = timezone.now().date()
AsignacionDocente.objects.filter(
    docente=user,
    vigente_desde__lte=hoy,
).filter(
    Q(vigente_hasta__isnull=True) | Q(vigente_hasta__gte=hoy)
)
```

**Solución:** Crear manager custom en modelo

```python
# ✅ backend/planning/models.py
class AsignacionDocenteManager(models.Manager):
    def activas(self, fecha=None):
        if fecha is None:
            fecha = timezone.now().date()
        return self.filter(
            vigente_desde__lte=fecha
        ).filter(
            Q(vigente_hasta__isnull=True) | Q(vigente_hasta__gte=fecha)
        )

class AsignacionDocente(models.Model):
    ...
    objects = AsignacionDocenteManager()
```

---

### 4. **IMPORTANTE: N+1 queries en dashboard_ec**
**Archivo:** `backend/planning/views.py` (línea 119-135)  
**Problema:**
```python
programas = Programa.objects.filter(...).prefetch_related('actividades').annotate(...)

if _is_admin_user(request.user):
    for programa in programas:  # Aquí se accede a cada programa
        programa.total_horas = programa.total_horas or 0
```

El loop posterior puede quemar queries adicionales si se accede a relaciones no prefetcheadas.

**Solución:** Usar `select_related()` efectivamente
```python
programas = Programa.objects.filter(...).prefetch_related(
    'actividades'
).select_related('plan_estudio_ec__plan_estudio__carrera')
```

---

### 5. **IMPORTANTE: QuerySet sin caching en funciones**
**Archivo:** `backend/planning/views.py`  
**Problema:** `_asignacion_docente_qs()` se llama 2-3 veces por request

```python
def seleccionar_espacio_curricular(request):
    asignaciones = _asignacion_docente_qs(request.user)  # 1ra llamada
    plan_ec_qs = PlanEstudioEC.objects.filter(
        espacio_curricular_id__in=asignaciones.values_list(...)  # 2da query
    )
    # ...
    if request.method == 'POST':
        # ... validación que llamaría otra vez ???
```

**Solución:** Cachear la queryset estratégicamente
```python
@login_required
def seleccionar_espacio_curricular(request):
    asignaciones_qs = _asignacion_docente_qs(request.user)
    
    # Reusar qs:
    plan_ec_qs = PlanEstudioEC.objects.filter(
        espacio_curricular_id__in=asignaciones_qs.values_list(...)
    )
```

---

### 6. **MODERADO: Type hints faltantes**
**Archivo:** Múltiples  
**Problema:**
```python
# ❌ Sin type hints
def _asignacion_docente_qs(user):
    return AsignacionDocente.objects.filter(...)

def _programa_accesible_qs(user, ec_id):
    return Programa.objects.filter(...).distinct()
```

**Solución (para todo el proyecto):**
```python
# ✅ Con type hints
from django.db.models import QuerySet
from django.contrib.auth.models import User

def _asignacion_docente_qs(user: User) -> QuerySet[AsignacionDocente]:
    ...

def _programa_accesible_qs(user: User, ec_id: int) -> QuerySet[Programa]:
    ...
```

---

### 7. **MODERADO: Validación débil en vistas**
**Archivo:** `backend/planning/views.py`  
**Problema:** No se valida `plan_ec_id` antes de usarlo

```python
def programa_crear(request):
    plan_ec_id = request.session.get('plan_estudio_ec_id')  # ❌ Podría ser None o inválido
    if not plan_ec_id:
        return redirect('seleccionar_ec')
    
    # ✅ Pero no validamos si existe en DB antes de pasar a form
    form = ProgramaForm(request.POST, plan_estudio_ec_id=plan_ec_id)
```

**Solución:**
```python
try:
    plan_ec = PlanEstudioEC.objects.get(id=plan_ec_id)
except PlanEstudioEC.DoesNotExist:
    messages.error(request, "Sesión expirada. Selecciona un espacio curricular.")
    return redirect('seleccionar_ec')
```

---

### 8. **MODERADO: Falta de logging**
**Archivo:** N/A  
**Problema:** No hay logging de operaciones críticas

```python
# ❌ Sin logging
def programa_eliminar(request, pk: int):
    programa = get_object_or_404(...)
    anio = programa.anio_academico
    programa.delete()  # ¿Quién eliminó? ¿Cuándo?
    messages.warning(request, f"Programa {anio} eliminado.")
```

**Solución:**
```python
import logging
logger = logging.getLogger(__name__)

def programa_eliminar(request, pk: int):
    programa = get_object_or_404(...)
    logger.info(f"Usuario {request.user} eliminó programa {programa.id} ({programa.anio_academico})")
    programa.delete()
```

---

### 9. **MENOR: Método `_is_admin_user()` podría fallar silenciosamente**
**Archivo:** `backend/planning/views.py` (línea 46)  
**Problema:**
```python
def _is_admin_user(user) -> bool:
    if user.is_superuser or user.is_staff:
        return True
    profile = getattr(user, "profile", None)  # ✅ Maneja None bien
    return bool(profile and getattr(profile, "role", None) == "ADMIN")
```

Es correcto pero documentación sería útil.

**Solución:** Añadir docstring
```python
def _is_admin_user(user) -> bool:
    """
    Determina si un usuario tiene permisos de administración.
    
    Retorna True si: superuser, is_staff, o perfil tiene role ADMIN.
    Retorna False si no existe perfil (falso negativo, pero seguro).
    """
    ...
```

---

### 10. **MENOR: Admin interface incompleta**
**Archivo:** `backend/planning/admin.py`  
**Problema:** 
- No hay `ProgramaAdmin` registrado (solo a través de relaciones)
- `ActividadAdmin` no muestra total de horas por programa

**Solución:**
```python
@admin.register(Programa)
class ProgramaAdmin(admin.ModelAdmin):
    list_display = ('plan_estudio_ec', 'anio_academico', 'total_actividades', 'total_horas')
    list_filter = ('anio_academico', 'plan_estudio_ec__espacio_curricular')
    search_fields = ('plan_estudio_ec__espacio_curricular__nombre',)
    readonly_fields = ('total_horas',)
    
    def total_actividades(self, obj):
        return obj.actividades.count()
    total_actividades.short_description = "# Actividades"
    
    def total_horas(self, obj):
        from django.db.models import Sum
        total = obj.actividades.aggregate(Sum('horas'))['horas__sum'] or 0
        return f"{total}h"
    total_horas.short_description = "Total Horas"
```

---

## 📋 Checklist de Mejoras Sugeridas

### 🔴 Críticas (Hacer ASAP)
- [ ] Estandarizar indentación a 4 spaces (PEP 8)
- [ ] Criar manager custom para filtrar asignaciones vigentes
- [ ] Eliminar duplicación de lógica temporal

### 🟡 Importantes (Antes de producción)
- [ ] Agregar type hints en todas las funciones
- [ ] Implementar validación de session en vistas
- [ ] Optimizar queries en dashboard_ec con select_related/prefetch_related
- [ ] Agregar logging en operaciones críticas

### 🟢 Menores (Nice to have)
- [ ] Agregar docstrings detallados en funciones helper
- [ ] Implementar ProgramaAdmin en admin interface
- [ ] Agregar caché a querysets repetidas

---

## 📚 Recomendaciones de Arquitectura

### 1. **Crear helpers manager para queries comunes**

```python
# backend/planning/managers.py
from django.db.models import Manager, Q
from django.utils import timezone

class AsignacionDocenteManager(Manager):
    def activas(self, fecha=None):
        """Retorna asignaciones vigentes en fecha."""
        if fecha is None:
            fecha = timezone.now().date()
        return self.filter(
            vigente_desde__lte=fecha
        ).filter(
            Q(vigente_hasta__isnull=True) | Q(vigente_hasta__gte=fecha)
        )

class ProgramaManager(Manager):
    def por_docente(self, user):
        """Retorna programas accesibles para el docente."""
        ec_ids = AsignacionDocente.objects.activas(
            fecha=timezone.now().date()
        ).filter(docente=user).values_list('espacio_curricular_id', flat=True)
        
        return self.filter(
            plan_estudio_ec__espacio_curricular_id__in=ec_ids
        ).select_related(
            'plan_estudio_ec__espacio_curricular',
            'plan_estudio_ec__plan_estudio__carrera'
        )
```

### 2. **Usar ViewSet mixins para permisos**

```python
# En viewsets.py, usar permission_classes
from rest_framework.permissions import IsAuthenticated

class ProgramaViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Programa.objects.por_docente(self.request.user)
```

### 3. **Centralizar lógica de admin en utils**

```python
# backend/planning/utils.py
def get_programa_stats(programa):
    """Calcula estadísticas de horas para un programa."""
    from django.db.models import Sum
    total_horas = programa.actividades.aggregate(Sum('horas'))['horas__sum'] or 0
    cre_horas = programa.plan_estudio_ec.espacio_curricular.creditos * 25
    return {
        'total_horas': total_horas,
        'cre_horas': cre_horas,
        'diferencia': total_horas - cre_horas,
        'porcentaje': (total_horas / cre_horas * 100) if cre_horas else 0,
    }
```

---

## ✅ Configuración Recomendada (production-ready)

### settings.py
```python
# Agregaciones sugeridas:
INSTALLED_APPS += [
    'django_extensions',  # utilities
    'django_filters',     # filtering en API
    'drf_spectacular',    # swagger/openapi docs
]

REST_FRAMEWORK = {
    'DEFAULT_FILTER_BACKENDS': ['django_filters.rest_framework.DjangoFilterBackend'],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'logs' / 'django.log',
        },
    },
    'root': {
        'handlers': ['file'],
        'level': 'INFO',
    },
}
```

---

## 🧪 Tests Sugeridos

```python
# backend/planning/tests.py - Agregar:

# 1. Test de permisos
def test_docente_no_puede_acceder_programa_ajeno(self):
    ...

# 2. Test de N+1 queries
from django.test.utils import override_settings
@override_settings(DEBUG=True)
def test_dashboard_ec_sin_n_plus_1(self):
    with self.assertNumQueries(5):  # Expected count
        self.client.get('/dashboard/')

# 3. Test de logging
def test_programa_delete_logged(self):
    with self.assertLogs('planning.views', level='INFO') as log:
        programa_eliminar(request, pk)
```

---

## 🎯 Plan de Acción

**Prioridad 1 (Esta semana):**
- [ ] Corregir indentación
- [ ] Crear manager para temporal queries
- [ ] Agregar type hints básicos

**Prioridad 2 (Antes de producción):**
- [ ] Validar session data en vistas
- [ ] Implementar logging
- [ ] Tests de permisos

**Prioridad 3 (Post-MVP):**
- [ ] Optimizaciones de query caching
- [ ] Admin interface completa
- [ ] OpenAPI documentation

---

## 📞 Conclusión

El backend está **funcional y seguro para MVP** ✅. Los problemas identificados son principalmente de **optimización y mantenibilidad** a largo plazo, no de corrección de bugs funcionales. 

**Recomendación:** Proceder con deployment y abordar mejoras después de validar con usuarios.

