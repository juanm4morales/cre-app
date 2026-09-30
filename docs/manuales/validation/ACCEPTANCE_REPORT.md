# Informe de aceptación self-hosted (prueba aislada)

**Fecha de ejecución:** 2026-09-30.
**Source probado:** archive temporal seleccionado de `azure`, en `/tmp/opencode/creapp-selfhost-validation/src`; este informe no registra un SHA de producto.
**Harness empaquetado:** los scripts de `docs/manuales/validation/` se ejecutaron con `SOURCE_DIR` explícito y un `TEST_ROOT` que contiene espacios; no asumieron que el checkout documental fuera código de aplicación.

## Resultado

La corrida portable empaquetada terminó con `ALL ACCEPTANCE STEPS PASSED` (código de salida 0). Invocación:

```sh
SOURCE_DIR="/tmp/opencode/creapp-selfhost-validation/src" \
TEST_ROOT="/tmp/opencode/creapp selfhost evidence" \
  /home/juanm4/Dev/cre-app/docs/manuales/validation/run.sh
```

Evidencia detallada retenida fuera del repositorio:

```text
/tmp/opencode/creapp selfhost evidence/runs/run.nK3zJL/results.txt
/tmp/opencode/creapp selfhost evidence/runs/run.nK3zJL/logs/
/tmp/opencode/creapp selfhost evidence/runs/run.nK3zJL/creapp-acceptance.dump
```

### Versiones y checks

| Componente | Resultado observado |
|---|---|
| Docker Engine / Compose | 29.7.2 / 5.5.1. El daemon se invocó con la membresía `docker` habilitada mediante `newgrp docker`. |
| Node / npm / Vite resuelto por lockfile | 22.23.3 / 10.9.9 / 7.3.3. |
| Frontend | `npm ci`, `npm run typecheck`, `npm test` y build con `VITE_API_URL=/api VITE_STATIC_BASE=/api/static/` pasaron; 11 archivos y 54 tests Vitest. |
| Dependencias npm | `npm ci` informó 16 advisories: 1 low, 4 moderate y 11 high. No se aplicó `npm audit fix`; requiere triage, no un arreglo automático sin revisión. |
| Python / Django / Gunicorn | 3.13.15 / 6.0.2 / 23.0.0. |
| PostgreSQL desechable | Imagen `postgres:17`; versión observada 17.7. No se publicó puerto al host. |
| Migraciones/modelos | Migraciones aplicadas desde base vacía y `makemigrations --check --dry-run` pasaron. |
| Importador de tipos | Los 4 tests de `planning.tests.ImportTipoActividadXlsxCommandTests` pasaron, incluidos dry-run y preservación ante dedicación opuesta. |
| Suite Django | 78 tests pasaron. Solo el proceso del test runner recibió `SECURE_SSL_REDIRECT=False` porque Django Test Client ejercita HTTP; el servicio de smoke conservó el redirect HTTPS activo. |
| `check --deploy` | Terminó con warning W004 porque el harness dejó HSTS en 0. No se silenció ni cambió la política para forzar un resultado limpio. |
| Estáticos | `collectstatic --noinput`: 206 archivos copiados, 592 postprocesados. |
| Nginx | `nginx -t` pasó en la imagen `nginxinc/nginx-unprivileged:stable-alpine`. |

Una comprobación aislada adicional comunicada con HSTS=3600 y `SECURE_HSTS_INCLUDE_SUBDOMAINS=False`/`SECURE_HSTS_PRELOAD=False` indicó W005/W021. Consultar el texto emitido por la versión Django instalada y la guía oficial de [deployment checks](https://docs.djangoproject.com/es/6.0/howto/deployment/checklist/); esos avisos requieren decisión de dominio/política, no habilitar opciones automáticamente para silenciarlos.

### Smoke HTTPS, sesión, datos y backup

El harness generó una CA/certificado desechables para `creapp.test`; el cliente confió explícitamente en la CA y comprobó el hostname. HTTPS quedó publicado únicamente en `127.0.0.1` en el puerto alto `55564` de esta corrida. Pasaron:

- `/healthz`: HTTP 200, `text/plain`, cuerpo `ok`.
- `/` y una ruta SPA profunda: HTML.
- `/api`: redirect 308 a `/api/`, no fallback HTML.
- JS y CSS generados bajo `/api/static/`: 200, Content-Type correcto; JS leído por el probe, 490343 bytes.
- `/api/auth/csrf`, login y `/api/auth/me`: JSON CSRF, cookies Secure y sesión válidas; Django Admin accesible con usuario efímero.
- POST y GET autenticados de una unidad académica por API con CSRF, verificando lectura persistida en PostgreSQL; logout invalida sesión.
- Dump custom `pg_dump` y restore con `pg_restore --exit-on-error --single-transaction` en otra DB efímera; el conteo de `unidad_academica` usado por el smoke coincidió (1 origen / 1 restaurado). No equivale a una comparación integral de todos los datos.

Un intento inicial del harness recibió 400 por no incluir el Host de prueba en `ALLOWED_HOSTS`; tras añadir el Host efímero correcto, la corrida final pasó. No se cambió configuración de producto por ese error de fixture.

Durante la preparación también se corrigieron dos defectos del propio harness antes de la corrida final: un diseño con solo la red Docker `internal` no publicaba el puerto del proxy al host, así que se separó la red DB/API de la red API/Nginx; y el primer comando Django se invocó desde un cwd que descubría cero tests. La topología final publica únicamente HTTPS de Nginx en loopback, mantiene DB en su red interna y ejecuta la suite desde `backend/`. El test client HTTP desactiva `SECURE_SSL_REDIRECT` solo en ese proceso; la app smoke conserva HTTPS obligatorio.

Se ejecutó también `permission-proof.sh` en un contenedor Python efímero sin mounts ni puertos; el log registra los checks de release de solo lectura para el servicio, traversal para el servicio y `www-data`, entorno legible solo por la app y `STATIC_ROOT` escribible por ella/legible por Nginx. Es una prueba de permisos del fixture, no de una instalación host real.

## Límites de lo validado

La prueba cubrió los procesos en una topología Docker temporal y el código de la fuente archivada elegida. No instaló ni comprobó una VM host con systemd, PostgreSQL/Nginx nativos, unidad real de Gunicorn, DNS institucional, certificado público, firewall/NSG, conexión TLS a PostgreSQL remoto, Azure App Service, Static Web Apps ni comportamiento de cookies en navegadores con políticas third-party. No es benchmark ni certificación de capacidad o seguridad para producción. `/healthz` tampoco comprueba DB.

Docker Compose retiró exclusivamente el proyecto `creapp-selfhost-check-20260930163002-311477`, sus redes y volúmenes. Los contenedores previos `creapp-postgres` y `oracle-free` permanecieron detenidos e intactos. Se conservaron resultados, logs, source copy y dump de prueba; el archivo `runtime.env` y las claves privadas TLS se retiraron en cleanup. La corrida no usó SHA de producto como instrucción de deploy.
