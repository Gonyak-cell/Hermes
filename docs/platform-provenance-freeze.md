# Platform Provenance Freeze

Phase 350 closes the P346-P350 baseline provenance freeze detail as a read-only
record.

`platform:provenance-freeze` consumes the P349 provenance freeze preflight in
memory, records P346-P350 closure rows, and verifies package-script,
validation-chain, and ledger acceptance gates. It does not run the listed
commands, create tags, create signed tags, materialize signing keys, create
release bundles, publish releases, or execute protected actions.

Default output path:

- `artifacts/platform-provenance-freeze/latest/platform-provenance-freeze.json`
- `artifacts/platform-provenance-freeze/latest/freeze-closure-rows.json`
- `artifacts/platform-provenance-freeze/latest/freeze-gate-rows.json`
- `artifacts/platform-provenance-freeze/latest/provenance-freeze-boundary.json`
- `artifacts/platform-provenance-freeze/latest/validation-report.json`
- `artifacts/platform-provenance-freeze/latest/summary.md`

Check mode:

```bash
npm run platform:provenance-freeze -- --check
```

`--check` validates final provenance freeze readiness without writing or
overwriting artifacts. Missing package script registration, validation-chain
registration, or ledger acceptance blocks the freeze.
