# Batch Matter Tagging Result

Phase P282 adds a read-only batch matter tagging result for Resource Expansion resources.

The result reads the Resource Expansion Job, P281 Batch Classification Result, P124 Matter Tagging Decision Ledger, and repository control surfaces. It emits:

- `batch-matter-tagging-result.json`
- `batch-matter-tagging-rows.json`
- `automatic-tagging-candidate-rows.json`
- `human-confirmation-rows.json`
- `matter-tagging-separation-rows.json`
- `batch-matter-tagging-checks.json`
- `validation-report.json`
- `summary.md`

Every expansion item is linked to a matter tagging decision, an automatic tagging candidate, and a pending human confirmation row. Automatic candidate generation is reported separately from human confirmation and application.

This result does not apply matter tags, run backfill, write classifications, ingest sources, read source file contents, call models, mutate resources or state, deliver output, generate legal advice, or produce client-facing output.
