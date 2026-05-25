# Resource Quarantine Model

Phase 153 adds a deterministic quarantine overlay for the Resource/Data/Evidence plane.

The model reads Resource Expansion, Resource Ingest, Resource Store Interface, and Resource Dedup/Hash Ledger artifacts. It does not delete source files, object-store paths, evidence, or output records. Instead, it emits held quarantine records and a pending human review queue for resources that match one or more hold categories.

## Hold Categories

- `sensitive_data`: P2 or higher classification, secrets, credentials, or privileged/restricted markers.
- `extraction_error`: failed parser/OCR/extraction items.
- `encrypted_or_materialization_required`: dataless, encrypted, password-required, or materialization-required files.
- `oversized_file`: files exceeding default expansion budgets.
- `ambiguous_matter_or_type`: missing matter assignment, unclassified domain, or unknown/unsupported type.
- `duplicate_or_hash_hold`: duplicate/hash decisions requiring human confirmation.

## Outputs

- `resource-quarantine-model.json`: full contract artifact.
- `quarantine-rules.json`: rule catalog for required hold categories.
- `quarantine-items.json`: held resource/version records.
- `quarantine-review-queue.json`: one pending human review row per quarantine item.
- `validation-report.json`: validation rows and errors.
- `summary.md`: operator summary.

## Command

```bash
npm run resource:quarantine -- --check
```
