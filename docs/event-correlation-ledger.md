# Event Correlation Ledger

Phase 162 adds the event correlation ledger between the append-only event store and the later run/audit observability surfaces.

The ledger is deterministic and local. It does not call an LLM, mutate source events, or deliver any output. It projects append-only stored events into three reviewable views:

- `correlation_traces`: events grouped by `correlation_id`, with matter, workflow, run ledger, and event envelope references.
- `causation_edges`: `causation_id` links from cause event envelopes to effect event envelopes.
- `trace_run_bindings`: correlation traces bound back to known `RunLedger v2` records.

External audit-only control events that do not have a run ledger are not hidden or coerced. They are represented as `external_control` traces so reviewers can see that they are outside a run-bound workflow.

## Command

```bash
npm run events:correlation -- --check
```

The command writes:

- `artifacts/event-correlation/latest/event-correlation-ledger.json`
- `artifacts/event-correlation/latest/correlation-traces.json`
- `artifacts/event-correlation/latest/causation-edges.json`
- `artifacts/event-correlation/latest/trace-run-bindings.json`
- `artifacts/event-correlation/latest/validation-report.json`
- `artifacts/event-correlation/latest/summary.md`

## Validation Rules

- The append-only event store must be complete.
- The Event/Audit/Run contract freeze must be complete.
- Every stored event must appear in exactly one correlation trace.
- Every stored event must declare `correlation_id`.
- Run-bound traces must carry matter, workflow, run ledger, and event envelope identifiers.
- Audit-only traces without a run ledger must be explicitly marked `external_control`.
- Every causation edge must point to an existing stored cause event.
- Every trace/run binding must resolve to a known `RunLedger v2` record.
