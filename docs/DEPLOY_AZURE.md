# Deploy Azure — CREApp

Guía de despliegue de CREApp en **Azure App Service** (Python 3.13 + Django 6.0.2 + React 19 + PostgreSQL Flexible).

---

## Arquitectura actual

```
┌─────────────────────────────────────────────┐
│  Azure App Service (Linux, plan F1 o B1)   │
│                                             │
│  Django (Gunicorn)                          │
│  ├── /              → React SPA            │
│  ├── /api/          → DRF REST API         │
│  ├── /django-admin/ → Django Admin          │
│  ├── /healthz       → Health check         │
│  └── /static/       → Static assets        │
│                                             │
│  WhiteNoise sirve React dist/               │
│  PostgreSQL Flexible Server (separate)      │
└─────────────────────────────────────────────┘
```

---

## Stack

| Componente | Tecnología |
|-----------|------------|
| Backend | Django 6.0.2 + DRF 3.16.1 |
| Python | 3.13 |
| Frontend | React 19.2 + Vite 7 + TypeScript |
| Base de datos | PostgreSQL Flexible Server |
| Web server | Gunicorn 23 + WhiteNoise 6 |
| CI/CD | GitHub Actions + `azure/webapps-deploy@v3` |

---

## Recursos Azure necesarios

1. **App Service** `cre-app-api` — Linux, Python 3.11+
2. **PostgreSQL Flexible Server** `cre-app-postgres` — zona Chile Central
3. **Grupo de recursos** `creapprg` — ambos recursos

---

## Variables de entorno (App Service)

En **App Service → Configuración → Variables de entorno → Configuración de la aplicación**:

```env
# Seguridad
DEBUG=False
SECRET_KEY=<generar con: python -c "import secrets; print(secrets.token_urlsafe(50))">
ALLOWED_HOSTS=cre-app-api-evhxegffcahfftbh.chilecentral-01.azurewebsites.net
CSRF_TRUSTED_ORIGINS=https://cre-app-api-evhxegffcahfftbh.chilecentral-01.azurewebsites.net

# CORS (same-origin, no necesario pero dejarlo)
CORS_ALLOWED_ORIGINS=https://cre-app-api-evhxegffcahfftbh.chilecentral-01.azurewebsites.net

# Cookies seguros
CSRF_COOKIE_SECURE=True
SESSION_COOKIE_SECURE=True
SECURE_SSL_REDIRECT=True

# Base de datos
POSTGRES_DB=creappdb
POSTGRES_USER=<usuario_admin>
POSTGRES_PASSWORD=<password>
POSTGRES_HOST=<nombre-servidor>.postgres.database.azure.com
POSTGRES_PORT=5432
```

> **Nota**: `POSTGRES_HOST` debe ser el FQDN del servidor PostgreSQL Flexible, no `localhost`.

---

## Comando de inicio (Startup Command)

En **App Service → Configuración → Configuración general → Comando de inicio**:

```bash
gunicorn --bind=0.0.0.0:8000 --timeout 600 --chdir backend config.wsgi:application --access-logfile '-' --error-logfile '-'
```

> También se puede usar un archivo `startup.sh` en el proyecto.

---

## Firewall PostgreSQL

En **PostgreSQL Flexible Server → Seguridad → Redes**:

- Permitir acceso público o privado según necesidad
- **Permitir servicios de Azure**: Activado
- Agregar IP del cliente si accéder desde pgAdmin local

---

## Workflow CI/CD (GitHub Actions)

Ubicación: `.github/workflows/deploy.yml`

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build_and_deploy:
    steps:
      - checkout
      - Setup Node.js 22
      - npm ci && npm run build          # Build React → frontend/dist/
      - Setup Python 3.13
      - pip install -r requirements.txt
      - cd backend && python manage.py check --deploy
      - python manage.py collectstatic --noinput  # Copia frontend/dist/ → staticfiles/
      - Deploy azure/webapps-deploy@v3
```

### Secrets necesarios en GitHub

| Secret | Cómo obtener |
|--------|-------------|
| `AZURE_WEBAPP_PUBLISH_PROFILE` | App Service → Descargar perfil de publicación |

---

## Ejecución de migraciones

Después del primer deploy o al agregar models nuevos:

```bash
# SSH al App Service
cd /tmp/<directorio_deploy>
python backend/manage.py migrate --noinput
python backend/manage.py collectstatic --noinput
```

## Crear superusuario

```bash
export PYTHONIOENCODING=utf-8
export LC_ALL=C.UTF-8
DJANGO_SUPERUSER_USERNAME=admin \
DJANGO_SUPERUSER_EMAIL=juanm4morales@gmail.com \
DJANGO_SUPERUSER_PASSWORD=<password> \
python backend/manage.py createsuperuser --noinput
```

---

## URLs de la aplicación

| URL | Propósito |
|-----|-----------|
| `https://cre-app-api-evhxegffcahfftbh.chilecentral-01.azurewebsites.net/` | Frontend React SPA |
| `https://cre-app-api-evhxegffcahfftbh.chilecentral-01.azurewebsites.net/api/` | API REST DRF |
| `https://cre-app-api-evhxegffcahfftbh.chilecentral-01.azurewebsites.net/django-admin/` | Admin Django |
| `https://cre-app-api-evhxegffcahfftbh.chilecentral-01.azurewebsites.net/healthz` | Health check |

---

## Troubleshooting

### 500 en /django-admin/
1. Verificar `migrate` corrió correctamente
2. Cambiar `DEBUG=True` temporalmente para ver el error
3. Revisar logs: **Supervisión → Secuencia de registro**

### Error `database "xxx" does not exist`
- La base de datos `POSTGRES_DB` no existe en el servidor PostgreSQL
- Crearla en Azure Portal: **PostgreSQL → Bases de datos → Agregar**
- Nombre recomendado: `creappdb` (sin guiones bajos para Azure)

### Error de conexión PostgreSQL `connection refused`
- Verificar `POSTGRES_HOST` (debe ser el FQDN `.postgres.database.azure.com`)
- Verificar firewall de PostgreSQL permite conexiones
- Verificar `sslmode=require` si aplica

### App no inicia (plan F1 quota)
- El plan F1 tiene 60 min CPU/día. Si se agota, esperar el ciclo diario o escalar temporalmente a B1.
- Para producción se recomienda B1 mínimo.

### Frontend no carga ( blank page / 500 )
1. Verificar que `npm run build` terminó bien
2. Verificar que `collectstatic` corrió y populó `backend/staticfiles/`
3. Verificar que `frontend/vite.config.js` tiene `base: '/static/'`

---

## Proyecto local → Azure (resumen)

```bash
# 1. Clonar repo
git clone https://github.com/juanm4morales/cre-app.git
cd cre-app

# 2. Backend
cd backend
cp .env.example .env
# editar .env con credenciales PostgreSQL locales si aplica

# 3. Frontend
cd ../frontend
cp .env.example .env.local
# editar VITE_API_URL

# 4. Desarrollo
cd backend && pip install -r requirements.txt && python manage.py runserver
cd frontend && npm install && npm run dev

# 5. Deploy (push a main)
git push origin main
# GitHub Actions buildea, collectstatic y sube a Azure automáticamente
```

---

## Notas

- El plan **F1 (gratis)** tiene limitaciones: 60 min CPU/día, sin SLA, cold start lento.
- La quota daily se reinicia automáticamente al siguiente día.
- El frontend React se sirve desde Django via `STATICFILES_DIRS` + WhiteNoise, no hay servidor de archivos separado.
- El routing SPA usa `re_path(r'^.*$', TemplateView.as_view(template_name='index.html'))` en `backend/config/urls.py`.
