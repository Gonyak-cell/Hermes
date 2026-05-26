# Agent Run Ledger

Phase 164 adds an Agent Run Ledger that stores runtime execution references as deterministic rows instead of trusting runtime self-report.

## Purpose

The ledger binds each `AgentRun` from the Runtime/AgentRun contract freeze to:

- `workflow_run_ledger` record and `run_ledger_id`
- runtime input/output reference and `output_hash`
- runtime log reference and capture status
- runtime artifact reference, content hash, approval, and delivery gate
- append-only `agent_run.started` / `agent_run.completed` stored event bindings

This keeps Claude Code, Codex, Hermes, local scripts, and renderers behind the same auditable reference contract.

## Command

```bash
npm run events:agent-runs -- --check
```

Default output:

```text
artifacts/agent-run-ledger/latest/agent-run-ledger.json
artifacts/agent-run-ledger/latest/agent-run-records.json
artifacts/agent-run-ledger/latest/agent-run-io-references.json
artifacts/agent-run-ledger/latest/agent-run-artifact-references.json
artifacts/agent-run-ledger/latest/agent-run-log-references.json
artifacts/agent-run-ledger/latest/agent-run-event-bindings.json
artifacts/agent-run-ledger/latest/validation-report.json
artifacts/agent-run-ledger/latest/summary.md
```

## Validation Gate

The Phase 164 gate passes only when:

- Runtime/AgentRun contract freeze, Workflow Run Ledger, Append-only Event Store, and Event Correlation Ledger are complete.
- Every runtime AgentRun is projected to an Agent Run Ledger record.
- Every AgentRun has complete input, output, output hash, and output contract references.
- Required log capture is present for every AgentRun.
- Runtime artifact contract rows are projected, with no required artifact gaps.
- Workflow-level agent state events are linked back to AgentRun rows.

The dashboard, API, goal checkpoint, control-plane loop, contract golden fixtures, and contract validation suite all consume the same artifact.
