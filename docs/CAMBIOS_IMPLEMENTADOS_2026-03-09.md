# Cambios Implementados - 2026-03-09

## Alcance
Este documento resume los cambios funcionales implementados en la iteración de planificacion docente para CRE App.

Se cubrieron los siguientes ejes:
- Planificacion de actividades sobre calendario.
- Competencias por unidad (vinculadas al Plan de Estudio).
- Recuperaciones/extensiones con historial y motivo.
- Diferenciacion de reglas IP vs TA.
- Mejoras de UX en frontend docente.
- Generacion masiva manual de clases calendario por rango.

## Decision Operativa
- Importacion TA por plantilla CSV: **pospuesta**.
- Carga TA: **manual por ahora**.

## Backend

### 1) Nuevas entidades y cambios de modelo

#### `academics`
- Nuevo modelo `Competencia` en `backend/academics/models.py`.
  - Campos: `plan_estudio`, `codigo`, `nombre`, `descripcion`, `activo`.
  - Restriccion de unicidad: `(plan_estudio, codigo)`.

#### `planning`
- Nueva relacion `UnidadCompetencia` en `backend/planning/models.py`.
  - Vincula `Unidad` con `Competencia`.
  - Valida que la competencia pertenezca al mismo plan que la unidad.
- Nuevo modelo `DiaClasePrograma`.
  - Define reglas semanales de cursado por programa (`dia_semana`, `hora_inicio`, `hora_fin`).
- Nuevo modelo `ClaseCalendario`.
  - Ocurrencia concreta por fecha.
  - Unicidad: `(programa, fecha)`.
- Nuevo modelo `ActividadAjuste`.
  - Tipos: recuperacion (`REC`) y extension (`EXT`).
  - Guarda motivo, horas IP extra, fecha y autor.
- Extensiones a `Actividad`:
  - `clase_calendario` (para IP).
  - `fecha_inicio_ta`, `fecha_fin_ta` (para TA).

### 2) Migraciones
- `backend/academics/migrations/0003_competencia.py`
- `backend/planning/migrations/0008_actividad_fecha_fin_ta_actividad_fecha_inicio_ta_and_more.py`

### 3) Serializers y reglas de negocio
Archivo: `backend/planning/serializers.py`

#### Reglas IP/TA en actividades
- IP:
  - `clase_calendario` obligatorio.
  - La clase debe pertenecer al mismo programa.
  - La fecha de clase debe coincidir con los dias de clase configurados (por weekday).
  - No admite rango TA.
- TA:
  - No puede tener `clase_calendario`.
  - Si hay rango, `fecha_inicio_ta <= fecha_fin_ta`.

#### Competencias por unidad
- `UnidadCompetenciaAssignSerializer` valida que todas las competencias pertenezcan al plan de estudio del programa.

#### Generacion masiva de calendario
- Nuevo serializer: `ClaseCalendarioGeneracionSerializer`.
  - Entrada: `programa_id`, `fecha_desde`, `fecha_hasta`, `sobrescribir`.
  - Valida orden de fechas.

### 4) Servicios
Archivo: `backend/planning/services/calendar_generation.py`
- Nuevo servicio: `generate_calendar_classes_for_range(...)`.
- Comportamiento:
  - Recorre fechas del rango.
  - Crea `ClaseCalendario` en fechas cuyo weekday coincide con `DiaClasePrograma` activo.
  - Evita duplicados por fecha.
  - Si `sobrescribir=true`, actualiza `dia_clase` en fechas existentes.
- Respuesta con metricas: `created`, `updated`, `skipped`, ids creados/actualizados.

### 5) ViewSets y endpoints
Archivo: `backend/planning/viewsets.py`

#### Endpoints agregados/extendidos
- `POST /api/unidades/{id}/competencias`
  - Asigna competencias a una unidad.
- `GET /api/actividades/{id}/ajustes`
  - Historial de recuperaciones/extensiones.
- `POST /api/actividades/{id}/ajustes`
  - Crea ajuste.
- `POST /api/clases-calendario/generar-rango`
  - Generacion masiva de clases por rango.

### 6) Enrutado API
Archivo: `backend/config/api_urls.py`
- Routers activos para:
  - `competencias`
  - `dias-clase`
  - `clases-calendario`

### 7) Admin Django
Registraciones para nuevas entidades en:
- `backend/academics/admin.py`
- `backend/planning/admin.py`

## Frontend

### 1) Docente - Actividades
Archivo: `frontend/src/pages/docente/Actividades.tsx`

Implementaciones principales:
- Calendario mensual interactivo.
- Click en clase para precargar actividad IP.
- Formulario diferenciado por tipo:
  - IP con clase obligatoria.
  - TA con rango opcional.
- Boton por actividad para recuperar/extender.
- Modal de ajustes con historial.

### 2) Generacion masiva manual de clases
Archivo: `frontend/src/pages/docente/Actividades.tsx`
- Seccion para generar clases por rango:
  - `fecha_desde`
  - `fecha_hasta`
  - checkbox `sobrescribir`
  - boton `Generar clases por rango`
- Al ejecutar:
  - Llama `POST /api/clases-calendario/generar-rango`.
  - Refresca listado de clases calendario.
  - Muestra resumen: nuevas/actualizadas/omitidas.

### 3) Docente - Programas
Archivo: `frontend/src/pages/docente/Programas.tsx`
- Gestion de unidades del programa actual.
- Asignacion de competencias por unidad (multiseleccion).
- Guardado por unidad contra endpoint de competencias.

### 4) Estilos
Archivo: `frontend/src/App.css`
- Estilos de calendario, hints IP/TA, modal grande, lista de ajustes y tarjetas de unidad/competencia.

## Pruebas y validacion

### Backend
Archivo: `backend/planning/tests.py`
- Casos cubiertos:
  - Competencias de unidad solo del mismo plan.
  - IP requiere clase calendario.
  - TA rechaza clase calendario.
  - Extension exige horas IP extra > 0.
  - Generacion por rango crea sin duplicar.
  - Generacion por rango sobrescribe `dia_clase` cuando corresponde.

Comando ejecutado:
- `/home/juanm4/Dev/cre-app/.venv/bin/python manage.py test planning.tests.PlanningRulesTestCase`
- Resultado: **OK (6 tests)**.

### Frontend
Comando ejecutado:
- `npm run build`
- Resultado: **build exitoso**.

## Archivos Clave Modificados

### Backend
- `backend/academics/models.py`
- `backend/academics/serializers.py`
- `backend/academics/viewsets.py`
- `backend/config/api_urls.py`
- `backend/planning/models.py`
- `backend/planning/serializers.py`
- `backend/planning/viewsets.py`
- `backend/planning/services/calendar_generation.py`
- `backend/planning/tests.py`
- `backend/academics/migrations/0003_competencia.py`
- `backend/planning/migrations/0008_actividad_fecha_fin_ta_actividad_fecha_inicio_ta_and_more.py`

### Frontend
- `frontend/src/pages/docente/Actividades.tsx`
- `frontend/src/pages/docente/Programas.tsx`
- `frontend/src/App.css`

## Estado Final
- Funcionalidad principal entregada y validada.
- Generacion masiva de calendario disponible desde UI docente.
- Ajustes de actividades (recuperacion/extension) con historial operativo.
- Competencias por unidad operativas.
- Importador TA CSV diferido por decision de producto; flujo actual TA es manual.
