# Academics agent notes

- `PlanEstudioEC` is not just catalog metadata: `Programa.plan_estudio_ec` uses `CASCADE`, so deleting/unlinking a plan-space relation can delete programs unless the API guards it.
- `Competencia` deletion is a soft delete via `activo=False`; normal list responses hide inactive competencies unless callers opt into inactive records.
- `import_academic_xlsx` creates docentes with `set_unusable_password()` and active `AsignacionDocente` rows; imported users are assignable immediately but are not login-ready until another flow sets credentials.
- `ConfiguracionCRE.get_hours_per_cre()` is consumed outside academics by planning's docente self-service endpoints to auto-calculate `EspacioCurricular.creditos`; changing that equivalence changes temporary assignment/edit flows too.
