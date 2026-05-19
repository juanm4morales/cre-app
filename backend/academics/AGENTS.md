# Academics agent notes

- `PlanEstudioEC` is not just catalog metadata: `Programa.plan_estudio_ec` uses `CASCADE`, so deleting/unlinking a plan-space relation can delete programs unless the API guards it.
- `Competencia` deletion is a soft delete via `activo=False`; normal list responses hide inactive competencies unless callers opt into inactive records.
