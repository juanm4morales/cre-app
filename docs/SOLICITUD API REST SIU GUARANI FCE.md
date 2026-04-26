# Especificaciones técnicas de solicitud de API REST para SIU Guaraní FCE

**Fecha:** 2026-03-02  

---

## 1. Lineamientos generales de diseño

- **Base URL (ejemplo):** `https://{host}/api/v1`
- **Content-Type:** `application/json; charset=utf-8`
- **Autenticación:** La que crean conveniente

---

## 2. Propuestas generales

### 2.1 Campos transversales por recurso
Para una integración simple y robusta, se solicita al menos una opción por capacidad:

- **Identidad estable**: `id_externo` o equivalente institucional único e inmutable.
- **Estado/vigencia**: `activo` o par de vigencia (`vigente_desde`/`vigente_hasta`).
- **Detección de cambios**: `updated_at` o mecanismo equivalente para conocer modificaciones.

> Nota: CRE app se adapta al naming del API SIU. No se exige nombre literal de campos si la semántica es equivalente.

### 2.2 Paginación estándar
Se propone paginación `page/page_size` por simplicidad, pero se acepta cualquier esquema consistente (offset/limit o cursor).

Para limitar el tamaño de respuesta, reducir riesgo de timeout, etc.

**Opción sugerida:**
- `page` (int, default 1)
- `page_size` (int, default 100, max 500)

**Response shape:**
```json
{
  "count": 1250,
  "next": "https://.../api/v1/recurso?page=2&page_size=100",
  "previous": null,
  "results": []
}
```

### 2.3 Filtro incremental
Para minimizar tráfico y evitar reprocesamientos.

**Opción sugerida:**
- `updated_since` (datetime ISO-8601 UTC)

**Alternativas:**
- endpoint de cambios (`/changes`)
- versión/sequence por registro
- la que consideren adecuada

#### Devolver recursos con `updated_at >= updated_since`.

---

## 3. Catálogos y enums de referencia (no bloqueantes)

Los siguientes valores son ejemplos de referencia funcional para facilitar el mapeo.  
**No constituyen una exigencia de nombres literales**; CRE App implementará adaptación/mapeo.

### 3.1 `tipo_espacio`
- `T1` Asignatura
- `T2` Seminario
- `T3` Taller/Laboratorio
- `T4` Actividad Profesional Especial

### 3.2 `periodo`
- `ANUAL`
- `1S` (1° Semestre)
- `2S` (2° Semestre)

### 3.3 `categoria_docente`
- `TIT` (Titular)
- `ADJ` (Adjunto)
- `ASO` (Asociado)
- `JTP` (Jefe de Trabajos prácticos)
- `AY1` (Ayudante 1)
- `AY2` (Ayudante 2)

### 3.4 Definiciones de campos clave

| Campo | Significado | Regla de interpretación |
|---|---|---|
| `tipo_espacio` | Clasificación académica del espacio curricular. | SIU define los valores válidos; CRE App los mapea internamente. |
| `periodo` | Ventana temporal de dictado del espacio (anual, semestral, etc.). | Debe indicar cuándo se cursa para validar planificación. |
| `categoria_docente` | Categoría del docente dentro de la asignación. | Se usa para control y trazabilidad de la asignación. |
| `creditos` | Carga en créditos del plan o espacio según corresponda. | Debe ser numérico y no negativo. |
| `horas_ip` | Horas de interacción pedagógica. | Numérico, no negativo. |
| `horas_ta` | Horas de trabajo autónomo del estudiante. | Numérico, no negativo; complementa distribución horaria. |
| `anio_cursada` | Año sugerido de cursado en la trayectoria. | Entero positivo (`min=1`). |
| `vigente_desde` | Fecha de inicio de validez de un registro. | Obligatorio para entidades con vigencia temporal. |
| `vigente_hasta` | Fecha de fin de validez de un registro. | `null` implica vigencia abierta. |
| `activo` | Estado operativo actual del registro. | Si no existe, debe proveerse vigencia equivalente. |
| `updated_at` | Última modificación del registro en SIU. | Campo base para sincronización incremental. |
| `updated_since` | Filtro de consulta para traer cambios desde un corte temporal. | Debe devolver registros modificados desde el timestamp indicado. |

---

## 4. Endpoints requeridos

Estos endpoints representan el alcance funcional esperado. Se aceptan variaciones de naming/rutas, siempre que se cubra el dominio y se documente el mapeo.

## 4.1 Unidades Académicas
### GET `/unidades-academicas`

**Query params**
- `updated_since` (opcional)
- `page` (opcional)
- `page_size` (opcional)

**Campos:**

| Campo | Tipo | Required | Nullable | Restricciones sugeridas |
|---|---|---|---|---|
| `id_externo` | string | Sí | No | único e inmutable |
| `codigo` | string | Sí | No | único en catálogo activo |
| `nombre` | string | Sí | No | longitud > 0 |
| `activo` o vigencia | boolean u objeto vigencia | Sí |  -  | estado de vigencia explícito |
| `updated_at` | date-time | Sí | No | ISO-8601 UTC |

**200 OK (ejemplo)**
```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "id_externo": "UA_FI",
      "codigo": "FI",
      "nombre": "Facultad de Ingeniería",
      "activo": true,
      "updated_at": "2026-03-01T12:00:00Z"
    }
  ]
}
```

---

## 4.2 Carreras
### GET `/carreras`

**Query params**
- `unidad_academica_codigo` (opcional)
- `updated_since` (opcional)
- `page` (opcional)
- `page_size` (opcional)

**Campos:**

| Campo | Tipo | Required | Nullable | Restricciones sugeridas |
|---|---|---|---|---|
| `id_externo` | string | Sí | No | único e inmutable |
| `codigo` | string | Sí | No | recomendado único por unidad académica |
| `nombre` | string | Sí | No | longitud > 0 |
| `nivel` | string | Sí | No | enum documentado por SIU |
| `unidad_academica_codigo` | string | Sí | No | debe existir en unidades académicas |
| `activo` o vigencia | boolean u fecha | Sí | - | estado de vigencia explícito |
| `updated_at` | date-time | Sí | No | - |
| OTROS | - | - | - | - |

**200 OK (ejemplo)**
```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "id_externo": "CAR_ISI",
      "codigo": "ISI",
      "nombre": "Ingeniería en Sistemas de Información",
      "nivel": "G",
      "unidad_academica_codigo": "FI",
      "activo": true,
      "updated_at": "2026-03-01T12:10:00Z"
    }
  ]
}
```

---

## 4.3 Planes de Estudio
### GET `/planes-estudio`

**Query params**
- `carrera_codigo` (opcional)
- `vigente_en` (opcional, date `YYYY-MM-DD`)
- `updated_since` (opcional)
- `page` (opcional)
- `page_size` (opcional)

**Campos:**

| Campo | Tipo | Required | Nullable | Restricciones sugeridas |
|---|---|---|---|---|
| `id_externo` | string | Sí | No | único e inmutable |
| `carrera_codigo` | string | Sí | No | debe existir en carreras |
| `nombre` | string | Sí | No | longitud > 0 |
| `ordenanza` | string | Recomendado | Sí | nomenclador institucional |
| `descripcion` | string | No | Sí | informativo |
| `creditos` | number/integer | Sí | No | `min=0` |
| `vigente_desde` | date | Sí | No | formato `YYYY-MM-DD` |
| `vigente_hasta` | date | No | Sí | `null` = vigencia abierta |
| `activo` o vigencia | boolean u objeto vigencia | Sí | - | - |
| `updated_at` | date-time | Sí | No | - |
| OTROS | - | - | - | - |

**200 OK (ejemplo)**
```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "id_externo": "PLAN_ISI_2025",
      "carrera_codigo": "ISI",
      "nombre": "Plan 2025",
      "ordenanza": "Ord-53/2025",
      "descripcion": "Plan de transición y consolidación",
      "creditos": 300,
      "vigente_desde": "2025-01-01",
      "vigente_hasta": null,
      "activo": true,
      "updated_at": "2026-03-01T12:20:00Z"
    }
  ]
}
```

---

## 4.4 Espacios Curriculares
### GET `/espacios-curriculares`

**Query params**
- `codigo` (opcional)
- `tipo_espacio` (opcional)
- `updated_since` (opcional)
- `page` (opcional)
- `page_size` (opcional)

**Campos:**

| Campo | Tipo | Required | Nullable | Restricciones sugeridas |
|---|---|---|---|---|
| `id_externo` | string | Sí | No | único e inmutable |
| `codigo` | string | Sí | No | único por espacio |
| `nombre` | string | Sí | No | longitud > 0 |
| `tipo_espacio` | string | Sí | No | enum documentado por SIU |
| `anio_cursada` | integer | Sí | No | `min=1` |
| `periodo` | string | Sí | No | enum documentado por SIU |
| `creditos` | number/integer | Sí | No | `min=0` |
| `horas_ip` | number/integer | Sí | No | `min=0` |
| `horas_ta` | number/integer | Sí | No | `min=0` |
| `activo` o vigencia | boolean u objeto vigencia | Sí | - | estado de vigencia explícito |
| `updated_at` | date-time | Sí | No | - |
| OTROS | - | - | - | - |


**200 OK (ejemplo)**
```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "id_externo": "EC_ALG1",
      "codigo": "ALG1",
      "nombre": "Álgebra I",
      "tipo_espacio": "T1",
      "anio_cursada": 1,
      "periodo": "ANUAL",
      "creditos": 6,
      "horas_ip": 45,
      "horas_ta": 105,
      "activo": true,
      "updated_at": "2026-03-01T12:30:00Z"
    }
  ]
}
```

---

## 4.5 Relación Plan ↔ Espacio Curricular
### GET `/planes-estudio-espacios`

**Query params**
- `plan_id_externo` (opcional)
- `espacio_codigo` (opcional)
- `updated_since` (opcional)
- `page` (opcional)
- `page_size` (opcional)

**Campos:**

| Campo | Tipo | Required | Nullable | Restricciones sugeridas |
|---|---|---|---|---|
| `id_externo` | string | Sí | No | único e inmutable |
| `plan_id_externo` | string | Sí | No | debe existir en planes de estudio |
| `espacio_codigo` o `espacio_id_externo` | string | Sí | No | debe existir en espacios curriculares |
| `activo` o vigencia | boolean u objeto vigencia | Sí | - | estado de validez de la relación |
| `updated_at` | date-time | Sí | No | - |
| OTROS | - | - | - | - |

**200 OK (ejemplo)**
```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "id_externo": "PEC_PLAN_ISI_2025_ALG1",
      "plan_id_externo": "PLAN_ISI_2025",
      "espacio_codigo": "ALG1",
      "activo": true,
      "updated_at": "2026-03-01T12:40:00Z"
    }
  ]
}
```

---

## 4.6 Docentes
### GET `/docentes`

**Query params**
- `updated_since` (opcional)
- `legajo` (opcional)
- `email` (opcional)
- `page` (opcional)
- `page_size` (opcional)

**Campos:**

| Campo | Tipo | Required | Nullable | Restricciones sugeridas |
|---|---|---|---|---|
| `id_externo` | string | Sí | No | único e inmutable |
| `legajo` | string | Recomendado | Sí | identificador administrativo |
| `dni` | string | Recomendado | Sí | identificador personal |
| `username_sugerido` | string | No | Sí | informativo |
| `email` | string | Recomendado | Sí | formato email válido |
| `nombres` | string | Sí | No | longitud > 0 |
| `apellidos` | string | Sí | No | longitud > 0 |
| `activo` o vigencia | boolean u objeto vigencia | Sí | - | estado operativo explícito |
| `updated_at` | date-time | Sí | No | - |
| OTROS | - | - | - | - |

**200 OK (ejemplo)**
```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "id_externo": "DOC_12345",
      "legajo": "12345",
      "dni": "12345",
      "username_sugerido": "jperez",
      "email": "jperez@uncuyo.edu.ar",
      "nombres": "Juan",
      "apellidos": "Pérez",
      "activo": true,
      "updated_at": "2026-03-01T12:50:00Z"
    }
  ]
}
```

---

## 4.7 Asignaciones Docentes
### GET `/asignaciones-docentes`

**Query params**
- `docente_id_externo` (opcional)
- `espacio_codigo` (opcional)
- `vigente_en` (opcional, date)
- `updated_since` (opcional)
- `page` (opcional)
- `page_size` (opcional)

**Campos:**

| Campo | Tipo | Required | Nullable | Restricciones sugeridas |
|---|---|---|---|---|
| `id_externo` | string | Sí | No | único e inmutable |
| `docente_id_externo` | string | Sí | No | debe existir en docentes |
| `espacio_codigo` o `espacio_id_externo` | string | Sí | No | debe existir en espacios curriculares |
| `categoria_docente` | string | Sí | No | enum documentado por SIU |
| `vigente_desde` | date | Sí | No | formato `YYYY-MM-DD` |
| `vigente_hasta` | date | No | Sí | `null` = vigencia abierta |
| `activo` o vigencia | boolean u objeto vigencia | Sí | - | coherente con rango temporal |
| `updated_at` | date-time | Sí | No | - |
| OTROS | - | - | - | - |

**200 OK (ejemplo)**
```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "id_externo": "ASIG_789",
      "docente_id_externo": "DOC_12345",
      "espacio_codigo": "ALG1",
      "categoria_docente": "JTP",
      "vigente_desde": "2024-03-01",
      "vigente_hasta": null,
      "activo": true,
      "updated_at": "2026-03-01T13:00:00Z"
    }
  ]
}
```

---

## 5. Endpoint opcional de salud y metadatos

### GET `/health`

**200 OK (ejemplo)**
```json
{
  "status": "ok",
  "service": "siu-guarani-api",
  "version": "1.0.0",
  "timestamp": "2026-03-02T10:00:00Z"
}
```

### GET `/metadata`

**200 OK (ejemplo)**
```json
{
  "api_version": "v1",
  "contract_version": "2026-03-02",
  "deprecation_policy_url": "https://..."
}
```

---

## 6. Modelo de errores

El que crean conveniente
