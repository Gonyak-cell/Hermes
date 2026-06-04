# Hermes Memory Event Observability Plane Phase Ledger

This ledger covers `P2561-P2720`. It consumes `platform:controlled-write-operator-console-v2` and defines the Memory Bank, storage/event, and observability contract.

## Objective

Move Hermes from JSON artifact snapshots toward an append-only event, object reference, trace/audit/cost, and grounded recall model. The program defines event rows, object-store artifact references, observability signals, Memory Bank operations, retention/backup/restore rows, grounded recall guards, and the `P2721-P2880` connector governance handoff. It does not start storage services, write events, persist objects, ingest connectors, or expose raw material.

## Phase Slices

| Range | Slice | Goal |
|---|---|---|
| `P2561-P2580` | Append-Only Event Contract | Define phase, claim, evidence, receipt, review, gate, and closeout event rows |
| `P2581-P2600` | Object Store Artifact Contract | Define artifact, evidence, diff, receipt, log summary, and snapshot object references |
| `P2601-P2620` | Trace/Audit/Cost Contract | Define trace id, actor, cost, latency, failure, and unsafe flag observability rows |
| `P2621-P2640` | Memory Operation Contract | Define Archive, Sync, Index, Search, Extract, Consolidate, Relate, and Recall rows |
| `P2641-P2660` | Retention Backup Restore | Define retention, deletion, backup, restore drill, and domain partition rows |
| `P2661-P2680` | Grounded Recall Guards | Require citations, source status, domain boundary, freshness, confidence, and next condition |
| `P2681-P2700` | Evidence Index Handoff | Bind evidence and recall rows to future connector governance without raw export |
| `P2701-P2720` | Connector Handoff Freeze | Freeze P2721 handoff with connector ingestion/write and production authority still closed |

## Source

- Source command: `platform:controlled-write-operator-console-v2`
- Source phase: `P2401-P2560`
- Required status: `ready_for_platform_controlled_write_operator_console_v2`
- Required boundary: patch application and write action are still false

## Guard Rules

- Event rows are append-only contracts; no event is written by this program.
- Object-store rows are references only; no object is persisted by this program.
- Observability rows define redacted trace/audit/cost signals; no collection service is started.
- Memory operations require grounded evidence, source status, domain boundary, and citations.
- Retention and backup rows must exist before storage or connector rollout.
- Recall guards must update the next execution condition rather than produce ungrounded memory claims.
- Handoff to `P2721-P2880` does not enable connector ingestion, connector write, raw material export, or production readiness.

## Completion Criteria

```text
source controlled write console ready
append-only event rows defined
object store artifact rows defined
trace/audit/cost rows defined
memory operation rows defined
retention backup restore rows defined
grounded recall guards defined
P2721 handoff ready
event written now = false
object written now = false
storage service started = false
connector/raw/production authority still false
unsafe flag count = 0
ready_for_platform_memory_event_observability_plane
```

## Validation

Run:

```bash
npm run platform:memory-event-observability-plane -- --check
```
