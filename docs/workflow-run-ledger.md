# Workflow Run Ledger

Phase 163 adds the workflow run ledger. It turns run-bound event correlation traces into event-backed workflow run records, state transitions, and workflow event bindings.

The ledger is deterministic and local. It does not execute workflow actions, ask an LLM to summarize status, or change source events. It records what already happened according to the append-only event store and the Event/Audit/Run contract freeze.

## Outputs

- `workflow_run_records`: one record for each run-bound correlation trace.
- `workflow_state_transitions`: state changes backed by append-only stored events.
- `workflow_event_bindings`: every run-bound stored event linked back to its workflow run, including event-only rows that do not change state.

Audit-only external control traces without a run ledger stay outside the workflow run ledger. They remain visible in the Event Correlation Ledger as `external_control` traces.

## Command

```bash
npm run events:workflow-runs -- --check
```

The command writes:

- `artifacts/workflow-run-ledger/latest/workflow-run-ledger.json`
- `artifacts/workflow-run-ledger/latest/workflow-run-records.json`
- `artifacts/workflow-run-ledger/latest/workflow-state-transitions.json`
- `artifacts/workflow-run-ledger/latest/workflow-event-bindings.json`
- `artifacts/workflow-run-ledger/latest/validation-report.json`
- `artifacts/workflow-run-ledger/latest/summary.md`

## Validation Rules

- Event Correlation Ledger, Event/Audit/Run contract freeze, Capability/Workflow contract freeze, and Append-only Event Store must be complete.
- Every run-bound correlation trace must become an event-backed workflow run record.
- Every run-bound stored event must have a workflow event binding.
- Every state transition must be backed by a workflow event binding.
- Terminal workflow state must align with the `RunLedger v2` status.
