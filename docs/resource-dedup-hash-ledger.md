# Resource Dedup/Hash Ledger

Phase 152 adds a deterministic deduplication ledger on top of the Resource Store, Immutable Object Store, and Resource Version Ledger.

Run:

```bash
npm run resource:dedup-hash -- --check
```

The ledger is classification-only. It does not delete or overwrite source material. It classifies resources and resource versions by:

- `content_hash`: byte-identical raw content groups.
- `source_system + external_id`: upstream identity/version families.
- `resource_version_id`: current, changed, duplicate, and skipped duplicate candidates.

Outputs:

- `resource-dedup-hash-ledger.json`
- `hash-groups.json`
- `external-id-groups.json`
- `dedup-decisions.json`
- `duplicate-candidate-links.json`
- `hash-integrity-checks.json`
- `validation-report.json`

The dashboard and API expose the ledger as a read-only review surface. Human review remains required for duplicate, changed, or skipped duplicate decisions before any destructive or cross-matter action.
