# Migración: AsignacionDocente con Temporalidad

## Cambio Implementado

Se reemplazó el campo booleano `activo` por campos de temporalidad explícita en el modelo `AsignacionDocente`.

### Antes

```python
class AsignacionDocente(models.Model):
    docente = models.ForeignKey(...)
    espacio_curricular = models.ForeignKey(...)
    categoria = models.CharField(...)
    activo = models.BooleanField(default=True)  # ❌ Limitante
    
    class Meta:
        constraints = [
            # ❌ Impide múltiples asignaciones al mismo EC
            models.UniqueConstraint(
                fields=('docente', 'espacio_curricular'),
                name='unique_asignacion_docente'
            )
        ]
```

**Problema:** Un docente no podía tener múltiples asignaciones al mismo espacio curricular en diferentes períodos.

### Ahora

```python
class AsignacionDocente(models.Model):
    docente = models.ForeignKey(...)
    espacio_curricular = models.ForeignKey(...)
    categoria = models.CharField(...)
    vigente_desde = models.DateField()  # ✅ Temporalidad explícita
    vigente_hasta = models.DateField(null=True, blank=True)  # NULL = vigente actual
    
    @property
    def activo(self) -> bool:
        """Compatibilidad: retorna True si está vigente hoy."""
        hoy = timezone.now().date()
        return self.vigente_desde <= hoy and (self.vigente_hasta is None or hoy <= self.vigente_hasta)
    
    def esta_vigente(self, fecha=None) -> bool:
        """Verifica si está vigente en una fecha específica."""
        if fecha is None:
            fecha = timezone.now().date()
        return self.vigente_desde <= fecha and (self.vigente_hasta is None or fecha <= self.vigente_hasta)
    
    class Meta:
        indexes = [
            models.Index(fields=['docente', 'vigente_desde', 'vigente_hasta']),
        ]
        constraints = [
            # ✅ Solo valida que vigente_hasta >= vigente_desde
            models.CheckConstraint(
                condition=Q(vigente_hasta__isnull=True) | Q(vigente_hasta__gte=F('vigente_desde')),
                name='valid_date_range'
            )
        ]
```

---

## Beneficios

### 1. **Múltiples Asignaciones en el Tiempo**

```python
# Ejemplo: Docente enseñó Álgebra I en 2023, luego en 2025
AsignacionDocente.objects.create(
    docente=prof_garcia,
    espacio_curricular=algebra_i,
    categoria='TIT',
    vigente_desde='2023-03-01',
    vigente_hasta='2023-12-15'  # Finalizó este período
)

AsignacionDocente.objects.create(
    docente=prof_garcia,
    espacio_curricular=algebra_i,
    categoria='ADJ',  # Cambió de categoría
    vigente_desde='2025-03-01',
    vigente_hasta=None  # Actualmente vigente
)
```

### 2. **Histórico Completo**

```python
# Ver todas las asignaciones de un docente a un EC (histórico completo)
AsignacionDocente.objects.filter(
    docente=prof_garcia,
    espacio_curricular=algebra_i
).order_by('-vigente_desde')

# Ver solo las asignaciones actualmente vigentes
hoy = timezone.now().date()
AsignacionDocente.objects.filter(
    docente=prof_garcia,
    vigente_desde__lte=hoy
).filter(
    Q(vigente_hasta__isnull=True) | Q(vigente_hasta__gte=hoy)
)
```

### 3. **Consultas por Fecha Específica**

```python
# ¿Quién enseñaba Álgebra I el 15 de mayo de 2024?
fecha = date(2024, 5, 15)
AsignacionDocente.objects.filter(
    espacio_curricular=algebra_i,
    vigente_desde__lte=fecha
).filter(
    Q(vigente_hasta__isnull=True) | Q(vigente_hasta__gte=fecha)
)
```

---

## Compatibilidad Retroactiva

### Property `activo`

El código existente que usa `.filter(activo=True)` **NO funcionará** automáticamente. Se actualizaron todos los lugares:

**Antes:**
```python
AsignacionDocente.objects.filter(docente=user, activo=True)
```

**Ahora:**
```python
hoy = timezone.now().date()
AsignacionDocente.objects.filter(
    docente=user,
    vigente_desde__lte=hoy
).filter(
    Q(vigente_hasta__isnull=True) | Q(vigente_hasta__gte=hoy)
)
```

**Property para objetos individuales:**
```python
asignacion = AsignacionDocente.objects.first()
if asignacion.activo:  # ✅ Funciona (property)
    print("Asignación vigente")
```

---

## Archivos Modificados

- **Modelo:** [backend/planning/models.py](backend/planning/models.py#L46-L116)
- **Views:** [backend/planning/views.py](backend/planning/views.py#L11-L20)
- **Serializers:** [backend/planning/serializers.py](backend/planning/serializers.py#L6-L16)
- **ViewSets:** [backend/planning/viewsets.py](backend/planning/viewsets.py#L4-L15)
- **Admin:** [backend/planning/admin.py](backend/planning/admin.py#L6-L14)
- **Migración:** [backend/planning/migrations/0003_change_asignacion_temporal.py](backend/planning/migrations/0003_change_asignacion_temporal.py)

---

## Admin: Nuevas Columnas

El admin ahora muestra:
- `vigente_desde` - Fecha de inicio
- `vigente_hasta` - Fecha de fin (NULL = vigente actual)
- `estado_actual` - ✓ Vigente / ✗ Inactiva

Filtros:
- Por categoría docente
- Por fecha de inicio (`date_hierarchy`)

---

## Casos de Uso

### Crear Asignación Nueva (Vigente Actual)
```python
AsignacionDocente.objects.create(
    docente=user,
    espacio_curricular=ec,
    categoria='TIT',
    vigente_desde=timezone.now().date(),
    vigente_hasta=None  # Vigente indefinidamente
)
```

### Finalizar Asignación
```python
asignacion = AsignacionDocente.objects.get(id=123)
asignacion.vigente_hasta = timezone.now().date()
asignacion.save()
```

### Verificar Vigencia
```python
# En una fecha específica
if asignacion.esta_vigente(fecha=date(2024, 6, 1)):
    print("Estaba vigente en junio 2024")

# Hoy (usa property)
if asignacion.activo:
    print("Vigente actualmente")
```

---

## Validaciones

### 1. CheckConstraint a nivel DB
- `vigente_hasta` debe ser NULL o >= `vigente_desde`
- Django valida esto antes de guardar
- PostgreSQL también lo valida por si se modifica directamente

```python
# ❌ Esto fallará
asignacion = AsignacionDocente(
    ...,
    vigente_desde=date(2024, 6, 1),
    vigente_hasta=date(2024, 1, 1)  # Error: hasta < desde
)
asignacion.save()  # django.db.utils.IntegrityError
```

### 2. Validación de Solapamiento (clean method)
Previene que un docente tenga múltiples asignaciones vigentes simultáneas al mismo espacio curricular:

```python
def clean(self):
    """Validate that there are no overlapping assignments for the same teacher and course."""
    # Busca asignaciones solapadas
    # Dos rangos se solapan si: A_desde <= B_hasta Y B_desde <= A_hasta
    
    vigente_hasta_comparacion = self.vigente_hasta if self.vigente_hasta else date.max
    
    solapamientos = AsignacionDocente.objects.filter(
        docente=self.docente,
        espacio_curricular=self.espacio_curricular,
        vigente_desde__lte=vigente_hasta_comparacion
    ).filter(
        Q(vigente_hasta__isnull=True) | Q(vigente_hasta__gte=self.vigente_desde)
    )
    
    if self.pk:  # Excluir el registro actual al editar
        solapamientos = solapamientos.exclude(pk=self.pk)
    
    if solapamientos.exists():
        raise ValidationError({
            'vigente_desde': 'Esta asignación se solapa con una asignación existente...'
        })
```

**Casos que previene:**
```python
# ❌ Esto fallará: Asignación solapada
# Asignación 1: 2024-03-01 a 2024-12-15
# Asignación 2: 2024-06-01 a 2025-12-15 (se solapa!)
# ValidationError

# ✅ Esto funciona: Sin solapamiento
# Asignación 1: 2024-03-01 a 2024-12-15
# Asignación 2: 2025-03-01 a None (inicia después)
```

---

## Próximos Pasos (Opcional)

### 1. Auditoría Automática
Registrar quién y cuándo modificó las fechas de vigencia (django-simple-history o similar).

### 2. Reportes Históricos
Crear vistas para ver evolución de asignaciones docentes en el tiempo.

### 3. Serializer para API
Si admins necesitan gestionar asignaciones vía API, crear `AsignacionDocenteSerializer` con la misma validación.

---

## Resumen

✅ **Problema resuelto:** Un docente ahora puede tener múltiples asignaciones al mismo espacio curricular en diferentes períodos

✅ **Semántica clara:** `vigente_desde`/`vigente_hasta` es más descriptivo que `activo`

✅ **Histórico completo:** No se pierden datos de asignaciones pasadas

✅ **Queries eficientes:** Índice compuesto para consultas por docente y fechas

✅ **Validación robusta:** CheckConstraint a nivel de base de datos

✅ **Compatibilidad:** Property `activo` para transición gradual
