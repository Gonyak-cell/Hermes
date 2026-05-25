# Policy Snapshot Binding Ledger

Phase 123 adds a deterministic policy snapshot binding ledger. It binds workflow runs, agent runs, event/audit/run ledger rows, gate results, approval requests, output artifacts, and delivery actions to the policy snapshot that governed the execution.

The ledger does not loosen policy. If a source declared an unresolved placeholder, the binder records that fact and resolves it through workflow, output, domain, tenant, or global fallback only when the fallback points to a known policy snapshot.

## Inputs

- `policy-snapshot-ledger.json`
- `capability-workflow-contract-freeze.json`
- `runtime-agentrun-contract-freeze.json`
- `gate-approval-contract-freeze.json`
- `output-delivery-contract-freeze.json`
- `event-audit-run-contract-freeze.json`
- `approval-authority-ledger.json`

## Outputs

- `policy-snapshot-binding-ledger.json`
- `policy-snapshot-binding-catalog.json`
- `workflow-policy-bindings.json`
- `agent-run-policy-bindings.json`
- `event-policy-bindings.json`
- `gate-policy-bindings.json`
- `approval-policy-bindings.json`
- `output-policy-bindings.json`
- `validation-report.json`
- `summary.md`

## Rules

- Every binding must resolve to a known `policy_snapshot_id`.
- Every binding keeps its declared snapshot, inherited workflow snapshot, linked output snapshot, and final binding source.
- Unresolved declared placeholders are preserved as unresolved declared references and may only become `fallback_resolved` through deterministic fallback.
- Missing source artifacts, incomplete contract freezes, unknown snapshots, and unbound rows fail validation.
- The ledger is read-only evidence for gates, audit, run ledger, dashboard, and API surfaces.

## Command

```bash
npm run contracts:policy-bindings -- --check
```
