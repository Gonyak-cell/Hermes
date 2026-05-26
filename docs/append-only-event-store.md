# Append-only Event Store

Phase 161 adds a deterministic append-only event store projection over the Phase 159 event envelopes and Phase 160 event type registry.

## Purpose

The event store is the operational replay boundary for workflows, agents, gates, approvals, and outputs. It does not replace EventRecord, AuditEvent, or RunLedger contracts. It gives adapters a stable, hash-chained, append-only view of the event stream.

## Artifacts

Run:

```bash
npm run events:store
```

Outputs:

- `artifacts/append-only-event-store/latest/append-only-event-store.json`
- `artifacts/append-only-event-store/latest/stored-events.json`
- `artifacts/append-only-event-store/latest/event-streams.json`
- `artifacts/append-only-event-store/latest/event-correction-policy.json`
- `artifacts/append-only-event-store/latest/validation-report.json`
- `artifacts/append-only-event-store/latest/summary.md`

## Completion Rules

P161 is complete only when:

- the source event envelope ledger and event type registry are complete;
- every envelope is projected to exactly one stored event;
- global sequence is contiguous;
- each stored event has an event hash and chain hash;
- each stored event is locked and not mutated;
- every stored event is bound back to the event type registry;
- corrections are allowed only as appended correction events targeting original events.
