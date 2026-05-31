# Platform Provenance Freeze Preflight

Phase 349 adds a read-only preflight before the P350 provenance freeze.

`platform:provenance-freeze-preflight` consumes the P348 signed-tag provenance
in memory, maps the P341-P349 source rows, and verifies the validation chain and
package script registrations plus ledger acceptance rows before the final
provenance freeze. It does not run the listed commands, create tags, create
signed tags, materialize signing keys, create release bundles, publish releases,
or execute protected actions.

Default output path:

- `artifacts/platform-provenance-freeze-preflight/latest/platform-provenance-freeze-preflight.json`
- `artifacts/platform-provenance-freeze-preflight/latest/freeze-source-rows.json`
- `artifacts/platform-provenance-freeze-preflight/latest/freeze-gate-rows.json`
- `artifacts/platform-provenance-freeze-preflight/latest/provenance-freeze-preflight-boundary.json`
- `artifacts/platform-provenance-freeze-preflight/latest/validation-report.json`
- `artifacts/platform-provenance-freeze-preflight/latest/summary.md`

Check mode:

```bash
npm run platform:provenance-freeze-preflight -- --check
```

`--check` validates freeze preflight readiness without writing or overwriting
artifacts. Missing package script registration, validation-chain registration,
or ledger acceptance blocks the preflight.
