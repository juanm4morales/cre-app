# Backend Improvements - February 2026

## Resumen de Correcciones y Mejoras

### 🔒 Seguridad

#### 1. Configuración por Variables de Entorno
- **Antes:** `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS` hardcodeados en settings.py
- **Ahora:** Todas las variables sensibles se cargan desde `.env`
- **Archivos:** 
  - [backend/config/settings.py](backend/config/settings.py#L24-L30)
  - [backend/.env.example](backend/.env.example) (template para nuevos entornos)

#### 2. CORS y CSRF Configurados
- **Antes:** CORS básico sin CSRF_TRUSTED_ORIGINS
- **Ahora:** CORS y CSRF configurables por entorno con soporte para frontend separado
- **Archivo:** [backend/config/settings.py](backend/config/settings.py#L149-L162)

#### 3. Control de Acceso Reforzado
- **Antes:** Edición/eliminación de Programa/Actividad solo por `pk`, permitiendo acceso no autorizado
- **Ahora:** Filtrado por asignaciones del docente (`AsignacionDocente.activo=True`)
- **Archivo:** [backend/planning/views.py](backend/planning/views.py#L11-L33)

---

### 🔧 Correcciones Funcionales

#### 4. UserProfile Model Creado
- **Problema:** Admin registraba `UserProfile` inexistente, causando error al cargar
- **Solución:** Modelo creado con roles (ADMIN/DOCENTE) y auto-creación vía signal
- **Archivo:** [backend/accounts/models.py](backend/accounts/models.py#L1-L36)

#### 5. Actividad.programa Obligatorio
- **Problema:** Campo nullable pero `__str__` y `espacio_curricular` asumían existencia
- **Solución:** Campo now required, base de datos recreada para evitar conflictos
- **Archivo:** [backend/planning/models.py](backend/planning/models.py#L159-L165)

#### 6. Validación de Unicidad en ProgramaForm
- **Problema:** Constraint `(plan_estudio_ec, anio_academico)` único podía disparar `IntegrityError`
- **Solución:** Validación en formulario antes del `save()`
- **Archivo:** [backend/planning/forms.py](backend/planning/forms.py#L28-L47)

#### 7. Campo `order_by` Corregido
- **Problema:** `order_by('titulo')` pero el modelo tiene `descripcion`
- **Solución:** Corregido a `order_by('descripcion')`
- **Archivo:** [backend/planning/views.py](backend/planning/views.py#L213)

---

### 🏗️ API REST (Django REST Framework)

#### 8. Estructura Completa de API
- **Endpoints creados bajo `/api`:**
  - `/api/unidades-academicas` (ReadOnly)
  - `/api/carreras` (ReadOnly)
  - `/api/configuracion-cre` (ReadOnly)
  - `/api/planes-estudio` (ReadOnly)
  - `/api/planes-estudio-ec` (ReadOnly)
  - `/api/espacios-curriculares` (ReadOnly)
  - `/api/tipos-actividad` (ReadOnly)
  - `/api/programas` (CRUD con filtro por docente)
  - `/api/actividades` (CRUD con filtro por docente)

**Archivos:**
- Serializers: [academics/serializers.py](backend/academics/serializers.py), [planning/serializers.py](backend/planning/serializers.py)
- ViewSets: [academics/viewsets.py](backend/academics/viewsets.py), [planning/viewsets.py](backend/planning/viewsets.py)
- Router: [config/api_urls.py](backend/config/api_urls.py)

#### 9. Separación de Serializers por Operación
- **Patrón DRF:** `<Model>Serializer`, `<Model>CreateSerializer`, `<Model>UpdateSerializer`
- **Validación:** Create serializers validan que el docente esté asignado al espacio curricular
- **N+1 Prevention:** `select_related`/`prefetch_related` en `get_queryset()`
- **Archivo:** [backend/planning/viewsets.py](backend/planning/viewsets.py#L39-L84)

---

### 📊 Modelos y Base de Datos

#### 10. ConfiguracionCRE como Singleton
- **Problema:** Múltiples instancias podían crear inconsistencias
- **Solución:** Patrón singleton con `save()` override y método `get_instance()`
- **Admin:** Solo permite una instancia, no permite eliminación
- **Archivos:** 
  - [academics/models.py](backend/academics/models.py#L6-L42)
  - [academics/admin.py](backend/academics/admin.py#L24-L32)

#### 11. Índices en Campos Clave
- **Agregados:**
  - `EspacioCurricular.codigo` (unique + index)
  - `EspacioCurricular.nombre` (index)
  - `Programa.anio_academico` (index)
- **Impacto:** Mejora performance en búsquedas frecuentes
- **Migraciones:** [academics/migrations/0002_*](backend/academics/migrations/), [planning/migrations/0002_*](backend/planning/migrations/)

#### 12. Docker Volume Corregido
- **Problema:** Volumen apuntaba a `/var/lib/postgresql` (riesgo de pérdida de datos)
- **Solución:** Cambiado a `/var/lib/postgresql/data` (ruta correcta)
- **Archivo:** [backend/docker-compose.yaml](backend/docker-compose.yaml#L13)

---

## Setup Actualizado

### Configuración Inicial

1. **Clonar y configurar entorno:**
```bash
cd backend
cp .env.example .env
# Editar .env con tus valores (DB, SECRET_KEY, etc.)
```

2. **Base de datos:**
```bash
docker compose up -d
```

3. **Instalar dependencias y migrar:**
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r ../requirements.txt
python manage.py migrate
python manage.py createsuperuser
```

4. **Iniciar servidor:**
```bash
python manage.py runserver
```

### Acceso

- **Django Admin:** http://localhost:8000/admin
- **API REST:** http://localhost:8000/api/
- **Vistas server-rendered:** http://localhost:8000/

### Credenciales por Defecto (desarrollo)

- **Usuario:** admin
- **Contraseña:** admin123

---

## Patrones y Buenas Prácticas Aplicadas

### Django/DRF
- ✅ Separación de serializers por operación (Read/Create/Update)
- ✅ ViewSets con validación de permisos por asignación
- ✅ Prevención de N+1 queries con `select_related`/`prefetch_related`
- ✅ Validación de negocio en serializers y forms
- ✅ `swagger_fake_view` check para generación de schemas

### Seguridad
- ✅ Variables sensibles en `.env`
- ✅ CORS/CSRF configurados para frontend separado
- ✅ Control de acceso basado en `AsignacionDocente`
- ✅ Validación de ownership en operaciones CRUD

### Base de Datos
- ✅ Índices en campos frecuentemente consultados
- ✅ Constraints de unicidad a nivel DB
- ✅ Singleton pattern para configuración global
- ✅ ON DELETE policies apropiadas (CASCADE/PROTECT)

---

## Pendientes Futuros

### Testing
- [ ] Tests de permisos (no acceder a programas/actividades ajenos)
- [ ] Tests de validación de unicidad
- [ ] Tests de endpoints API
- [ ] Fixtures para datos de prueba

### Optimización
- [ ] Paginación custom si datasets crecen
- [ ] Caching para endpoints read-only
- [ ] Filtros avanzados (django-filter)

### Validaciones de Negocio (Críticas)
- [ ] **Validación de horas CRE**: La suma de horas de todas las actividades (IP + TA) de un programa no debe exceder `creditos * ConfiguracionCRE.get_hours_per_cre()` del `PlanEstudioEC`
  - **Problema actual**: Un docente puede cargar actividades que sumen más horas que las asignadas por CRE
  - **Distribución IP/TA** debe respetar porcentajes según tipo de EC (T1: 30/70, T2: 50/50, T3: 70/30, T4: 80/20)
  - **Implementar en**: `ActividadForm.clean()` y `ActividadCreateSerializer.validate()`
  
- [x] **Solapamiento de asignaciones temporales**: ✅ **IMPLEMENTADO**
  - **Validación**: `AsignacionDocente.clean()` previene asignaciones con rangos de fechas solapados
  - **Tests**: 5 tests completos en `planning/tests.py` verificando todos los casos bordes
  - **Admin**: Validación automática al crear/editar asignaciones
  - Ver: [ASIGNACION_TEMPORAL.md](ASIGNACION_TEMPORAL.md#validaciones) para detalles

### Testing
- [x] Tests de validación de solapamiento de asignaciones (5 tests aprobados)
- [ ] Tests de permisos (no acceder a programas/actividades ajenos)
- [ ] Tests de validación de unicidad en planning
- [ ] Tests de endpoints API (DRF)
- [ ] Fixtures para datos de prueba

### Funcionalidades Adicionales
- [ ] Dashboard analytics para admin
- [ ] Export PDF de programas
- [ ] Integración con APIs externas (académicas/Guaraní)

---

## Referencias

- [Django Best Practices](https://docs.djangoproject.com/en/5.2/topics/best-practices/)
- [DRF Guidelines](.agents/skills/django-drf/SKILL.md)
- [Django Expert Skill](.agents/skills/django-expert/SKILL.md)
- [CRE Domain Rules](CRE.md)
