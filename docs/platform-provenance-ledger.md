# Platform Provenance Ledger

Phase 346 starts the provenance portion of the P341-P360 stability tranche.

`platform:provenance-ledger` consumes the P345 artifact guard in memory and
records the P340 verified bundle hash, the P340 history baseline commit, the Mac
replay stabilization commit, release-bundle hash policy, and future signed-tag
requirements. It is a report-only ledger and does not create git tags, signed
tags, release bundles, releases, or protected recovery actions.

Default output path:

- `artifacts/platform-provenance-ledger/latest/platform-provenance-ledger.json`
- `artifacts/platform-provenance-ledger/latest/provenance-records.json`
- `artifacts/platform-provenance-ledger/latest/release-hash-policy-rows.json`
- `artifacts/platform-provenance-ledger/latest/signed-tag-requirement-rows.json`
- `artifacts/platform-provenance-ledger/latest/provenance-boundary.json`
- `artifacts/platform-provenance-ledger/latest/validation-report.json`
- `artifacts/platform-provenance-ledger/latest/summary.md`

Check mode:

```bash
npm run platform:provenance-ledger -- --check
```

`--check` validates provenance policy without writing or overwriting artifacts.
If the P340 hash, history commit, Mac replay commit, or signed-tag requirement
is missing from the platform operations ledger, the provenance ledger blocks.
