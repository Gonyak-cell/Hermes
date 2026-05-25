# Event/Audit/Run Ledger Contract Freeze

Phase 107 freezes the traceability contract that ties operational events, audit events, and workflow run ledgers together.

## Purpose

The freeze makes the following fields mandatory for every event-like record and run ledger:

- `schema_version`
- `correlation_id`
- `actor` or `actor_refs`
- `policy_snapshot_id`

This prevents later domain packs from treating observability events, audit trail rows, and run ledger entries as unrelated logs. A legal or client-facing output must be traceable from source event to run ledger, gate, approval, output artifact, and audit trail.

## Artifacts

Running `npm run contracts:events` writes:

- `artifacts/event-audit-run-contract-freeze/latest/event-audit-run-contract-freeze.json`
- `artifacts/event-audit-run-contract-freeze/latest/event-record-v2-fixture.json`
- `artifacts/event-audit-run-contract-freeze/latest/audit-event-v2-fixture.json`
- `artifacts/event-audit-run-contract-freeze/latest/run-ledger-v2-fixture.json`
- `artifacts/event-audit-run-contract-freeze/latest/event-run-binding-v2-fixture.json`
- `artifacts/event-audit-run-contract-freeze/latest/validation-report.json`
- `artifacts/event-audit-run-contract-freeze/latest/summary.md`

## Contracts

- `EventRecord v2` normalizes observability events.
- `AuditEvent v2` normalizes protected action and approval audit rows.
- `RunLedger v2` normalizes workflow run reproduction metadata.
- `EventRunBinding v2` binds event and audit records to a run ledger by `correlation_id`.

## Gate

The phase is complete only when:

- Output/Delivery contract freeze is already complete.
- All EventRecord v2 rows link to a RunLedger v2.
- AuditEvent v2 rows either link to a run ledger or remain explicit external control events.
- Every event, audit row, and run ledger has a policy snapshot reference.
- Every run ledger has event ids and agent run ids.
- Validation has zero failed rows.
