# Backup/Restore Drill

Phase 304 adds `backup_restore_drill`, a read-only dry-run report for DB/object/artifact/event/audit recovery posture.

The drill uses existing phase artifacts as evidence and does not execute a restore, replay events, mutate sources, start servers, call routes, export Desktop data, import Desktop payloads, transfer externally, generate legal advice, or produce client-facing output.

Generated files:

- `backup-restore-drill-report.json`
- `backup-restore-sources.json`
- `restore-drill-rows.json`
- `backup-restore-source-of-truth-rows.json`
- `backup-restore-gate-results.json`
- `backup-restore-boundary.json`
- `validation-report.json`
- `summary.md`

Acceptance:

- P303 Performance/Cost Budget Report is complete and points to P304.
- DB, object, artifact, event, and audit restore planes each have a passed dry-run row.
- Restore execution, production restore, event replay append, mutation, Desktop export, Desktop import, route execution, server start, protected action execution, external transfer, and network access are all false.
- Canonical DB/object/artifact/event/audit stores are locked as restore sources of truth.
- Desktop export/import is explicitly not a source of truth and is not accepted as restore input.
- Retention holds, records review, human review, no-client-facing, no-legal-advice, and Windows baseline stability gates remain preserved.
