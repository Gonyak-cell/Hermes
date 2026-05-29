# Batch Classification Result

Phase P281 adds a read-only batch classification result for Resource Expansion resources.

The result reads the Resource Expansion Job, P278 Expansion Cursor Ledger, P279 Expansion Dedup Ledger, P280 Expansion Quarantine Ledger, Data Classification Rule Engine, P277 Backfill Job Contract, and repository control surfaces. It emits:

- `batch-classification-result.json`
- `batch-classification-rule-rows.json`
- `batch-classification-rows.json`
- `classification-confidence-rows.json`
- `classification-policy-binding-rows.json`
- `batch-classification-checks.json`
- `validation-report.json`
- `summary.md`

Every expansion item receives a data classification, confidence score, confidence label, policy binding, and human-review status. The result uses existing Resource Expansion metadata and policy artifacts only; it does not read source file contents or call models.

This result does not run backfill, write classifications, ingest sources, mutate resources or state, deliver output, generate legal advice, or produce client-facing output.
