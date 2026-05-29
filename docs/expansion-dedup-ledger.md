# Expansion Dedup Ledger

Phase 279 adds a read-only ledger for Resource Expansion idempotency and duplicate handling.

The ledger reads existing Resource Expansion, Expansion Cursor Ledger, and Backfill Job Contract artifacts. It does not execute backfill, ingest sources, read source file contents, mutate source/resource/state records, deliver output, perform protected actions, generate legal advice, or create client-facing output.

Generated files:

- `expansion-dedup-ledger.json`
- `idempotency-key-rows.json`
- `content-hash-groups.json`
- `duplicate-decision-rows.json`
- `skipped-duplicate-rows.json`
- `dedup-resume-checks.json`
- `validation-report.json`
- `summary.md`

Every expansion item gets an idempotency key row linked to the P278 portable resume key. Duplicate decisions are report-only: `skipped_duplicate` rows must keep `duplicate_of` lineage to an extracted canonical resource, preserve the status-history decision event, and must not promote a replacement resource.

Absolute source paths are reference-only and are not used for dedup identity. The Windows baseline stabilization posture remains required for P279 and later phases.
