# CRE App

Backend Django para gestionar planificación académica basada en criterios de Créditos de Referencia del Estudiantado (CRE). Ver el resumen normativo en [CRE.md](./docs/CRE.md).

## Requisitos

- Python 3.12+
- PostgreSQL (o Docker)
- Pip (venv recomendado)
- VS Code (opcional)

Dependencias: ver [requirements.txt](./requirements.txt)

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
   - Crear `backend/.env` a partir de `backend/.env.example`.
   - Ejemplo de variables (no usar credenciales reales):
     ```
     POSTGRES_DB=creapp_db
     POSTGRES_USER=creapp_admin
     POSTGRES_PASSWORD=<cambiar>
     POSTGRES_HOST=localhost
      POSTGRES_PORT=5432
      ```

## Clonar en otra PC (misma base de datos)

Si queres mover una copia consistente de datos entre PCs, usa dump/restore:

1. En la PC origen, exportar:
   ```sh
   ./scripts/db-export.sh
   ```
   Esto genera un archivo `backup_creapp_YYYYMMDD_HHMMSS.dump` en la raiz del repo.

2. Copiar ese `.dump` a la otra PC.

3. En la PC destino:
   - Configurar `backend/.env` con la DB local de destino.
   - Restaurar:
     ```sh
     ./scripts/db-import.sh /ruta/al/backup_creapp_YYYYMMDD_HHMMSS.dump
     ```

4. Ejecutar migraciones por seguridad:
   ```sh
   cd backend
   python manage.py migrate
   ```

## Compartir una DB en vivo a otra PC (LAN)

Si queres que otra PC use tu misma DB en tiempo real:

1. En la PC que hospeda PostgreSQL:
   - Habilitar escucha remota (`listen_addresses='*'`) en `postgresql.conf`.
   - Agregar regla en `pg_hba.conf` para la IP cliente.
   - Abrir firewall solo para el puerto `5432` y solo a IPs confiables.

2. En la PC cliente, en `backend/.env`:
   ```env
   POSTGRES_HOST=<IP_PC_HOST_DB>
   POSTGRES_PORT=5432
   POSTGRES_DB=creapp_db
   POSTGRES_USER=creapp_admin
   POSTGRES_PASSWORD=<password>
   ```

3. Para abrir frontend/backend desde otra maquina, completar tambien:
   ```env
   ALLOWED_HOSTS=localhost,127.0.0.1,<IP_BACKEND>,<HOSTNAME>
   CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://<IP_FRONTEND>:5173
   CSRF_TRUSTED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://<IP_FRONTEND>:5173
   ```

## Base de datos con Docker

Usar el compose en [backend/docker-compose.yaml](./backend/docker-compose.yaml):

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

Panel admin en: http://127.0.0.1:8000/api/sadmin-creapp-panel/
Rutas actuales: ver [`config.urls`](./backend/config/urls.py).

## Manuales de mantenimiento

- [Manual de desarrollo](./docs/manuales/DEVELOPER_MANUAL.md) · [LaTeX](./docs/manuales/DEVELOPER_MANUAL.tex) · [PDF](./docs/manuales/DEVELOPER_MANUAL.pdf): arquitectura, dominio, API, frontend y verificación.
- [Manual de despliegue](./docs/manuales/DEPLOYMENT_MANUAL.md) · [LaTeX](./docs/manuales/DEPLOYMENT_MANUAL.tex) · [PDF](./docs/manuales/DEPLOYMENT_MANUAL.pdf): configuración operativa, redes, backups y workflows observados.
- [Apéndices técnicos](./docs/manuales/APENDICES.md) · [LaTeX](./docs/manuales/APENDICES.tex) · [PDF](./docs/manuales/APENDICES.pdf): detalle de ramas, contratos, riesgos y evidencia de las pruebas.

## Tests

```sh
cd backend
python manage.py test
```

## Tunelizacion

Para compartir la app por internet usando Cloudflare Tunnel en entorno de desarrollo, ver [README_TUNELIZACION.md](./docs/README_TUNELIZACION.md).

## Estructura

- Backend Django en `backend/` con apps: `accounts`, `academics`, `planning`.
- Configuración en [`config.settings`](./backend/config/settings.py), ASGI/WSGI en `config/`.
- Docker compose para PostgreSQL en `backend/docker-compose.yaml`.

## Notas de seguridad

- No commitear `.env` (ya ignorado en `.gitignore`).
- Rotar credenciales y usar variables de entorno en despliegues.
