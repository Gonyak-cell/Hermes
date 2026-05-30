# Retention Deletion Policy

Phase 301 adds a read-only retention/deletion hardening gate on top of the existing retention/archive ledger. It records resource, artifact, and audit retention periods and keeps all deletion decisions blocked until records review and human review.

## Outputs

- `artifacts/retention-deletion-policy/latest/retention-deletion-policy.json`
- `artifacts/retention-deletion-policy/latest/retention-deletion-source-statuses.json`
- `artifacts/retention-deletion-policy/latest/retention-deletion-policy-rows.json`
- `artifacts/retention-deletion-policy/latest/deletion-hold-records.json`
- `artifacts/retention-deletion-policy/latest/retention-deletion-gate-results.json`
- `artifacts/retention-deletion-policy/latest/retention-deletion-boundary.json`
- `artifacts/retention-deletion-policy/latest/validation-report.json`
- `artifacts/retention-deletion-policy/latest/summary.md`

## Guarantees

- Resource, artifact, and audit policy rows each record a positive retention period.
- Deletion is not allowed, `delete_after_days` is unset, and every policy row has an active deletion hold.
- Records review, human review, and legal hold requirements stay active.
- The report is read-only and report-only: it does not delete, mutate, ingest source content, transfer externally, start a server, produce legal advice, or generate client-facing output.
- The Windows baseline guard remains explicit so Phase 217 and later do not wobble between Mac and Windows completion states.

## Command

```bash
npm run compliance:retention-deletion-policy -- --check
```
