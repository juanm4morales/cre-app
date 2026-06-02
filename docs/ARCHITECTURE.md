# Arquitectura — CREApp

---

## Decisión principal: Same-origin monolithic deployment

```
Frontend React + Django API + Django Admin
→ Todo en UN solo Azure App Service
→ Un solo dominio
```

### Por qué no separado

| Factor | Decisión |
|--------|----------|
| Plan F1 (gratis) | Un solo App Service = un solo plan consumible |
| Latencia | Mismo proceso, zero network hop |
| CORS | No necesario, same-origin |
| Cookies | Triviales, sin configuración extra |
| Complexity | Un deploy, un workflow, un servidor |

Separar SPA y API solo tiene sentido a escala media-grande, donde necesitás escalar independientemente o servir el SPA desde CDN global. Para este proyecto (app institucional de una facultad), no aplica.

---

## Routing en Django

```
backend/config/urls.py
├── /healthz                          → HttpResponse('ok')
├── /django-admin/                    → Django admin
├── /api/                            → DRF API (config.api_urls)
└── /{cualquier otra ruta}           → index.html (React SPA)
```

La última línea usa:

```python
re_path(r'^.*$', TemplateView.as_view(template_name='index.html'))
```

Esto captura cualquier URL que no matchee las anteriores y sirve el `index.html` del React build. Así React Router maneja internamente sus rutas (`/login`, `/planning`, `/docente/dashboard`, etc.).

---

## Frontend build pipeline

```
1. npm run build (Vite)
   → genera frontend/dist/ con assets en /static/assets/

2. python manage.py collectstatic
   → copia frontend/dist/ → backend/staticfiles/

3. WhiteNoise sirve /static/ en producción
```

`vite.config.js` tiene `base: '/static/'` para que todos los paths de assets sean absolutos desde `/static/`.

---

## apps Django

```
backend/
├── accounts/       # Usuarios y autenticación
├── academics/     # Espacios curriculares, competencias
├── planning/       # Programas, actividades, asignaciones
└── config/         # Settings, urls, wsgi
```

---

## Autenticación

- **Session-based** (Django contrib.auth)
- El frontend usa `credentials: 'include'` en fetch para enviar cookies
- DRF `SessionAuthentication` validates session on each request
- CSRF token requerido en POST/PUT/DELETE (Django standard)

---

## Variables de entorno sensibles

| Variable | Propósito |
|----------|-----------|
| `SECRET_KEY` | Django signing key — NUNCA commitear |
| `POSTGRES_PASSWORD` | Credenciales DB |
| `DEBUG` | `False` en producción |
| `ALLOWED_HOSTS` | Dominios válidos |

---

## Middleware clave

`ProxyAccessMiddleware` (`backend/config/middleware.py`) — bloquea acceso directo al backend cuando `PROXY_ACCESS_SECRET` está configurado. Previene que usuarios accedan directamente a `/api/` desde fuera del proxy/frontend.

---

## Pending improvements

Desde el análisis de auditoría:

1. **Tests en CI/CD** — el workflow actual no corre tests antes de deploy
2. **Versionado API** — `/api/v1/` si la API cambia breaking
3. **Key Vault** — secrets en Azure Key Vault en vez de App Settings
4. **Infra as Code** — Terraform para crear recursos Azure
5. **Custom domain** — `cre.fce.uncu.edu.ar` en vez de `cre-app-api.azurewebsites.net`
