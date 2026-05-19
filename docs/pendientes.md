# Pendientes — Frontend Modernization

## ✅ Completado

### Fase 1 — Flujos críticos
- Fix `DocenteProgramas` (CTAs invertidos)
- Fix Admin Dashboard (cálculo de actividades por programa)
- `ProtectedRoute` con loading accesible
- `LoginPage` con `autoComplete`, redirect si autenticado, copy corregido
- Redirect `/` según rol, `/docente` → `/docente/resumen`

### Fase 2 — Server State
- TanStack Query instalado y configurado en `main.tsx`
- Todas las páginas migradas a `useQuery`/`useMutation`: DocenteDashboard, AdminDashboard, Topbar, DocenteProgramas, PlanificacionIP, PlanificacionTA, DocenteEspacios, DocentePerfil, y 5 admin pages (Actividades, Carreras, EspaciosCurriculares, Programas, UnidadesAcademicas, TiposActividad, Usuarios)
- Estado de carga/error consistente en admin pages que faltaban

### Fase 3 — Formularios con react-hook-form + zod
- `LoginPage`
- `DocenteProgramas` (crear/editar programa, crear unidad)
- `AdminUsuarios` (crear/editar)
- `AdminTiposActividad` (crear/editar)
- `DocenteDiasCursado` (crear/editar)
- `DocenteActividades` (crear/editar)

### Fase 4 — UI/UX y Diseño
- Tokens de diseño en `index.css` (colores, sombras, radios)
- `App.css` (1719 lines) dividido en 9 módulos CSS
- `utilities.css` con clases de spacing reutilizables
- ~50 inline styles reemplazados por clases CSS
- 12 `className` duplicados corregidos
- `MobileNav` (bottom navigation para móvil)
- Radios de borde reducidos (`--radius-xl: 1rem` → `0.75rem`, `--radius-lg: 0.75rem` → `0.625rem`)

### Fase 5 — Calidad de Código
- ESLint config actualizado para cubrir `.ts`/`.tsx`
- TypeScript `strict: true` + `noUncheckedIndexedAccess`
- Script `typecheck` agregado
- 25 errores ESLint corregidos (unused vars, any, set-state-in-effect, exhaustive-deps)
- Build y typecheck pasan limpio (0 errores)
- `ConfirmDialog` reemplazado por `@headlessui/react` Dialog (focus trap, Escape)

### Testing
- Vitest + React Testing Library instalado y configurado
- Setup con `jsdom` y `@testing-library/jest-dom`
- Tests críticos base: Login, AuthContext, ProtectedRoute
- Test de accesibilidad/navegación de `PlanningCalendar`
- Test de paginación de `BasicTable`

### Avance adicional
- `PlanningCalendar` con roles ARIA (`grid`, `row`, `columnheader`, `gridcell`), `aria-selected`, `aria-current`, labels accesibles y navegación con flechas
- `PlanificacionIP` migrado a `react-hook-form` + `zod`
- `PlanificacionTA` migrado a `react-hook-form` + `zod`
- `PlanningActivityCommonFields` con labels visibles, `aria-invalid`, `aria-describedby` y errores accesibles
- `BasicTable` con paginación cliente opcional, resumen accesible y controles anterior/siguiente
- Paginación activada en tablas admin/docente principales
- Chunk splitting por ruta con `React.lazy` + `Suspense`; el chunk inicial bajó de ~737KB a ~483KB y el warning de Vite desapareció
- Tests de regresión de formularios: 9 archivos, 47 tests en total (Programas, DiasCursado, PlanificacionIP, PlanificacionTA, Actividades)
- Bugfix: generación de calendario desde PlanificacionIP (endpoint `generar-rango` era inalcanzable)
- `PlanningActivityCommonFields`: multi-select nativo reemplazado por checkboxes accesibles con `<fieldset>`/`<legend>`
- `Topbar`: menú de cuenta con navegación completa por teclado (Enter/Space, Escape, Arrow keys, Tab, focus management)
- Typecheck, ESLint, tests y build pasan limpio
- `.gitignore` actualizado (node_modules, .tmp, .venv, .opencode, etc.)
- Logo UNCuyo local (reemplazadas URLs remotas de iconape.com en Sidebar y LoginPage)
- Corrección de ~50 tildes/ortografía en 15 archivos (Gestión, Planificación, Seleccioná, días, Sábado, Miércoles, aún, etc.)
- Estados loading/error añadidos a 5 admin pages (Actividades, Carreras, Programas, UnidadesAcademicas, EspaciosCurriculares)

---

## ⏳ Pendientes por prioridad

*(No quedan items prioritarios. Los items below son diferibles para cuando el proyecto escale.)*

| Item | Descripción | Por qué diferir |
|---|---|---|
| Paginación server-side/filtros | Coordinar paginación con API | Datasets actuales son chicos; paginación cliente funciona |
| Sidebar estado expansión | Simplificar con CSS-only o contexto | Funciona bien; refactor cosmético |
| Animaciones/page transitions | Mejorar con Framer Motion | Sin impacto funcional |
| `useApiAutoRefresh` | Eliminar hook | Aún usado en DiasCursado, Actividades, AdminUsuarios, AdminTiposActividad; limpiar cuando migren |
| RUM con `web-vitals` | Instrumentar Core Web Vitals | Prematuro; haría falta backend |
| Responsive tables | Convertir tablas a cards en móvil | Scroll horizontal funciona |
| Dark mode | Tema oscuro | Overkill para MVP |

---

## Notas

- La app actualmente necesita el backend Django corriendo en `localhost:8000` para funcionar (API via Vite proxy)
- `useApiAutoRefresh` aún se usa en DiasCursado, Actividades, AdminUsuarios, AdminTiposActividad — no eliminar hasta migrar esas páginas a TanStack Query
