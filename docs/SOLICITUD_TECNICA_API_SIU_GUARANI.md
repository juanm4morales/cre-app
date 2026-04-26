# Solicitud Técnica de Integración API REST
## SIU Guaraní → CRE App (UNCuyo)

**Fecha:** 2026-03-02  
**Proyecto consumidor:** CRE App  
**Área solicitante:** Equipo de desarrollo CRE App  
**Área destinataria:** Área de Sistemas (SIU Guaraní)

---

## 1. Propósito

Se solicita la provisión de una API REST institucional para consumo desde CRE App, donde **SIU Guaraní opere como fuente de verdad** para:

1. Datos académicos estructurales.
2. Datos de docentes y sus asignaciones en espacios curriculares.

El objetivo es garantizar sincronización confiable, trazable e incremental entre sistemas, evitando carga manual y divergencias de datos.

---

## 2. Contexto de negocio y dependencia funcional

CRE App implementa planificación académica basada en créditos (CRE) y requiere datos oficiales para:

- estructurar la oferta académica (unidad académica, carreras, planes y espacios);
- validar permisos de carga por docente según asignación vigente;
- soportar control administrativo y auditoría de planificación.

Sin este contrato de integración, la consistencia de datos académicos y docentes no puede garantizarse de forma sistémica.

---

## 3. Alcance de datos requeridos

### 3.1 Dominio académico
- Unidades académicas.
- Carreras.
- Planes de estudio.
- Espacios curriculares.
- Relación plan de estudio ↔ espacio curricular.

### 3.2 Dominio docente
- Docentes (identidad académica).
- Asignaciones docentes por espacio curricular con vigencia temporal.

---

## 4. Requisitos no funcionales de la API

### 4.1 Protocolo y formato
- API REST sobre HTTPS (TLS 1.2+).
- Versionado explícito en URL: `/api/v1/`.
- Payload JSON UTF-8.
- Fechas en ISO-8601.

### 4.2 Seguridad
- Mecanismo preferente: OAuth2 Client Credentials.
- Alternativa aceptable: API Key por encabezado + allowlist de IP.
- Rotación y revocación de credenciales documentada.

### 4.3 Rendimiento y disponibilidad
- Timeout recomendado por request: ≤ 10 segundos.
- SLA objetivo de disponibilidad: ≥ 99.5%.
- Rate limit comunicado formalmente (límite, ventana, `Retry-After` y política de retry).

### 4.4 Observabilidad
- Identificador de traza por request (`trace_id` o `request_id`).
- Registro auditable de cambios (campos `created_at`, `updated_at`).
- Monitoreo de errores 4xx/5xx por endpoint.

---

## 5. Requerimientos de sincronización

Se requiere compatibilidad con **sincronización full + incremental**:

1. Full bootstrap inicial de catálogos y relaciones.
2. Delta por `updated_since` (datetime UTC).
3. Orden estable para paginación (recomendado: `updated_at`, `id_externo`).
4. Baja lógica o vigencia temporal explícita en entidades que apliquen.

### 5.1 Enfoque de simplicidad (MVP)
Para facilitar una primera entrega rápida, se propone como mínimo indispensable:

1. Endpoints de lectura para los dominios académicos y docentes del alcance.
2. Identidad estable por registro (campo institucional único o equivalente).
3. Mecanismo de vigencia/estado (activo o vigencias).
4. Algún mecanismo incremental (por fecha de actualización o equivalente).
5. Paginación consistente (cualquier esquema documentado).

Todo lo demás se considera deseable y puede evolucionar por versiones.

Justificación de paginación: aunque el volumen inicial pueda ser bajo, la paginación permite controlar tamaño de respuesta, evitar timeouts y reintentar bloques fallidos sin reprocesar el total.

### 5.2 Reglas de consistencia temporal
Para asignaciones docentes, se solicita explícitamente que no existan solapamientos de vigencia para la misma dupla docente+espacio curricular.

---

## 6. Requerimientos de contrato de datos

Para cada recurso se solicita:

- identidad estable (por ejemplo `id_externo`) inmutable y única.
- estado/vigencia (por ejemplo `activo` o fechas de vigencia).
- campo o mecanismo para detectar cambios (por ejemplo `updated_at`).
- documentación de catálogos/enums, sin exigir naming literal.
- especificación OpenAPI con tipos, `required`, `nullable` y constraints por campo.
- garantías de no reutilización de identificadores históricos.

---

## 7. Requisitos de documentación y entrega

Se solicita al Área de Sistemas entregar:

1. Especificación OpenAPI 3.0+ (YAML/JSON).
2. Ambiente de testing/sandbox con datos representativos.
3. Colección Postman/Insomnia.
4. Guía de autenticación y renovación de credenciales.
5. Política de versionado, deprecación y breaking changes.
6. Canal formal de soporte e incidentes.

---

## 8. Criterios de aceptación de integración

La integración se considerará aceptada cuando:

1. Todos los endpoints del alcance respondan según contrato.
2. Exista consistencia referencial entre entidades académicas y docentes.
3. Se validen corridas de sincronización full e incremental sin pérdida de datos.
4. Se manejen correctamente altas, modificaciones y bajas/vigencias.
5. Se cumplan autenticación, autorización y trazabilidad acordadas.

---

## 9. Contacto técnico

Definir contraparte técnica para:

- mesa de integración;
- validación de contrato;
- gestión de cambios de API;
- resolución de incidentes de sincronización.

---

## 10. Anexo

El detalle operativo de endpoints, métodos HTTP, ejemplos de response, estructura de errores y políticas de paginación/filtros se incluye en:

**`ANEXO_TECNICO_API_SIU_GUARANI_CONTRATO.md`**
