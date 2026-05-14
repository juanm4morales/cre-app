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
- `DocenteDashboard` migrado a `useQuery`
- `AdminDashboard` migrado a `useQuery`
- `Topbar` migrado a `useQuery` (espacios, planes)
- `DocenteProgramas` migrado a `useQuery` + `useMutation`
- 5 admin pages migradas a `useQuery` (Actividades, Carreras, EspaciosCurriculares, Programas, UnidadesAcademicas)

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

---

## ⏳ Pendientes por prioridad

### Prioridad Alta

| Item | Descripción | Archivos/Áreas |
|---|---|---|
| Escribir tests | Login, auth flow, ProtectedRoute, forms clave | `frontend/src/test/` |
| Convertir más forms a react-hook-form + zod | `PlanificacionIP`, `PlanificacionTA`, `DocenteEspacios`, Admin forms restantes | |
| Paginación | Tablas admin sin paginación ni virtualización, listas largas de actividades | `BasicTable.tsx`, admin pages |
| Accesibilidad — Calendar | Falta `role="grid"`, keyboard nav, `aria-selected`, `aria-current` | `PlanningCalendar.tsx` |

### Prioridad Media

| Item | Descripción |
|---|---|
| Migrar páginas restantes a TanStack Query | `PlanificacionIP`, `PlanificacionTA`, `DocenteEspacios`, `Perfil` |
| Multi-select accesible | Reemplazar `<select multiple>` nativo por checkbox group o combobox |
| Menú de cuenta keyboard | Implementar comportamiento completo ARIA menu button en Topbar |
| Sidebar estado expansión | Puede simplificarse con CSS-only o contexto compartido |
| UX móvil — Drawer | Evaluar si el bottom nav es suficiente o se necesita sidebar drawer |
| Estados vacío/error/loading | Unificar en todas las páginas (algunas no muestran errores) |
| Bundle logo UNCuyo | Reemplazar URLs remotas por asset local |
| Animaciones/page transitions | Mejorar con Framer Motion (ya instalado) |
| Copy — tildes/ortografía | Revisar textos en español ("Produccion", "rapidos", etc.) |
| Actualizar `.gitignore` | Incluir `.tmp/`, `dist/`, etc. |

### Prioridad Baja

| Item | Descripción |
|---|---|
| `useApiAutoRefresh` | Evaluar si aún se necesita o migrar por completo |
| Chunk splitting | El bundle JS es ~730KB, considerar lazy loading por ruta |
| RUM con `web-vitals` | Instrumentar Core Web Vitals |
| Responsive tables | Convertir tablas a cards en móvil |
| Dark mode | Proyectar si se desea tema oscuro |

---

## Notas

- La app actualmente necesita el backend Django corriendo en `localhost:8000` para funcionar (API via Vite proxy)
- `frontend/src/hooks/useApiAutoRefresh.ts` ya no se usa en páginas migradas a TanStack Query — se puede eliminar si todas las páginas migran
- El archivo `frontend/src/App.css` ahora solo importa los módulos; el contenido migrado está en `frontend/src/styles/`
