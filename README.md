# CRE App

Backend Django para gestionar planificación académica basada en criterios de Créditos de Referencia del Estudiantado (CRE). Ver el resumen normativo en [CRE.md](/home/juanm4/Dev/cre-app/CRE.md).

## Requisitos

- Python 3.12+
- PostgreSQL (o Docker)
- Pip (venv recomendado)
- VS Code (opcional)

Dependencias: ver [requirements.txt](/home/juanm4/Dev/cre-app/requirements.txt)

## Configuración

1. Crear y activar entorno virtual:
   ```sh
   python -m venv .venv
   source .venv/bin/activate  # Windows: .venv\Scripts\activate
   ```

2. Instalar dependencias:
   ```sh
   pip install -r requirements.txt
   ```

3. Variables de entorno:
   - El backend lee `.env` desde [`config.settings`](./backend/config/settings.py). Mantener fuera del control de versiones.
   - Ejemplo de variables (no usar credenciales reales):
     ```
     POSTGRES_DB=creapp_db
     POSTGRES_USER=creapp_admin
     POSTGRES_PASSWORD=<cambiar>
     POSTGRES_HOST=localhost
     POSTGRES_PORT=5432
     ```

## Base de datos con Docker

Usar el compose en [backend/docker-compose.yaml](/home/juanm4/Dev/cre-app/backend/docker-compose.yaml):

```sh
cd backend
docker compose up -d
```

## Inicialización del proyecto

```sh
cd backend
python manage.py migrate
python manage.py createsuperuser  # opcional
python manage.py runserver
```

Panel admin en: http://127.0.0.1:8000/admin/
Rutas actuales: ver [`config.urls`](./backend/config/urls.py).

## Tests

```sh
cd backend
python manage.py test
```

## Estructura

- Backend Django en `backend/` con apps: `accounts`, `academics`, `planning`.
- Configuración en [`config.settings`](./backend/config/settings.py), ASGI/WSGI en `config/`.
- Docker compose para PostgreSQL en `backend/docker-compose.yaml`.

## Notas de seguridad

- No commitear `.env` (ya ignorado en `.gitignore`).
- Rotar credenciales y usar variables de entorno en despliegues.