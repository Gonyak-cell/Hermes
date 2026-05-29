# Expansion Quarantine Ledger

Phase P280 adds a read-only quarantine ledger for Resource Expansion backfill results.

The ledger reads the Resource Expansion Job, P278 Expansion Cursor Ledger, P279 Expansion Dedup Ledger, P277 Backfill Job Contract, and repository control surfaces. It emits:

- `expansion-quarantine-ledger.json`
- `quarantine-rule-rows.json`
- `quarantine-decision-rows.json`
- `quarantine-hold-rows.json`
- `quarantine-status-audits.json`
- `quarantine-resume-checks.json`
- `validation-report.json`
- `summary.md`

The report classifies failed, sensitive/secret, dataless/materialization-required, oversized, unsupported, and unknown expansion files as human-review quarantine holds. It verifies that held rows block retrieval, external transfer, and output delivery, cannot auto-release, and do not use absolute source paths as hold identity.

This ledger does not run backfill, retry extraction, ingest sources, read source file contents, mutate resources or state, release quarantined items, deliver output, generate legal advice, or produce client-facing output.
