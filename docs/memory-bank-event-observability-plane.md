# Memory Bank Event Observability Plane

P7001-P7300 creates the storage and observability base for long-running Hermes work.

Command:

```bash
npm run platform:memory-bank-event-observability-plane -- --check
```

## Purpose

Codex and Claude conversations, validation runs, review receipts, artifacts, gates, blockers, and next execution conditions must not vanish into a chat scrollback. This phase turns them into append-only event and object-reference contracts.

This phase is not the retrieval layer. Runtime recall remains disabled until P7301-P7600.

## Memory Boundary

Expected boundary:

```text
append_only_event_store_ready=true
object_artifact_reference_store_ready=true
transcript_source_event_binding_ready=true
review_receipt_event_binding_ready=true
gate_verdict_event_ledger_ready=true
trace_audit_cost_observability_ready=true
retention_backup_restore_ready=true
memory_bank_storage_index_ready=true
raw_transcript_default_access_enabled=false
mutable_event_update_enabled=false
runtime_recall_enabled=false
retrieval_layer_enabled=false
cross_domain_memory_leak_allowed=false
write_action_enabled=false
work_os_claim_enabled=false
```

## Event Types

The append-only event store contract covers:

- conversation source
- claim
- evidence
- validation
- review receipt
- gate verdict
- plan update
- next execution condition

## Object References

The object store contract stores references, hashes, and redaction status for:

- transcript envelopes
- artifacts
- validation reports
- review receipts
- patch candidates
- rollback plans

Raw bodies are not embedded by default.

## Artifacts

Outputs are written under `artifacts/memory-bank-event-observability-plane/latest`:

- `memory-bank-event-observability-plane.json`
- `append-only-event-store-rows.json`
- `object-artifact-reference-rows.json`
- `transcript-source-event-binding-rows.json`
- `review-receipt-event-binding-rows.json`
- `gate-verdict-event-ledger-rows.json`
- `trace-audit-cost-observability-rows.json`
- `retention-backup-restore-rows.json`
- `memory-bank-storage-index-rows.json`
- `event-observability-negative-fixture-rows.json`
- `memory-bank-event-observability-freeze-rows.json`
- `memory-bank-event-observability-gate-rows.json`
- `memory-bank-event-observability-boundary.json`
- `validation-report.json`
- `summary.md`
