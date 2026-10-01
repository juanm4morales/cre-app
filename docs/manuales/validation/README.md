# Harness de aceptación self-hosted de CREApp

Este harness es solo para pruebas y acepta un source tree explícito mediante `SOURCE_DIR`; no asume que el checkout actual sea la fuente de producto apropiada. Prueba la arquitectura same-origin (PostgreSQL → Django/Gunicorn → Nginx → SPA), no instala dependencias ni escribe builds en la fuente y no es un Compose/instalador de producción.

## Seguridad y límites

- Se crea una copia de trabajo bajo `<TEST_ROOT>/runs/`; el source seleccionado no se modifica. `TEST_ROOT` es opcional y, si falta, se genera con `mktemp -d` bajo `/tmp`, fuera del source/repo. El script excluye `.env`, `.env.*`, `.git`, venvs, `node_modules`, builds y bases/respaldos locales; verifica que no haya quedado ningún dotenv en la copia.
- Postgres 17 queda solo en una red Docker `internal` compartida con el API: **no publica 5432 al host ni se conecta a la red de Nginx**. El API tiene una segunda red privada para Nginx. El único puerto publicado es HTTPS de Nginx ligado a `127.0.0.1` y escogido libre en el rango alto efímero. TLS usa CA/hostname de prueba `creapp.test`; el probe confía explícitamente en esa CA y valida el hostname. No hay `--insecure`/`-k`.
- Passwords de Postgres, Django y el usuario admin son aleatorios, efímeros, se almacenan con modo `0600` dentro del directorio de esta ejecución y no son credenciales de ningún entorno real.
- Cada corrida requiere una identidad inmutable de fuente: `run.sh` registra `SOURCE_SHA` explícito (40/64 dígitos hexadecimales) o deriva `HEAD` solo desde un checkout Git limpio. Para archives sin `.git`, pase el SHA aprobado con `SOURCE_SHA`; el harness valida el formato, no puede verificar que un archive corresponda a ese SHA.
- `creapp` ejecuta Gunicorn sin root. Nginx usa la imagen `nginxinc/nginx-unprivileged`; solo `/api/static/` comparte un volumen de estáticos de lectura para Nginx. Django/API y DB están en una red Compose `internal`.
- Usa versiones de imagen explícitas para el ejercicio: Node 22 y Python 3.13; Postgres 17. No afirma compatibilidad con toda distribución productiva ni mide capacidad.
- Sin Docker autorizado, no ejecutar `run.sh`: primero habilitar acceso al socket mediante el procedimiento local aprobado (el operador informó que `newgrp docker` funciona). El script espera esa autorización y verifica `docker info` antes de construir o arrancar contenedores.
- No es prueba de Azure, DNS institucional, certificado público, navegador con políticas reales de cookies, DB remota/TLS del proveedor ni comportamiento de firewall/NSG. Tampoco modifica/deploya workflows.

## Seleccionar el código y ejecutar tras autorizar Docker

Indique un checkout aprobado o una copia/archive de la fuente que quiera probar; no use accidentalmente una rama documental como código de aplicación. Ejecución exacta desde cualquier directorio:

```sh
SOURCE_DIR="/path/to/approved/checkout" "/path/to/cre-app/docs/manuales/validation/run.sh"
```

Ejemplo alternativo para preparar una copia aislada desde una referencia Git ya seleccionada/aprobada (no fija un commit en la documentación):

```sh
SOURCE_DIR="/tmp/creapp-approved-source"
mkdir -p "$SOURCE_DIR"
git -C "/path/to/cre-app" archive origin/azure | tar -x -C "$SOURCE_DIR"
SOURCE_DIR="$SOURCE_DIR" "/path/to/cre-app/docs/manuales/validation/run.sh"
```

Si el operador necesita aplicar la membresía Docker recién concedida en una sesión sin `sg`, la invocación puede hacerse así:

```sh
printf '%s\n' 'SOURCE_DIR="/path/to/approved checkout" "/path/to/cre-app/docs/manuales/validation/run.sh"' | newgrp docker
```

El flujo registra versiones, resultado y duración por paso en un directorio único `<TEST_ROOT>/runs/run.*`:

1. Copia source sin archivos dotenv, genera CA/certificado local de vida corta y build del frontend en Node 22 con `npm ci`, typecheck, Vitest y `VITE_API_URL=/api VITE_STATIC_BASE=/api/static/ npm run build`.
2. Valida configuración Compose, construye imagen Python 3.13, inicia Postgres 17 solo en red interna, crea rol/DB de test efímeros y aplica migraciones desde DB vacía.
3. Ejecuta `makemigrations --check --dry-run`, la clase de pruebas del importador que cubre conservación/conflicto y la suite Django completa; registra `check --deploy` sin suprimir sus warnings. Solo para Django Test Client (que genera HTTP local), la ejecución de la suite pone `SECURE_SSL_REDIRECT=False`; el servicio desplegado y el smoke HTTPS conservan redirect seguro activado.
4. Ejecuta `collectstatic`, crea un superusuario temporal, levanta Gunicorn en el servicio API y Nginx unprivileged con TLS en loopback.
5. El probe HTTPS valida CA y hostname, `/api` → 308 `/api/`, health/body/content-type, SPA raíz/ruta profunda, bundle bajo `/api/static/`, JSON CSRF, cookies Secure, login/sesión, admin, POST/GET autenticado de una unidad académica y logout.
6. Crea dump custom con `pg_dump`, restaura a otra DB efímera con `pg_restore --exit-on-error --single-transaction` y compara conteo de la tabla creada por el smoke test.

`run.meta` registra el SHA y método de resolución de la fuente, además de IDs/digests de las imágenes disponibles. Versiones de herramientas observadas se conservan en los logs de cada paso. Los tags de imagen (`node:22-bookworm`, `postgres:17`, `nginxinc/nginx-unprivileged:stable-alpine`, `python:3.13-slim`) son móviles; no se fijan digests supuestos.

Resultados de la corrida portable del 2026-09-30, sus límites, warnings y rutas a la evidencia están resumidos en [`ACCEPTANCE_REPORT.md`](ACCEPTANCE_REPORT.md). No es una declaración de estado de Azure ni un benchmark de capacidad.

La ejecución normal limpia **solo** el proyecto Compose único que creó y su volumen tras cerrar/guardar la evidencia. Conserva logs, resumen, copia de fuente y dump sin claves. `KEEP=1` conserva los recursos Docker y también `runtime.env` (con passwords aleatorios de Postgres/Django/admin) y las claves privadas/certificados TLS de prueba de esa corrida hasta ejecutar el cleanup indicado. Mantenga el directorio privado; `umask 077` y `runtime.env` modo `0600` protegen el acceso según permisos Unix, pero no cifran los datos ni controlan copias de seguridad, usuarios privilegiados o permisos de filesystem superiores. El comando de cleanup borra esos secretos/certificados privados:

```sh
/path/to/cre-app/docs/manuales/validation/cleanup-run.sh /absolute/path/to/TEST_ROOT/runs/run.<DIRECTORIO_DE_ESTA_EJECUCION>
```

No ejecutar `docker system prune`, `docker volume prune`, `docker compose down` sin el proyecto explícito ni limpiar otros contenedores/volúmenes. `cleanup-run.sh` comprueba que el directorio pertenece a `runs/` y que el proyecto tiene el prefijo `creapp-selfhost-check-`; elimina solo los recursos de esa ejecución y sus secretos/certificados privados temporales. El harness no borra evidencia ni directorios de otras pruebas.

## Archivos del harness

- `run.sh`: orquestación; escribe solo bajo `runs/`.
- `compose.yaml`: app, Postgres, red interna, volumen estáticos y puerto HTTPS loopback.
- `Dockerfile`: runtime Python no-root con Gunicorn; Node no se instala en la app.
- `nginx.conf`: raíz SPA, alias `/api/static/`, proxy API/health, redirect explícito de `/api` y TLS de prueba.
- `probe.py` / `test_probe.py`: smoke HTTP(S) con CA confiable/hostname validado, sesión y CSRF; regresión unitaria para rechazar fallback HTML de SPA como Django Admin.
- `bootstrap-db.sh`: crea rol/DB exclusivamente en el contenedor Postgres descartable.
- `cleanup-run.sh`: cleanup acotado por proyecto y ruta.
- `permission-proof.sh`/`PERMISSION_RESULTS.txt`: comprobación adicional de permisos Unix en un contenedor efímero, con rutas/usuarios ficticios; no instala nada en el host.

La prueba opcional de permisos se puede repetir sin ser root en el host (el usuario sí debe tener acceso Docker). El contenedor no monta volúmenes ni publica puertos:

```sh
docker run --rm -i \
  --name "creapp-selfhost-permission-proof-$(date +%s)-$$" \
  --label purpose=creapp-selfhost-permission-proof \
  python:3.13-slim sh -c 'cat | sh -s' \
  < "/path/to/cre-app/docs/manuales/validation/permission-proof.sh"
```

El script crea el checkout falso y usuarios/grupos dentro del contenedor desechable; no usarlo como instalador ni sobre `/srv` del host real. `PERMISSION_RESULTS.txt` conserva las assertions PASS reportadas: el operador de build prepara el release; `creapp` y `www-data` pueden atravesar directorios; el servicio lee/ejecuta, pero no modifica código/venv; el env solo es legible por el servicio; el servicio escribe `STATIC_ROOT` y `www-data` puede leerlo; `current` apunta al release tras validación. Esto demuestra el comportamiento del fixture Linux/contenedor únicamente: no comprueba propietarios/permisos/ACL/SELinux, identidades, rutas ni configuración de una VM real.
