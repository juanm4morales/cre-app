# Backend config agent notes

- The admin entry path is coupled across `settings.py` login URLs, `urls.py` admin route, `PROXY_ACCESS_EXEMPT_PATHS`, and `frontend/src/App.tsx` `SadminRedirect`; change them together or admin/login will partially break.
- `ProxyAccessMiddleware` is effectively off until `PROXY_ACCESS_SECRET` is set. Once enabled, missing exempt prefixes for health/admin/static paths surface as misleading 403s instead of obvious deploy/config errors.
- When syncing `azure` into `azure-same-origin`, preserve the same-origin trio together: admin at `/sadmin-creapp-panel/`, `STATIC_URL` at `/static/`, and proxy exemptions that include `/static/`; the split-origin branch rewrites all three toward `/api/...`.
