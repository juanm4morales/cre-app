# Planning agent notes

- Admin users see all planning data through `_assigned_ec_ids() == None`; docentes are scoped to their `AsignacionDocente` spaces.
- `AsignacionDocente.activo` is computed from dates, not stored; CRUD validation must reject inactive/non-docente users and overlapping date ranges for the same docente+espacio.
