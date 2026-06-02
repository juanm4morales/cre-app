# Variables de entorno — CREApp

---

## Backend (`backend/.env`)

```env
# Seguridad
DEBUG=True                    # False en producción
SECRET_KEY=change-this-key     # Generar con: python -c "import secrets; print(secrets.token_urlsafe(50))"

# Hosts
ALLOWED_HOSTS=localhost,127.0.0.1

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
CSRF_TRUSTED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# PostgreSQL local
POSTGRES_DB=creapp_db
POSTGRES_USER=creapp_admin
POSTGRES_PASSWORD=change-this-password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
```

---

## Frontend (`frontend/.env.local`)

```env
VITE_API_URL=http://localhost:8000
```

> En producción, `VITE_API_URL` se sobreescribe a la URL del App Service (`https://cre-app-api...azurewebsites.net`).

---

## App Service Azure (Production)

Todas las variables van en **App Service → Variables de entorno → Configuración de la aplicación**.

| Variable | Valor en producción |
|----------|---------------------|
| `DEBUG` | `False` |
| `SECRET_KEY` | `<generado>` |
| `ALLOWED_HOSTS` | `cre-app-api-evhxegffcahfftbh.chilecentral-01.azurewebsites.net` |
| `CSRF_TRUSTED_ORIGINS` | `https://cre-app-api-evhxegffcahfftbh.chilecentral-01.azurewebsites.net` |
| `CORS_ALLOWED_ORIGINS` | `https://cre-app-api-evhxegffcahfftbh.chilecentral-01.azurewebsites.net` |
| `CSRF_COOKIE_SECURE` | `True` |
| `SESSION_COOKIE_SECURE` | `True` |
| `SECURE_SSL_REDIRECT` | `True` |
| `POSTGRES_DB` | `creappdb` |
| `POSTGRES_USER` | `<admin>` |
| `POSTGRES_PASSWORD` | `<password>` |
| `POSTGRES_HOST` | `<servidor>.postgres.database.azure.com` |
| `POSTGRES_PORT` | `5432` |

---

## GitHub Actions Secrets

| Secret | Cómo obtener |
|--------|-------------|
| `AZURE_WEBAPP_PUBLISH_PROFILE` | App Service → Descargar perfil de publicación → copiar todo el XML |

---

## Cómo generar SECRET_KEY

```bash
python -c "import secrets; print(secrets.token_urlsafe(50))"
```

---

## Nunca commitear

- `backend/.env` (tiene secrets reales de producción)
- `frontend/.env.local` (puede tener VITE_API_URL de producción)
- Secrets de Azure (el XML del publish profile)
