# Expansion Status Dashboard

Phase 285 adds `expansion_status_dashboard`, a read-only dashboard/API projection over Resource Expansion and its dedup, quarantine, and extractor coverage follow-up ledgers.

The artifact exposes queryable rows for these status buckets:

- `discovered`
- `queued`
- `ingested`
- `failed`
- `quarantined`

Run it with:

```bash
npm run resource:expansion-status -- --check
```

The main artifact is written to `artifacts/expansion-status-dashboard/latest/expansion-status-dashboard.json`. Companion files contain status item rows, rollups, panel rows, API route rows, checks, and validation output.

This phase is read-only. It does not run expansion, ingest sources, read source file contents, retry extraction, release quarantine, mutate resources or state, deliver output, produce legal advice, or create client-facing output.
