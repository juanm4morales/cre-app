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

La API usa **autenticación por sesión** (Django session cookies). El frontend React envía Cokiees automáticamente en cada request al mismo dominio.

### Endpoints de autenticación

| Método | Path | Descripción |
|--------|------|-------------|
| `GET` | `/api/auth/csrf/` | Obtener cookie CSRF |
| `GET` | `/api/auth/me/` | Datos del usuario autenticado |
| `POST` | `/api/auth/login/` | Login (session cookie) |
| `POST` | `/api/auth/logout/` | Logout |

### Usar con fetch

```js
// Con credentials: 'include', las cookies se envían automáticamente
const res = await fetch('/api/auth/me/', {
  credentials: 'include',
  headers: { 'X-CSRFToken': getCookie('csrftoken') }
})
```

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
