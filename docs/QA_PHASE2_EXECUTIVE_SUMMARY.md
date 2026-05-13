# QA Phase 2 — Informe Ejecutivo

**Fecha**: 2026-05-13
**Auditoría**: Seguridad, calidad de código, integración backend/frontend, dependencias.
**Objetivo**: Dejar el proyecto en condiciones para prueba con usuarios finales vía túnel.

---

## 1. Resumen General

| Métrica | Antes | Después |
|---|---|---|
| Backend tests | 29 | **65** (+36) |
| Frontend tests | 0 | 0 (gap de cobertura) |
| TypeScript strict (`tsc --noEmit`) | 6 errores | **0 errores** |
| ESLint | 0 errores | 0 errores |
| Vulnerabilidades npm | 10 (6 high, 4 moderate) | **0** |
| Django `check --deploy` | 6 warnings | **0 warnings** (con perfil hardening) |
| CSRF coverage | 0 tests | **8 tests** |
| Auth/permisos coverage | 0 tests | **26 tests** |
| Planning CRUD coverage | 0 tests | **10 tests** |

---

## 2. Bugs Reales Encontrados y Corregidos

### Bug 1 — Admin bloqueado de crear programas/unidades/actividades vía API
| Campo | Valor |
|---|---|
| **Severidad** | 🔴 Alta |
| **Archivo** | `backend/planning/serializers.py` línea 20, función `_docente_asignado()` |
| **Síntoma** | Admin logueado hace `POST /api/programas` y recibe `400: "No tienes asignado este espacio curricular"` |
| **Causa raíz** | `_docente_asignado()` consulta `AsignacionDocente.objects.activas()` para **cualquier** usuario, sin exceptuar admin. Los viewSets sí distinguen admin (devuelven `None` = sin restricción), pero los serializers no. |
| **Impacto** | Admin no podía crear programas, unidades ni actividades desde la UI o API sin tener una asignación docente activa. Los botones de creación admin eran funcionalmente rotos. |
| **Fix** | Agregar bypass: `if getattr(user, 'profile', None) and user.profile.role == 'ADMIN': return True` |
| **Tests que lo detectaron** | `test_04_docente_cannot_see_other_ec_programs`, `test_10_docente_cannot_delete_other_ec_program` |

### Bug 2 — Create serializers no devuelven `id` en POST response
| Campo | Valor |
|---|---|
| **Severidad** | 🔴 Alta |
| **Archivos** | `ProgramaCreateSerializer`, `UnidadCreateSerializer`, `ActividadCreateSerializer` |
| **Síntoma** | `POST /api/unidades` retorna `201 Created` pero el body no contiene `"id"`. El frontend no puede encadenar operaciones con el objeto recién creado. |
| **Causa raíz** | DRF `CreateModelMixin` retorna `serializer.data` usando el serializer de creación. Si el serializer no incluye `id` en `Meta.fields`, el campo no aparece en la respuesta. |
| **Fix** | Agregar `"id"` a `Meta.fields` en los tres serializers de creación. |
| **Tests que lo detectaron** | `test_01_docente_full_flow_create_program_unidades_actividades` (primer `resp.json()["id"]` falló con KeyError) |

### Bug 3 — Password validation no se aplicaba en API de usuarios
| Campo | Valor |
|---|---|
| **Severidad** | 🟡 Media |
| **Archivos** | `UserCreateSerializer`, `UserUpdateSerializer` |
| **Síntoma** | Admin podía crear usuarios con `password = "123"` — Django tiene validators configurados en settings pero nunca se invocaban. |
| **Causa raíz** | Django no llama automáticamente a `validate_password()` en modelos ni serializers; debe hacerse explícito. |
| **Fix** | Agregar `def validate_password(self, value): from django.contrib.auth.password_validation import validate_password; validate_password(value); return value` |
| **Tests que lo detectaron** | `PasswordValidationGapTest` (2 tests intencionales de detección QA) |

---

## 3. Bugs Potenciales Detectados (No Corregidos)

Los siguientes hallazgos se documentan pero **no se corrigieron** porque son trade-offs conocidos o requieren decisión de producto:

| Hallazgo | Riesgo | Nota |
|---|---|---|
| `CompetenciaViewSet.destroy` hard-delete en vez de soft-delete | 🟡 Medio | Consistencia: el resto del planning usa soft-delete. Las competencias usan `activo=True` en queryset pero `destroy()` del ModelViewSet por defecto ejecuta `DELETE` real. |
| `ClaseCalendarioViewSet` no overridea `destroy` | 🟡 Medio | Igual que competencias: hard-delete por defecto cuando el patrón del proyecto es soft-delete. |
| Login sin CSRF permitido cuando no hay sesión | 🟢 Bajo | DRF SessionAuthentication solo exige CSRF para sesiones autenticadas. Es trade-off de usabilidad vs seguridad. |
| DEBUG=True por defecto en desarrollo | 🟡 Medio | Corregido vía env var para hardening, pero dev sigue con DEBUG=True. Asegurar que el `.env` de demo tenga `DEBUG=False`. |
| Sin rate limiting ni login throttling | 🟡 Medio | Para beta abierta, no hay protección contra fuerza bruta en login. |
| Vite dev server expuesto en túnel | 🟡 Medio | El proxy de Vite a Django es correcto, pero Vite sirve HMR/middleware de desarrollo al público. Aceptable para demos cortas. |

---

## 4. Cobertura de Tests — Desglose

### 4a. CSRF Integration (`config/tests_csrf.py`) — 8 tests
```
csrf_endpoint_sets_cookie           ✅ GET /api/auth/csrf → cookie seteada
login_works_without_csrf            ✅ POST login sin CSRF → 200 (sin sesión)
login_with_csrf_succeeds            ✅ POST login con CSRF → 200
logout_without_csrf_fails           ✅ POST logout sin CSRF → 403
mutation_without_csrf_fails         ✅ POST /competencias sin CSRF → 403
mutation_with_csrf_admin_succeeds   ✅ Admin POST /competencias con CSRF → 201
docente_mutation_blocked            ✅ Docente POST /competencias → 403 (permiso)
invalid_csrf_token_rejected         ✅ POST con token inválido → 403
```

### 4b. Accounts (`accounts/tests.py`) — 26 tests
| Suite | Tests | Cubre |
|---|---|---|
| `LoginSerializerTest` | 6 | Login por username, email, usuario inactivo, credenciales inválidas, campos faltantes |
| `UserCreateSerializerTest` | 3 | Password hasheado, rol DOCENTE default, password faltante |
| `UserUpdateSerializerTest` | 3 | Update básico, cambio password, toggle is_active |
| `PasswordValidationGapTest` | 2 | Detector de que validate_password NO se invoca (gap detector) |
| `MeEndpointTest` | 4 | Auth requerido, shape del response, rol default vs admin |
| `UserViewSetIntegrationTest` | 8 | Admin CRUD vía API, soft-delete (is_active=False), superuser excluido, docente bloqueado de create/destroy |

### 4c. Planning Integration (`planning/tests.py:PlanningFullFlowIntegrationTest`) — 10 tests
| Test | Escenario |
|---|---|
| `test_01` | **Full flow docente**: espacios-asignados → create_programa_if_needed → unidades → días-clase → generar-rango → actividad IP → actividad TA |
| `test_02` | **Soft-delete cascade**: DELETE programa → programa.activo=False, unidades.activo=False, actividades.activo=False |
| `test_03` | **Scoping docente**: docente bloqueado de crear programa en otra EC → 403 |
| `test_04` | **Scoping docente GET**: docente no ve programas de otra EC |
| `test_05` | **Admin ve todos los ECs**: GET /espacios-asignados retorna ambos |
| `test_06` | **TipoActividad lectura pública**: cualquier auth puede leer |
| `test_07` | **TipoActividad create admin-only**: docente → 403 |
| `test_08` | **Competencia assignment**: POST /unidades/{id}/competencias |
| `test_09` | **Ajustes de actividad**: POST /actividades/{id}/ajustes (EXTENSION) |
| `test_10` | **Scoping delete**: docente DELETE sobre programa de otra EC → 404 |

---

## 5. Postura de Seguridad

### 5a. Antes del hardening
```
? W004  SECURE_HSTS_SECONDS       no seteado
? W008  SECURE_SSL_REDIRECT       no seteado
? W009  SECRET_KEY                 débil / django-insecure-
? W012  SESSION_COOKIE_SECURE      False
? W016  CSRF_COOKIE_SECURE         False
? W018  DEBUG=True                 en despliegue
```

### 5b. Después del hardening (vía env vars)
| Warning | Estado | Control |
|---|---|---|
| DEBUG=True | ✅ Controlable vía `DEBUG=False` en .env | Configurable sin tocar código |
| SECRET_KEY insegura | ✅ Forzada cuando DEBUG=False: `ImproperlyConfigured` | Requiere SECRET_KEY fuerte en .env |
| SESSION_COOKIE_SECURE | ✅ Controlable vía env var | `bool(env("SESSION_COOKIE_SECURE", "False"))` |
| CSRF_COOKIE_SECURE | ✅ Controlable vía env var | `bool(env("CSRF_COOKIE_SECURE", "False"))` |
| SECURE_SSL_REDIRECT | ✅ Controlable vía env var | `bool(env("SECURE_SSL_REDIRECT", "False"))` |
| HSTS | ✅ Controlable vía env var | `int(env("SECURE_HSTS_SECONDS", "0"))` |
| SameSite cookies | ✅ Controlable vía env var | SESSION_COOKIE_SAMESITE, CSRF_COOKIE_SAMESITE |

**Settings se comportan distinto según entorno**: detecta automáticamente si `DEBUG=False` + las env vars están presentes, activando cookies seguras, HSTS, SSL redirect, y secret key fuerte.

### 5c. CSRF
- Flujo: `GET /api/auth/csrf` → cookie `csrftoken` → frontend envía `X-CSRFToken` en cada mutación ✅
- Vite proxy: override de `Origin` a `localhost:5173` para que Django acepte requests de cualquier dominio del túnel ✅
- Tests: positivos (login+CSRF), negativos (sin CSRF, token inválido) ✅
- Sesión: `SessionAuthentication` con `withCredentials=true`, same-origin via Vite proxy ✅

---

## 6. Salud de Dependencias

### Frontend (npm)
```
Antes:  10 vulnerabilidades (6 high, 4 moderate)  ┐
                                                   ├── npm audit fix
Después: 0 vulnerabilidades                        ┘
         Vite: 7.2.4 → 7.3.3
         Build: 423 KB gzip (sin cambios funcionales)
```

### Backend (pip)
```
pip check: No broken requirements found ✅
Principales: Django 6.0.2, DRF 3.16.1, psycopg 3.2.13
```

---

## 7. Riesgos Remanentes para Beta

| Riesgo | Detalle | Mitigación |
|---|---|---|
| Sin tests E2E (Playwright/Cypress) | No hay pruebas automáticas de UI que recorran login → CRUD → logout | Pruebas manuales requiridas |
| Sin rate limiting en login | Ataque de fuerza bruta posible | Agregar `django-ratelimit` o middleware |
| Sin backup de base de datos | Datos de prueba podrían perderse | Backup manual o script antes de demo |
| Sin monitoreo de errores | Bugs silenciosos durante demo | Revisar logs del servidor |
| Vite dev server expuesto | HMR/middleware de desarrollo accesible al público | Aceptable para demos cortas. No usar para beta >24h |
| Sin autenticación de túnel | Cualquiera con la URL puede acceder | Basic Auth opcional en Vite (TUNNEL_BASIC_AUTH_USER/PASS) |

---

## 8. Recomendaciones para Puesta en Beta

1. **Antes de compartir URL**:
   - Crear `.env` de demo con: `DEBUG=False`, `SECRET_KEY=<fuerte>`, cookies secure, HSTS
   - Activar Basic Auth si el grupo es cerrado (`TUNNEL_BASIC_AUTH_USER`/`TUNNEL_BASIC_AUTH_PASS`)
   - Resetear base de datos con fixtures de prueba
   - Verificar que `npm run build` está corriendo (el tunnel usa Vite dev, pero build debe funcionar)

2. **Limpiar sesiones previas**:
   - Ejecutar `python manage.py clearsessions`
   - Verificar que no hay usuarios/admin con contraseñas débiles

3. **Checklist de funcionalidades testear**:
   - ✅ Login como admin y como docente
   - ✅ Admin: CRUD usuarios, tipos-actividad, ver todos los ECs
   - ✅ Docente: seleccionar EC, crear programa, crear unidades, configurar días de cursado, generar calendario, crear actividades IP y TA
   - ✅ Soft-delete: eliminar programa, verificar que desaparece de listas
   - ✅ Cerrar sesión, verificar que no se puede acceder a rutas protegidas
   - ✅ CSRF: abrir DevTools, verificar que mutaciones incluyen X-CSRFToken

4. **No compartir**:
   - URL del admin de Django (`/admin/`)
   - URLs de archivos estáticos
   - `.env` ni secretos

---

## 9. Archivos Modificados

### Backend
| Archivo | Cambio |
|---|---|
| `backend/accounts/serializers.py` | +`validate_password` en UserCreateSerializer y UserUpdateSerializer |
| `backend/accounts/tests.py` | **Nuevo**: 26 tests de accounts (login, CRUD, roles, passwords) |
| `backend/config/settings.py` | +`env_bool()`, +env vars para hardening, SECRET_KEY forzada en DEBUG=False |
| `backend/config/tests_csrf.py` | **Nuevo**: 8 tests CSRF (de phase 1) |
| `backend/planning/serializers.py` | Fix `_docente_asignado` bypass admin; +`id` en create serializers |
| `backend/planning/tests.py` | **+10 tests** de integración planning full-flow |

### Frontend
| Archivo | Cambio |
|---|---|
| `frontend/src/components/Layout/Topbar.tsx` | Fix TypeScript strict: returns `string|undefined`, paginated type union, type guard |
| `frontend/src/pages/docente/Espacios.tsx` | Fix TypeScript strict: paginated type union, type guard |
| `frontend/package-lock.json` | npm audit fix (Vite 7.3.3, 0 vulns) |
| `frontend/eslint.config.js` | +`globals.node` (de phase 1) |
| `frontend/vite.config.js` | +Origin override proxy (de phase 1) |

---

## 10. Comandos de Verificación Rápida

```bash
# Backend
cd backend
python manage.py test -v 2                          # 65 tests

# Frontend
cd frontend
npx tsc --noEmit                                     # 0 errors
npm run lint                                          # 0 errors
npm run build                                         # build exitoso
npm audit --audit-level=moderate                      # 0 vulnerabilities

# Security
cd backend
DEBUG=False python manage.py check --deploy           # 0 warnings
```

---

*Documento generado automáticamente post-QA Phase 2. Para actualizar, re-ejecutar la batería de verificación.*
