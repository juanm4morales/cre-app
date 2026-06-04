# API REST — CREApp

Documentación de la API REST de CREApp (Django REST Framework).

---

## Base URL

```
Producción: https://cre-app-api-evhxegffcahfftbh.chilecentral-01.azurewebsites.net/api/
Desarrollo: http://localhost:8000/api/
```

---

## Autenticación

La API usa **autenticación por sesión** (Django session cookies) con protección CSRF de Django/DRF para todos los métodos inseguros autenticados (`POST`, `PUT`, `PATCH`, `DELETE`).

En despliegues **same-origin**, el frontend puede leer la cookie `csrftoken` y enviarla como header `X-CSRFToken`. En despliegues **split-origin** (por ejemplo Azure Static Web Apps en `azurestaticapps.net` consumiendo App Service en `azurewebsites.net`), el JavaScript no puede leer cookies del dominio del backend. Por eso los endpoints de autenticación devuelven también un campo JSON `csrfToken` legible por el frontend autorizado.

El token CSRF **no autentica por sí solo**: las requests mutantes siguen requiriendo cookie de sesión válida, cookie/secret CSRF compatible, origen confiable, CORS con credenciales y permisos DRF.

### Endpoints de autenticación

| Método | Path | Descripción |
|--------|------|-------------|
| `GET` | `/api/auth/csrf` | Obtener/rotar cookie CSRF y `csrfToken` JSON |
| `GET` | `/api/auth/me` | Datos del usuario autenticado, rol activo, roles disponibles y `csrfToken` |
| `POST` | `/api/auth/login` | Login (session cookie), selección opcional de rol y `csrfToken` actualizado |
| `POST` | `/api/auth/role` | Cambiar rol activo (`docente`/`admin`) para usuarios con ambos roles disponibles |
| `POST` | `/api/auth/logout` | Logout |

### Respuesta CSRF

```json
{
  "detail": "CSRF cookie set",
  "csrfToken": "<token-csrf-enmascarado>"
}
```

### Payload de usuario autenticado

```json
{
  "username": "usuario",
  "name": "Nombre Apellido",
  "role": "docente",
  "available_roles": ["admin", "docente"],
  "csrfToken": "<token-csrf-enmascarado>"
}
```

### Usar con fetch

```js
// En same-origin se puede obtener el token desde la cookie.
// En split-origin usar el csrfToken devuelto por /api/auth/csrf o /api/auth/login.
const csrfResponse = await fetch('/api/auth/csrf', {
  credentials: 'include',
})
const { csrfToken } = await csrfResponse.json()

const res = await fetch('/api/auth/role', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRFToken': csrfToken,
  },
  body: JSON.stringify({ role: 'admin' }),
})
```

### Requisitos de seguridad para split-origin

Para que el flujo funcione de forma segura en producción cross-site:

- `CORS_ALLOWED_ORIGINS` debe contener solo el origen exacto del frontend.
- `CSRF_TRUSTED_ORIGINS` debe contener el origen exacto del frontend para requests inseguras.
- `CORS_ALLOW_CREDENTIALS=True` debe estar activo.
- `SESSION_COOKIE_SECURE=True` y `CSRF_COOKIE_SECURE=True` son obligatorios bajo HTTPS.
- `SESSION_COOKIE_SAMESITE=None` y `CSRF_COOKIE_SAMESITE=None` son necesarios cuando frontend y backend están en sitios distintos.
- Nunca usar wildcard de CORS con credenciales ni eximir de CSRF endpoints autenticados mutantes.

---

## Endpoints disponibles

### Actividades

| Método | Path | Descripción |
|--------|------|-------------|
| `GET` | `/api/actividades/` | Listar actividades |
| `POST` | `/api/actividades/` | Crear actividad |
| `GET` | `/api/actividades/{id}/` | Detalle actividad |
| `PUT` | `/api/actividades/{id}/` | Actualizar actividad |
| `DELETE` | `/api/actividades/{id}/` | Eliminar actividad |

### Espacios Curriculares

| Método | Path | Descripción |
|--------|------|-------------|
| `GET` | `/api/espacios-curriculares/` | Listar |
| `POST` | `/api/espacios-curriculares/` | Crear |
| `GET` | `/api/espacios-curriculares/{id}/` | Detalle |
| `PUT` | `/api/espacios curriculares/{id}/` | Actualizar |
| `DELETE` | `/api/espacios-curriculares/{id}/` | Eliminar |

### Programas

| Método | Path | Descripción |
|--------|------|-------------|
| `GET` | `/api/programas/` | Listar programas |
| `POST` | `/api/programas/` | Crear |
| `GET` | `/api/programas/{id}/` | Detalle |
| `PUT` | `/api/programas/{id}/` | Actualizar |
| `DELETE` | `/api/programas/{id}/` | Eliminar |

### Usuarios

| Método | Path |
|--------|------|
| `GET` | `/api/usuarios/` |
| `POST` | `/api/usuarios/` |
| `GET` | `/api/usuarios/{id}/` |
| `PUT` | `/api/usuarios/{id}/` |
| `DELETE` | `/api/usuarios/{id}/` |

### Asignaciones

| Método | Path |
|--------|------|
| `GET` | `/api/asignaciones/` |
| `POST` | `/api/asignaciones/` |
| `GET` | `/api/asignaciones/{id}/` |
| `PUT` | `/api/asignaciones/{id}/` |
| `DELETE` | `/api/asignaciones/{id}/` |

---

## Filtros

DRF soporta filtros en query string:

```text
GET /api/actividades/?programa=3&activo=true
GET /api/espacios-curriculares/?anio_academico=2026
```

---

## Formato de respuesta

### Éxito

```json
{
  "id": 1,
  "titulo": "Planificación TA",
  "activo": true,
  "horas": 25
}
```

### Error 4xx

```json
{
  "detail": "No authenticated."
}
```

---

## Permisos

Actualmente la API usa `IsAuthenticated` en la mayoria de endpoints. Solo usuarios logueados pueden acceder.

---

## Notas

- La API es RESTful con recursos naming en español.
- No hay versionado (`/api/v1/`) todavia — se recomienda agregar en el futuro si la API cambia de forma no backward-compatible.
- El admin de Django (`/django-admin/`) ofrece una UI completa para manages todos los models si sos superusuario.
