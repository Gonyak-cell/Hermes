# Retention/Archive Ledger

Phase 173 adds a deterministic retention and archive ledger for the audit, event, and output planes.

The ledger does not authorize deletion. It records which source surfaces must be retained, which archive candidates exist, and which legal-hold bindings are active until an attorney or records manager performs a later explicit review.

## Inputs

- `artifacts/append-only-event-store/latest/append-only-event-store.json`
- `artifacts/audit-event-ledger/latest/audit-event-ledger.json`
- `artifacts/output-catalog/latest/output-catalog.json`

## Outputs

- `retention-archive-ledger.json`: combined contract, source status, retention policies, archive candidates, legal-hold bindings, validation, and summary.
- `retention-policy-records.json`: one retention policy each for event, audit, and output planes.
- `archive-candidate-records.json`: event stream, audit rollup, and output artifact archive candidates.
- `legal-hold-bindings.json`: active matter, tenant, or system hold bindings for every hold-required candidate.
- `validation-report.json`: source parity, no-delete, policy-binding, and hold-binding checks.
- `summary.md`: compact Korean-operator-friendly receipt.

## Operator Notes

- `npm run events:retention -- --check` fails when any source is missing, a source count drifts, a candidate lacks a policy, a legal hold is missing, or deletion is accidentally allowed.
- Event candidates preserve append-only chain integrity.
- Audit candidates preserve separated security, access, and approval audit rows outside observability logs.
- Output candidates preserve attorney-reviewable output artifacts and their human-review or delivery state.
