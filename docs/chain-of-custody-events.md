# Chain of Custody Events

Phase 147 adds an append-only custody event ledger for the resource/evidence path.

## Contract

`chain-of-custody-events.v1` projects existing deterministic artifacts into `custody-event.v1` rows. The ledger does not approve legal work product. It records that a human approval step is required before an exhibit, paragraph, citation, or delivery action can become client-facing.

## Stages

| Stage | Source | Subject | Default status |
| --- | --- | --- | --- |
| upload | Resource Version Ledger | resource version | recorded |
| normalize | Normalized Text Contract | normalized text artifact | normalized |
| extract | Exhibit Map | exhibit/evidence path | machine_extracted_pending_review |
| review | Evidence Flags | exhibit/evidence path | pending_human_review |
| approve | Exhibit Map | exhibit/evidence path | held_pending_human_approval |

Resource custody chains contain upload and normalize events. Evidence custody chains contain extract, review, and approve-hold events. Each event carries a chain-local previous hash and its own event hash.

## Safety Invariants

- Events are append-only and immutable.
- Review and approve stages require a human approval actor.
- Approval events are requests/holds only; `approved_event_count` remains 0.
- Every event preserves tenant, matter, classification, and policy snapshot.
- Every event remains `client_facing_ready=false`.
- Corrections must be recorded as new events, not by editing prior events.

## Command

```sh
npm run resource:custody-events -- --check
```

The command writes:

- `artifacts/chain-of-custody/latest/chain-of-custody-events.json`
- `artifacts/chain-of-custody/latest/custody-events.json`
- `artifacts/chain-of-custody/latest/custody-event-links.json`
- `artifacts/chain-of-custody/latest/custody-stage-indexes.json`
- `artifacts/chain-of-custody/latest/validation-report.json`
- `artifacts/chain-of-custody/latest/summary.md`
