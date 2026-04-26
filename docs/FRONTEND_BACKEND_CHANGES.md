# CRE APP - Detalle de implementacion (Frontend + Backend)

Fecha: 13 de febrero de 2026

---

## 1) Frontend (React + Vite + TypeScript)

### 1.1 Arquitectura general y rutas
- Enrutado por roles con React Router. Hay dos arboles principales: /docente y /admin.
- Se usa un layout compartido (sidebar + topbar + outlet) para ambas areas.
- Se agregan rutas de error (unauthorized, not found) para mejorar UX.

Archivos clave:
- frontend/src/App.tsx
  - Define rutas /login, /unauthorized, /docente/*, /admin/*, y fallback a 404.
  - Usa ProtectedRoute con requiredRole para controlar acceso.

- frontend/src/components/ProtectedRoute.tsx
  - Implementa la logica de sesion: si no esta autenticado redirige a /login.
  - Si el rol no coincide, redirige a /unauthorized.
  - Incluye paginas de acceso restringido y 404.

- frontend/src/components/Layout/DashboardLayout.tsx
  - Renderiza Sidebar, Topbar y el contenido por Outlet.

### 1.2 Autenticacion y sesiones
- Se integra autenticacion por sesion con Django, usando CSRF token en cada request.
- Se guarda el usuario autenticado en localStorage para persistir sesion en el UI.

Archivos clave:
- frontend/src/contexts/AuthContext.tsx
  - Maneja el estado de usuario, rol y autenticacion.
  - login() obtiene CSRF, envia credenciales y guarda name + role.
  - logout() limpia sesion local y llama al endpoint /auth/logout.

- frontend/src/services/api.ts
  - Axios con baseURL /api y withCredentials.
  - Interceptor request agrega X-CSRFToken desde cookie csrftoken.
  - Interceptor response redirige a /login en 401.

- frontend/src/pages/LoginPage.tsx
  - Login con usuario o email, password.
  - Redireccion segun rol devuelto por backend.

### 1.3 Navegacion y branding
- Sidebar dinamica por rol, con grupos (Gestion, Academia, Analitica).
- Topbar con titulo CRE APP, rol actual y boton de logout.

Archivos clave:
- frontend/src/components/Layout/Sidebar.tsx
  - Config de links por rol (docente y admin).
  - Accesos rapidos deshabilitados como placeholders.

- frontend/src/components/Layout/Topbar.tsx
  - Muestra rol y user name desde AuthContext.

### 1.4 Componentes reutilizables
- Se crean componentes para tarjetas, secciones y tablas.

Archivos clave:
- frontend/src/components/Common/SectionCard.tsx
  - Contenedor de seccion con titulo y accion opcional.

- frontend/src/components/Common/StatCard.tsx
  - Tarjeta de KPI con titulo, valor y pie.

- frontend/src/components/Tables/BasicTable.tsx
  - Tabla generica con columnas y filas dinamicas.

### 1.5 Paginas Docente

#### 1.5.1 Dashboard Docente
- KPI basados en datos reales (programas, actividades, horas totales).
- Tabla con programas recientes y chips de pendientes.

Archivo clave:
- frontend/src/pages/docente/Dashboard.tsx

#### 1.5.2 Programas Docente (CRUD completo)
- Carga de programas y data academica necesaria.
- Formularios desplegables con modo lectura (Ver), edicion parcial y creacion.
- Eliminar conectado a API.
- Soporta query param ?new=1 para abrir formulario.

Archivo clave:
- frontend/src/pages/docente/Programas.tsx

Detalles:
- Fetch paralelo de programas, planes, planes-estudio-ec y espacios.
- Mapeo de plan_ec_id a label plan+espacio.
- Create: POST /programas
- Update: PATCH /programas/:id
- Delete: DELETE /programas/:id

#### 1.5.3 Actividades Docente (CRUD completo)
- Carga de actividades, programas y tipos.
- Formulario con selects y modo lectura.
- Eliminar conectado a API.

Archivo clave:
- frontend/src/pages/docente/Actividades.tsx

Detalles:
- Create: POST /actividades
- Update: PATCH /actividades/:id
- Delete: DELETE /actividades/:id

#### 1.5.4 Perfil Docente
- Vista base con datos tipo placeholder.

Archivo clave:
- frontend/src/pages/docente/Perfil.tsx

### 1.6 Paginas Admin

#### 1.6.1 Dashboard Admin
- KPI globales: programas, docentes activos, usuarios totales.
- Tabla con programas en revision y chips de indicadores.

Archivo clave:
- frontend/src/pages/admin/Dashboard.tsx

#### 1.6.2 Programas Admin (solo lectura)
- Lista de programas con boton Ver y detalle.

Archivo clave:
- frontend/src/pages/admin/Programas.tsx

#### 1.6.3 Actividades Admin (solo lectura)
- Lista con lookup de programa y tipo.
- Detalle de actividad con horas.

Archivo clave:
- frontend/src/pages/admin/Actividades.tsx

#### 1.6.4 Usuarios Admin (alta, edicion y baja logica)
- Alta de docentes, edicion parcial, activar/desactivar.
- Baja logica con DELETE (is_active false en backend).

Archivo clave:
- frontend/src/pages/admin/Usuarios.tsx

#### 1.6.5 Academics Admin (solo lectura)
- Espacios curriculares con creditos y horas IP/TA.
- Carreras con unidad academica.
- Unidades academicas con detalle.

Archivos clave:
- frontend/src/pages/admin/EspaciosCurriculares.tsx
- frontend/src/pages/admin/Carreras.tsx
- frontend/src/pages/admin/UnidadesAcademicas.tsx

#### 1.6.6 Tipos de Actividad Admin (CRUD completo)
- Crear/editar/eliminar/ver detalle de tipos de actividad.

Archivo clave:
- frontend/src/pages/admin/TiposActividad.tsx

#### 1.6.7 Reportes Admin
- Vista base con export a PDF via window.print().

Archivo clave:
- frontend/src/pages/admin/Reportes.tsx

### 1.7 Estilos y UI
- Paleta FI UNCuyo y tipografias Fraunces + Manrope.
- Layout responsivo con sidebar sticky, cards, tablas y forms.

Archivos clave:
- frontend/src/index.css
- frontend/src/App.css

---

## 2) Backend (Django + DRF)

### 2.1 Rutas y API
- API centralizada en router DRF sin trailing slash.
- Endpoints expuestos para academics, planning y cuentas.

Archivos clave:
- backend/config/urls.py
  - Redirige / a /admin/.
  - Expone /api/.

- backend/config/api_urls.py
  - /auth/csrf, /auth/login, /auth/logout, /auth/me.
  - /programas, /actividades, /tipos-actividad, /usuarios.
  - /unidades-academicas, /carreras, /planes-estudio, /planes-estudio-ec, /espacios-curriculares, /configuracion-cre.

### 2.2 Configuracion
- Sesiones y CSRF habilitados para front local.
- DRF con SessionAuthentication y paginacion.

Archivo clave:
- backend/config/settings.py

### 2.3 Auth y cuentas

#### 2.3.1 Endpoints de auth
- CSRF: responde cookie via ensure_csrf_cookie.
- Login: autentica, inicia sesion, retorna username, name, role.
- Logout: cierra sesion.
- Me: devuelve usuario y rol actual.

Archivo clave:
- backend/accounts/views.py

#### 2.3.2 Serializers
- LoginSerializer soporta login con email o username.
- UserSerializer incluye role calculado desde perfil.
- UserCreateSerializer crea usuarios docentes y setea password.
- UserUpdateSerializer permite actualizar datos y password opcional.

Archivo clave:
- backend/accounts/serializers.py

#### 2.3.3 Permisos y viewset de usuarios
- IsAdminProfile restringe endpoints a rol ADMIN.
- UserViewSet incluye list/create/update/destroy.
- destroy aplica baja logica: is_active = False.

Archivos clave:
- backend/accounts/permissions.py
- backend/accounts/viewsets.py

### 2.4 Academics (modelos + API lectura)

#### 2.4.1 Modelos principales
- ConfiguracionCRE con singleton y get_hours_per_cre().
- UnidadAcademica, Carrera, PlanEstudio, PlanEstudioEC, EspacioCurricular.
- Constraints y validaciones basicas (unique, indices, help_text).

Archivo clave:
- backend/academics/models.py

#### 2.4.2 Serializers y viewsets
- Todos en modo ReadOnlyModelViewSet.
- Querysets ordenados y con select_related donde aplica.

Archivos clave:
- backend/academics/serializers.py
- backend/academics/viewsets.py

### 2.5 Planning (modelos, validaciones y API)

#### 2.5.1 Modelos
- Programa con UniqueConstraint por plan_estudio_ec + anio.
- AsignacionDocente con vigencia temporal, indices y constraint de rango.
- Manager activas() centraliza logica temporal.
- clean() documenta riesgo TOCTOU y valida solapamientos.
- TipoActividad con dedicacion y modalidad.

Archivo clave:
- backend/planning/models.py

#### 2.5.2 Serializers
- ProgramaCreate valida que el docente tenga asignacion activa.
- ActividadCreate valida que el docente tenga asignacion activa.
- Separacion de serializers para create/update.

Archivo clave:
- backend/planning/serializers.py

#### 2.5.3 ViewSets
- Filtro por asignaciones activas del docente.
- Admin ve todo (assigned_ids None).
- TipoActividad: CRUD solo admin, lectura para autenticados.
- Query params: plan_estudio_ec_id y programa_id.

Archivo clave:
- backend/planning/viewsets.py

### 2.6 Planning HTML (views + forms)
- Flujo HTML tradicional para docentes: seleccionar EC, dashboard, CRUD.
- Formularios validan unicidad de programa por anio.

Archivos clave:
- backend/planning/forms.py
- backend/planning/views.py
- backend/planning/templates/base.html
- backend/planning/templates/planning/seleccionar_ec.html
- backend/planning/templates/planning/dashboard_ec.html
- backend/planning/templates/planning/programa_form.html
- backend/planning/templates/planning/actividad_form.html
- backend/planning/templates/planning/actividades.html
- backend/planning/templates/planning/sin_asignaciones.html

---

## 3) Notas de integracion Frontend-Backend

- Frontend usa /api como baseURL y la session de Django para autenticar.
- Se solicita CSRF antes de login.
- Los endpoints CRUD de programas/actividades quedan filtrados por asignaciones.
- Admin puede gestionar usuarios y tipos de actividad desde el dashboard.

---

## 4) Pendientes opcionales (no implementado)

- Confirmaciones de borrado con modal/toast.
- Paginacion/filtrado en tablas.
- Reportes reales con datos calculados.
