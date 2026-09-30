# Azure release plan

**Plan only.** No Azure, Git, or database action is authorized here. The app/database are pre-launch, not a production user-data service: the app has never gone to production and the database contains test/pre-launch data that may be cleaned and freshly imported. That does not itself authorize deleting or replacing data. Azure remains the authoritative product branch; preserve historical branches and do not change CI/CD as part of this plan.

**Maintainability:** keep one product source (`azure`) and one documented installation path. Historical branches are reference only, not compatibility targets. Do not add deprecated adapters, duplicate installers, or speculative migrations. Keep the current migration chain while any database still relies on it; consider simplifying it only after an explicitly authorized reset and a verified install from an empty database.

## Known state at audit time

- App Service `cre-app-api` is stopped. PostgreSQL Flexible Server `cre-app-db` was **Ready** at inspection time, in Chile Central, `Standard_B1ms`, publicly networked, with 7-day backup retention. Observed `earliestRestoreDate`: `2026-09-24T03:38:30Z`; this is time-sensitive and must be rechecked. No restored test server exists. Stopping App Service does not stop PostgreSQL; the no-new-backups-while-stopped caveat applies only if the database server itself is stopped.
- The database records `planning.0011_seed_ip_tipo_actividad` in `django_migrations`; 0012 is absent, and all four `Programa` fields from 0012 are absent.
- Local safety fix: branch `omos/product-azure-safety`, commit `6cfae3c`. `origin/azure` at `7180921` still has the original 0011 behavior: for each catalog name it changes an existing same-name `TipoActividad.tipo_dedicacion` to `IP`, potentially changing a TA record. The fix is not yet authoritative. Do not assume the historical effect or data disposition; resolve only what is needed for the chosen path.
- `.github/workflows/deploy.yml` runs on pushes to both `main` and `azure`; it builds same-origin SPA config (`VITE_API_URL=/api`, `VITE_STATIC_BASE=/api/static/`), collects static files, and deploys, but does not migrate. A push to `azure` is an automatic deployment trigger. `.github/workflows/main_cre-app-api.yml` also deploys to the same App Service on `main`, duplicating deployment. Do not use `main` as a release path.
- `scripts/release.sh` runs migrations and imports academic XLSX data. Do not use it as a generic migration or initialization command.
- Migration 0012 adds `fundamentacion`, `objetivos_generales`, `objetivos_especificos`, and `competencias` to `Programa`. Migration 0009 removes `TipoActividad.modalidad_trabajo`; its legacy-data risk is unresolved. Do not publish `main`.

## Decisions required before execution

The owner must explicitly decide and record:

1. Which exact test/pre-launch data must be retained, if any, and which dataset/tables are in scope for a reset.
2. Whether to keep the existing database (Path A) or authorize replacing/resetting it (Path B). “Likely to wipe” is not permission.
3. What the academic importer reads, creates, updates, or overwrites, and the intended source/version and expected outcome for a clean import.
4. If keeping data: which verified recovery copy is required, or whether the owner explicitly accepts that test data may be unrecoverable. If resetting: whether to take an optional logical backup or use PITR before authorized loss of scoped data. A temporary PITR server can incur cost; recheck the 7-day restore window and database-server state.
5. Which exact Azure code SHA is approved, and who separately authorizes migration/reset, deployment, and starting the stopped app.

## Common gates

Each gate requires an explicit go decision. A failed or unverified gate is **NO-GO**.

1. **Confirm identity and state read-only.** Verify subscription, tenant, resource group, server, region/tier, App Service state, database migration history/schema, and current backup/restore window. Use authorized least-privilege access; no credentials in commands/logs. Do not access the app through an untracked workflow.
2. **Choose exactly one data path below.** Complete its isolated tests and obtain explicit owner approval. Do not run a destructive operation or infer authorization from the pre-launch status.
3. **Pin compatible source.** Require an explicitly approved Azure SHA containing the corrected 0011 seed **and** importer collision guard (`6cfae3c` is still local); otherwise stop for a separate safety decision. Review the migration graph and validate code/schema compatibility before deployment. Editing the already-applied 0011 file does not rerun it or undo earlier row changes. Do not deploy `main` (0009 has unresolved legacy-data risk, and `main` has duplicate deploy triggers).
4. **Release only after approval.** The workflow does not run migrations. Execute the specifically approved database action separately and verify it. One authorized push of the approved SHA to `azure` automatically triggers `deploy.yml`: do **not** also dispatch it manually. Confirm target and deployed artifact SHA; do not assume deployment leaves a stopped App Service stopped. Starting/restarting requires separate authorization.
5. **Smoke-test only after explicit start approval.** Allow at least 90 seconds for cold start. Verify health, same-origin SPA/API/static assets, authentication, and representative application behavior. Stop if code/schema compatibility or checks fail.

## Path A — keep existing test database

Use this path only if the owner chooses to retain the existing database/data.

1. If these test records must be recoverable, require a verified restorable copy before changing the database; otherwise record the owner's explicit acceptance that they may be unrecoverable. A paid PITR test server is optional if another verified recovery method meets the chosen guarantee. PITR creates a new server, not an in-place rollback; recheck the database server's state and restore window.
2. In an isolated disposable database, test the exact pinned code/migration plan and apply only `planning.0012_programa_competencias_programa_fundamentacion_and_more`. Validate migration history, all four columns, existing `Programa` data, and representative application reads/writes. Test any required 0011 source fix separately; do not assume old 0011 effects can be inferred or reversed.
3. With the app still stopped and explicit approval, apply only the tested 0012 migration to the existing database using the pinned SHA. Verify migration history, columns, and retained data. No bulk import or `scripts/release.sh`.
4. Recovery, if needed, depends on the chosen backup: restore to a new server and explicitly re-point only if approved, or use the approved logical-backup recovery plan. Do not reverse 0011/0012 without a reviewed data plan.

## Path B — explicitly reset pre-launch data and initialize cleanly

Use only after explicit, scoped owner authorization identifies what will be replaced and confirms the importer/source and its side effects. No deletion or reset is performed by this plan.

1. Optionally take a snapshot/logical backup or choose PITR according to the owner’s retention and cost preference. PITR temporary-server restore is not mandatory. A backup is not permission to reset.
2. In an isolated disposable database, test the approved clean-schema initialization using the exact pinned Azure code. Validate the complete migration graph and final schema, including 0012’s four `Programa` columns; do not test by modifying the existing database. Confirm the exact importer inputs, side effects, expected records, and repeat behavior. Do not run `scripts/release.sh`.
3. Only after explicit reset and initialization approval, an authorized operator may reset/recreate the scoped pre-launch database and initialize its schema from the tested pinned code. Then perform the separately approved controlled import and verify counts/content. Never infer “wipe” authorization from likely intent.
4. If clean initialization/import fails, stop. Recovery is either restore from the owner-approved snapshot/PITR to a new server and re-point with approval, or repeat the clean initialization/import from the verified source if the owner accepts loss of the reset test data. Do not improvise rollback or reverse migrations.

## Source-first variant and deployment cautions

Review the local 0011 safety fix and, only with explicit source/deployment approval, land it on authoritative `azure` while preserving historical branches. A push to `azure` triggers `deploy.yml` automatically but does not migrate: push the approved SHA once, not followed by manual dispatch. Keep `main` unpublished: its 0009 removal can affect legacy data and its push triggers two workflows targeting the same App Service. Historical 0011 uncertainty was accepted only for non-deploy pushes; any deployment requires explicit acceptance and the selected data/recovery plan.

## Go/no-go checklist

- [ ] Owner answered all five decisions above, including exact data retention/reset scope, recovery guarantee or accepted loss, and importer side effects.
- [ ] Correct Azure identities/resources and current states confirmed read-only; chosen backup/cost/restore option explicitly recorded.
- [ ] Exactly one path selected; isolated disposable-database checks passed against the exact proposed SHA.
- [ ] Approved Azure SHA includes safe 0011 and importer behavior; schema/code compatibility verified, historical effects explicitly accepted; `main` is not being released.
- [ ] Database operation, one deployment, and any app start each explicitly authorized; exact target and SHA confirmed.
- [ ] Recovery option matches the owner’s accepted data-loss boundary; smoke test and >=90-second cold-start allowance ready.

**Any unchecked item: NO-GO.** Database changes and App Service start require separate authorization; an approved push to `azure` automatically triggers deployment.

## Command examples (operator-run only)

Examples only, not authorization. Confirm resource identifiers first; never put credentials in shell history or logs.

```sh
# READ-ONLY: inspect identity and resource state
az account show --query '{subscription:id,tenant:tenantId}'
az postgres flexible-server show --resource-group '<resource-group>' --name 'cre-app-db' --query '{location:location,state:state,sku:sku.name,backup:backup}'
az webapp show --resource-group '<resource-group>' --name 'cre-app-api' --query '{state:state,host:defaultHostName}'

# READ-ONLY: inspect migration plan from the pinned code in an isolated environment
python manage.py migrate planning 0012_programa_competencias_programa_fundamentacion_and_more --plan

# DATABASE-MUTATING: only after Path A approvals/tests; app remains stopped
python manage.py migrate planning 0012_programa_competencias_programa_fundamentacion_and_more --noinput
```

Path B reset/initialization and import commands are intentionally omitted because scope and importer effects require owner decisions first. No command here authorizes deployment or app start. Do not run `scripts/release.sh`.

## References

- Microsoft: [Backup and restore concepts for Azure Database for PostgreSQL Flexible Server](https://learn.microsoft.com/azure/postgresql/flexible-server/concepts-backup-restore) — PITR creates a new server; review retention, cost, and stopped-server backup caveats.
- Microsoft: [Restore to a custom restore point](https://learn.microsoft.com/azure/postgresql/flexible-server/how-to-restore-custom-restore-point).
