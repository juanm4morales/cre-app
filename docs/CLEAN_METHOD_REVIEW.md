# Mejoras al método clean() - AsignacionDocente

**Fecha**: Febrero 2026  
**Status**: ✅ Implementado y Validado  
**Tests**: 7/7 pass (5 originales + 2 nuevos)

---

## Análisis de Buenas Prácticas

### 🔴 Problemas Identificados

#### Antes:
```python
def clean(self):
    """
    Validates that no two assignments overlap...
    """
    vigente_hasta_comparacion = self.vigente_hasta if self.vigente_hasta else date.max
    
    solapamientos = AsignacionDocente.objects.filter(...).filter(...)
    
    if self.pk:
        solapamientos = solapamientos.exclude(pk=self.pk)
    
    if solapamientos.exists():  # ❌ 2 queries: exists() + first()
        solapamiento = solapamientos.first()
        raise ValidationError({...})
```

#### Problemas:
| # | Problema | Severidad | Impacto |
|---|----------|-----------|---------|
| 1 | Sin documentación de ejecutabilidad | 🔴 CRÍTICO | `clean()` NO se ejecuta automáticamente en `.save()` |
| 2 | Falta validación de fechas | 🟡 IMPORTANTE | Permite `vigente_desde > vigente_hasta` |
| 3 | Query ineficiente (exists + first) | 🟡 IMPORTANTE | 2 queries en lugar de 1 |
| 4 | Sin type hints | 🟠 MENOR | Reduce legibilidad |
| 5 | Variable verbose | 🟠 MENOR | `vigente_hasta_comparacion` → `upper_bound` |
| 6 | Docstring incompleto | 🟠 MENOR | No documenta que lanza ValidationError |
| 7 | Lógica de query inline | 🟠 MENOR | Difícil de leer/mantener |

---

## Soluciones Implementadas

### ✅ #1: Documentación y Garantizar Ejecución

**Problema**: Django NO llama `clean()` automáticamente en `.save()`.

```python
# ❌ ANTES: Nunca se ejecutaba
asig = AsignacionDocente(...)
asig.save()  # ValidationError nunca lanzado!

# ✅ DESPUÉS: Se ejecuta en admin
# backend/planning/admin.py
class AsignacionDocenteAdmin(admin.ModelAdmin):
    def save_model(self, request, obj, form, change):
        obj.full_clean()  # Calls model.clean() + field validation
        super().save_model(request, obj, form, change)
```

**Docstring mejorado**:
```python
def clean(self) -> None:
    """
    Validate assignment consistency at model level.
    
    Checks:
    1. vigente_desde <= vigente_hasta (if vigente_hasta is set)
    2. No temporal overlaps with other assignments to same course
    
    Raises:
        ValidationError: If validation fails
        
    IMPORTANT: This method is NOT called automatically by .save().
               Must be called explicitly via full_clean() or in views.
               Admin: Register model in admin.py for automatic calling.
               Views: Call instance.full_clean() before .save().
    """
```

---

### ✅ #2: Validación de Fechas

**Antes**: Permitía `vigente_desde > vigente_hasta`

```python
# ❌ Permitía esto:
AsignacionDocente(
    vigente_desde=date(2025, 12, 31),
    vigente_hasta=date(2025, 1, 1)  # INVÁLIDO pero aceptado!
)
```

**Después**: Valida consistencia de fechas PRIMERO

```python
# ✅ Ahora valida:
errors = {}

# Validation 1: Date logic check
if self.vigente_hasta and self.vigente_desde > self.vigente_hasta:
    errors['vigente_hasta'] = (
        'La fecha de fin (vigente_hasta) no puede ser anterior a '
        'la fecha de inicio (vigente_desde).'
    )

# Validation 2: Only check overlaps if dates are valid
if not errors:
    overlapping = self._find_overlapping_assignment()
    if overlapping:
        errors['vigente_desde'] = (...)
        
if errors:
    raise ValidationError(errors)
```

**Test agregado**:
```python
def test_date_logic_validation_vigente_desde_after_vigente_hasta(self):
    """Test that vigente_desde cannot be after vigente_hasta."""
    asig = AsignacionDocente(
        vigente_desde=date(2025, 12, 31),
        vigente_hasta=date(2025, 1, 1)
    )
    with self.assertRaises(ValidationError) as context:
        asig.full_clean()
    self.assertIn('vigente_hasta', context.exception.error_dict)
```

---

### ✅ #3: Performance - Reducir Queries

**Antes**: 2 queries en el `if` final
```python
if solapamientos.exists():           # Query 1
    solapamiento = solapamientos.first()  # Query 2
```

**Después**: 1 query mediante helper privado
```python
def _find_overlapping_assignment(self) -> "AsignacionDocente | None":
    """Private helper: Find an existing overlapping assignment."""
    upper_bound = self.vigente_hasta or date.max
    
    overlaps = AsignacionDocente.objects.filter(
        docente=self.docente,
        espacio_curricular=self.espacio_curricular,
        vigente_desde__lte=upper_bound
    ).filter(
        models.Q(vigente_hasta__isnull=True) | models.Q(vigente_hasta__gte=self.vigente_desde)
    )
    
    if self.pk:
        overlaps = overlaps.exclude(pk=self.pk)
    
    return overlaps.first()  # Single query, returns obj or None

# En clean():
overlapping = self._find_overlapping_assignment()
if overlapping:
    errors['vigente_desde'] = (...)
```

**Beneficios**:
- ✅ 1 query en lugar de 2
- ✅ Lógica centralizada (reutilizable, testeable)
- ✅ Mejor legibilidad del método principal

---

### ✅ #4: Type Hints Agregados

```python
def _find_overlapping_assignment(self) -> "AsignacionDocente | None":
    """Private helper: Find an existing overlapping assignment."""
    ...

def clean(self) -> None:
    """Validate assignment consistency at model level."""
    ...
```

---

### ✅ #5: Nombres de Variables Mejorados

```python
# Antes
vigente_hasta_comparacion = self.vigente_hasta if self.vigente_hasta else date.max

# Después
upper_bound = self.vigente_hasta or date.max
```

---

### ✅ #6: Estructura y Legibilidad

**Antes**: Todo inline en `clean()`
```python
def clean(self):
    vigente_hasta_comparacion = ...
    solapamientos = AsignacionDocente.objects.filter(...).filter(...)
    if self.pk:
        solapamientos = solapamientos.exclude(pk=self.pk)
    if solapamientos.exists():
        solapamiento = solapamientos.first()
        raise ValidationError({...})
```

**Después**: Separado en helper + lógica clara en clean()
```python
def _find_overlapping_assignment(self) -> "AsignacionDocente | None":
    """Private helper: Find an existing overlapping assignment."""
    # Query logic with docstring

def clean(self) -> None:
    """Validate assignment consistency at model level."""
    errors = {}
    
    # Validation 1: Date logic
    if self.vigente_hasta and self.vigente_desde > self.vigente_hasta:
        errors['vigente_hasta'] = (...)
    
    # Validation 2: Temporal overlaps
    if not errors:
        overlapping = self._find_overlapping_assignment()
        if overlapping:
            errors['vigente_desde'] = (...)
    
    if errors:
        raise ValidationError(errors)
```

**Beneficios**:
- ✅ Método principal legible en 10 líneas
- ✅ Cada validación es independiente
- ✅ Fácil agregar/quitar validaciones

---

## Validación Comparativa

### Tests Antes y Después

| Test | Antes | Después | Estado |
|------|-------|---------|--------|
| Sequential assignments (no overlap) | ✅ Pass | ✅ Pass | No regresión |
| Overlap raises error | ✅ Pass | ✅ Pass | No regresión |
| Open-ended overlap | ✅ Pass | ✅ Pass | No regresión |
| Different courses allowed | ✅ Pass | ✅ Pass | No regresión |
| Edit without self-overlap | ✅ Pass | ✅ Pass | No regresión |
| Date logic: from > to | ❌ N/A | ✅ Pass | **NUEVO** |
| Date logic: same day allowed | ❌ N/A | ✅ Pass | **NUEVO** |

```bash
$ python manage.py test planning.tests.AsignacionDocenteOverlapTestCase -v 2
Ran 7 tests in 1.672s
OK ✅
```

---

## Archivos Modificados

### 1. [backend/planning/models.py](backend/planning/models.py)
- Agregó método `_find_overlapping_assignment()` - helper privado
- Refactorizó `clean()` con validación de fechas + mejor estructura
- Type hints: `-> "AsignacionDocente | None"` y `-> None`
- Mejoró docstring con detalles de ejecución

### 2. [backend/planning/admin.py](backend/planning/admin.py)
- Agregó `save_model()` override en `AsignacionDocenteAdmin`
- Garantiza que `full_clean()` se invoca antes de `.save()`
- Comentarios explicativos

### 3. [backend/planning/tests.py](backend/planning/tests.py)
- Agregó `test_date_logic_validation_vigente_desde_after_vigente_hasta()`
- Agregó `test_date_logic_validation_same_day_allowed()`
- Total: 7 tests (5 originales + 2 nuevos)

---

## Buenas Prácticas Aplicadas (Django + Python)

| Práctica | Descripción | Aplicado |
|----------|-------------|----------|
| Model Validation | `clean()` para validación a nivel modelo | ✅ |
| Admin Integration | `save_model()` override para ejecutar validación | ✅ |
| Helper Methods | Métodos `_private()` para separar concerns | ✅ |
| Type Hints | Return types explícitos en métodos | ✅ |
| Error Accumulation | Acumular errores antes de lanzar | ✅ |
| Code Comments | Comentarios en queries complejas | ✅ |
| DRY Principle | No repetir lógica de overlap detection | ✅ |
| Documentation | Docstrings con ejemplos y caveats | ✅ |
| Testing | Tests para casos límite (same-day, inverted) | ✅ |

---

## Referencias

- [Django Model clean() documentation](https://docs.djangoproject.com/en/6.0/ref/models/instances/#django.db.models.Model.clean)
- [ModelAdmin save_model()](https://docs.djangoproject.com/en/6.0/ref/contrib/admin/#django.contrib.admin.ModelAdmin.save_model)
- [ValidationError](https://docs.djangoproject.com/en/6.0/ref/exceptions/#django.core.exceptions.ValidationError)
- [Type Hints in Python](https://docs.python.org/3/library/typing.html)

---

## Checklist de Validación ✅

- [x] System check: 0 issues
- [x] All 7 tests pass
- [x] Admin can save with validation
- [x] Date logic validated (from ≤ to)
- [x] Overlap detection still works
- [x] Backward compatible (@property activo)
- [x] Type hints added
- [x] Docstring complete with caveats
- [x] Helper method extracted
- [x] Performance improved (1 query vs 2)

---

## Conclusión

El método `clean()` ahora sigue **todas** las buenas prácticas Django:

✅ **Documentado**: Explica que NO se ejecuta automáticamente  
✅ **Integrado**: Admin llama `full_clean()` antes de guardar  
✅ **Validaciones completas**: Fechas + solapamientos  
✅ **Performante**: 1 query en lugar de 2  
✅ **Testeable**: 7 tests cubren casos límite  
✅ **Mantenible**: Código legible con helpers privados  
✅ **Type-safe**: Type hints para IDE autocompletion  

**Listo para producción** ✅
