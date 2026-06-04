# Planning agent notes

- Admin users see all planning data through `_assigned_ec_ids() == None`; docentes are scoped to their `AsignacionDocente` spaces.
- `AsignacionDocente.activo` is computed from dates, not stored; CRUD validation must reject inactive/non-docente users and overlapping date ranges for the same docente+espacio.
- `EspaciosCurricularesAsignadosViewSet` is also the docente self-service surface for temporary flows (`temporal/espacio`, `temporal/carga-horaria`, `temporal/asignarme`); keep its role guard and `AsignacionDocente.objects.activas()` checks aligned.
- Temporary space create/update flows derive `EspacioCurricular.creditos` from `horas_ip + horas_ta` using `ConfiguracionCRE.get_hours_per_cre()`; do not accept or trust client-supplied credits in these endpoints.
- Partial saves on `EspacioCurricular` need explicit `full_clean()` in the viewset; validators do not run automatically on `save(update_fields=...)`.
