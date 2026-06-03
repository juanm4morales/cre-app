# Docente pages agent notes

- The docente planning flow is keyed off sessionStorage (`selected_espacio_curricular_id`, `selected_plan_estudio_ec_id`, `selected_espacio_nombre`) set in `Espacios.tsx`; `Dashboard.tsx`, `Programas.tsx`, `PlanificacionIP.tsx`, and `PlanificacionTA.tsx` all depend on the same keys.
- `Dashboard.tsx` is intentionally filtered to the selected space only; if there is no current-year program, activity aggregation must fall back to that space's older programs, not the docente's global program list.
- Keep alert/warning badges out of the `page-header` hero on the docente dashboard; workload state is intentionally surfaced inside the "Carga del espacio curricular" card to avoid duplicate warning emphasis.
- The yellow workload state covers both “below target” and “barely over target”; labels must stay neutral (`A revisar`-style), not proximity wording like “Cerca del límite”.
- TA live feedback in `PlanificacionTA.tsx` gets target hours from `/espacios-asignados` plus `selected_espacio_curricular_id`; if you change the selection flow, update the feedback query/path together.
- The temporary space tools in `Espacios.tsx` have create and assign-existing modes, but both must invalidate `['espacios-asignados']` and `['planes-estudio-ec']` and then refresh the same sessionStorage selection keys.
