# Expansion Cursor Ledger

Phase 278 locks the resource expansion cursor and batch-state ledger before the later backfill phases add dedup, quarantine, classification, matter tagging, and extractor coverage.

The ledger is read-only. It reads the Resource Expansion Job, Resource Expansion state, next-batch artifact, and Phase 277 Backfill Job Contract, then writes:

- `expansion-cursor-ledger.json`
- `cursor-state-rows.json`
- `batch-state-rows.json`
- `resume-checkpoints.json`
- `batch-item-positions.json`
- `path-portability-checks.json`
- `validation-report.json`

The contract proves that resume state is keyed by stable job/source/batch fields, relative paths, size, modified timestamp, and portable resume fingerprints. Absolute source paths and platform-specific state paths are reference-only so Mac/Windows path differences do not define completion.

Run:

```bash
npm run resource:expansion-cursor-ledger -- --check
```

This command does not execute backfill, ingest sources, read source file contents, mutate source/resource/state artifacts, deliver output, perform protected actions, generate legal advice, or create client-facing output. Human review remains required for legal or client-facing use.
