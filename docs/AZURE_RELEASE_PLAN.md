# Azure release plan

**Status (prior audit report; not reverified in this session):** the database was reported at migration `0012`, with all four added `Programa` fields present. The seed/importer safety fix was published to `origin/azure` as `6cfae3c`. These are separate events: source publication does not establish deployment, migration state, app start, or a successful smoke test. The prior audit reported App Service `cre-app-api` as `Stopped`, never started, and no smoke test run; recheck all live state before acting. This remains a release checklist, not a verified current-state record.

**Plan only.** No Azure, Git, or database action is authorized here. The prior audit described the app/database as pre-launch, not a production user-data service, with test data potentially eligible for a controlled fresh import. Reconfirm that classification; it does not authorize deleting or replacing data. `azure` remains the authoritative product branch; preserve historical branches and do not change CI/CD as part of this plan.

**Maintainability:** keep one product source (`azure`) and one documented installation path. Historical branches are reference only, not compatibility targets. Do not add deprecated adapters, duplicate installers, or speculative migrations. Keep the current migration chain while any database still relies on it; consider simplifying it only after an explicitly authorized reset and a verified install from an empty database.

## State reported by the prior audit (recheck before acting)

- The prior audit reported App Service `cre-app-api` stopped and PostgreSQL Flexible Server `cre-app-db` **Ready** in Chile Central, `Standard_B1ms`, publicly networked, with 7-day backup retention. It recorded `earliestRestoreDate` as `2026-09-24T03:38:30Z`; that is a restore-window boundary, not the audit/inspection date, and is time-sensitive. Recheck it, server/App Service state, and whether a restored test server exists. Stopping App Service does not stop PostgreSQL; the no-new-backups-while-stopped caveat applies only if the database server itself is stopped.
- The prior audit reported the database at `planning.0012_programa_competencias_programa_fundamentacion_and_more`, no pending migrations or model/migration drift, and all four 0012 `Programa` fields present. Treat this as a reported snapshot, not a current observation.
- Git facts in this session: this documentation checkout is `a3d9a21` on `docs/developer-handbook`; `origin/azure` points to `6cfae3c`. The safety fix is published on `origin/azure`, but is not in this documentation branch. Do not mistake the docs branch for deployable product source. The fix makes the seed create only missing `TipoActividad` names, and the XLSX importer reject a name whose dedication differs instead of mutating it. The reported pre-launch database had already run the earlier 0011; publishing the fix does not repair that historical effect.
- Deployment workflow triggers are source/variant-specific; a branch push is not evidence that a particular live app is running that artifact:

  | Source / workflow | Push trigger and behavior |
  | --- | --- |
  | `azure` product source: `.github/workflows/deploy.yml` | Pushes to `main` and `azure`; builds same-origin config (`VITE_API_URL=/api`, `VITE_STATIC_BASE=/api/static/`), collects static files, deploys, but does not migrate. An approved push to `azure` triggers deployment. |
  | `azure` product source: `.github/workflows/main_cre-app-api.yml` | Also deploys to the same App Service on `main`, duplicating deployment. Do not use `main` as a release path. |
  | `azure-same-origin` variant at `37a32f1` | Both App Service workflow files list pushes to `main` and `azure`, so those definitions would compete if used on either named branch. Pushing `azure-same-origin` itself matches neither filter. Its definitions do not determine which workflows run for the current `azure` snapshot. |
  | SWA workflow in product/docs/chore snapshots | Push trigger is disabled; Pull Request events targeting `azure` still configure preview upload/close actions. This is not limited to documentation changes. The SWA workflow is absent from the inspected same-origin variant; none of these definitions establishes the active live entrypoint. |
- These workflow facts distinguish source publication, deployment, migration, app start, and smoke testing; verify each separately. Do not infer a live deployment from a branch or workflow definition.
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
3. **Pin compatible source.** Require an explicitly approved Azure SHA containing the corrected 0011 seed **and** importer collision guard (published at `origin/azure` as `6cfae3c`); otherwise stop for a separate safety decision. Review the migration graph and validate code/schema compatibility against that pinned source before deployment. Editing the already-applied 0011 file does not rerun it or undo earlier row changes. Do not deploy `main` (0009 has unresolved legacy-data risk, and `main` has duplicate deploy triggers).
4. **Release only after approval.** Source publication does not prove a successful deployment; the deployment workflow does not run migrations or smoke tests. Deployment may affect process state: do not assume it leaves a stopped App Service stopped. Execute only the specifically approved database action separately and verify it. One authorized push of the approved SHA to `azure` matches `deploy.yml`'s trigger: do **not** also dispatch it manually. Check live workflow enablement and confirm target, actual process state and deployed artifact SHA. Starting/restarting requires separate authorization.
5. **Smoke-test only after explicit start approval.** Allow at least 90 seconds for cold start. Verify health, same-origin SPA/API/static assets, authentication, and representative application behavior. Stop if code/schema compatibility or checks fail.

## Path A — keep existing test database

Use this path only if the owner chooses to retain the existing database/data.

1. If these test records must be recoverable, require a verified restorable copy before changing the database; otherwise record the owner's explicit acceptance that they may be unrecoverable. A paid PITR test server is optional if another verified recovery method meets the chosen guarantee. PITR creates a new server, not an in-place rollback; recheck the database server's state and restore window.
2. Against the exact pinned corrected source, verify the target database's migration history and schema; reconcile them with the reported snapshot rather than assuming it is current. In an isolated disposable database, test the compatible migration plan and validate all four columns, existing `Programa` data, and representative application reads/writes. Do not rerun or unapply 0012 on the reported database if it is already applied. If a different database is confirmed to be missing 0012, applying it is only conditional on explicit owner/operator approval, isolated testing, and all applicable gates. Test any required 0011 source fix separately; do not assume old 0011 effects can be inferred or reversed.
3. Only if the existing target is verified to be missing 0012, and after the approvals/tests above, apply only the tested migration with the pinned SHA while the app remains stopped. Verify migration history, columns, and retained data. If 0012 is already applied, do not rerun, unapply, or attempt a fake repair; no bulk import or `scripts/release.sh`.
4. Recovery, if needed, depends on the chosen backup: restore to a new server and explicitly re-point only if approved, or use the approved logical-backup recovery plan. Do not reverse 0011/0012 without a reviewed data plan.

## Path B — explicitly reset pre-launch data and initialize cleanly

Use only after explicit, scoped owner authorization identifies what will be replaced and confirms the importer/source and its side effects. No deletion or reset is performed by this plan.

1. Optionally take a snapshot/logical backup or choose PITR according to the owner’s retention and cost preference. PITR temporary-server restore is not mandatory. A backup is not permission to reset.
2. In an isolated disposable database, test the approved clean-schema initialization using the exact pinned Azure code. Validate the complete migration graph and final schema, including 0012’s four `Programa` columns; do not test by modifying the existing database. Confirm the exact importer inputs, side effects, expected records, and repeat behavior. Do not run `scripts/release.sh`.
3. Only after explicit reset and initialization approval, an authorized operator may reset/recreate the scoped pre-launch database and initialize its schema from the tested pinned code. Then perform the separately approved controlled import and verify counts/content. Never infer “wipe” authorization from likely intent.
4. If clean initialization/import fails, stop. Recovery is either restore from the owner-approved snapshot/PITR to a new server and re-point with approval, or repeat the clean initialization/import from the verified source if the owner accepts loss of the reset test data. Do not improvise rollback or reverse migrations.

## Source-first variant and deployment cautions

The prior audit treated the 0011 safety fix as local and recommended landing it on authoritative `azure`. Git now shows that fix published as `origin/azure` at `6cfae3c`; the documentation baseline (`a3d9a21`) does not contain it and is not deploy source. Verify the pinned product source and database schema/history together before considering deployment. A push to `azure` matches `deploy.yml`'s automatic trigger but the workflow does not migrate or smoke-test; it may affect App Service process state. Push the approved SHA once, not followed by manual dispatch. Keep `main` unpublished: its 0009 removal can affect legacy data and its push filters match two workflows targeting the same App Service. Any deployment requires explicit acceptance of historical 0011 uncertainty and the selected data/recovery plan.

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

# DATABASE-MUTATING: only for a separately verified database missing 0012, after all Path A approvals/tests; app remains stopped
python manage.py migrate planning 0012_programa_competencias_programa_fundamentacion_and_more --noinput
```

Path B reset/initialization and import commands are intentionally omitted because scope and importer effects require owner decisions first. No command here authorizes deployment or app start. Do not run `scripts/release.sh`.

## References

- Microsoft: [Backup and restore concepts for Azure Database for PostgreSQL Flexible Server](https://learn.microsoft.com/azure/postgresql/flexible-server/concepts-backup-restore) — PITR creates a new server; review retention, cost, and stopped-server backup caveats.
- Microsoft: [Restore to a custom restore point](https://learn.microsoft.com/azure/postgresql/flexible-server/how-to-restore-custom-restore-point).
