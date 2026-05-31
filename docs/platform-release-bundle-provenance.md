# Platform Release Bundle Provenance

Phase 347 expands release-bundle provenance for the P341-P360 stability tranche.

`platform:release-bundle-provenance` consumes the P346 provenance ledger in
memory and records the required future bundle hashes, manifest rows, and
verification rows. It is a policy artifact only: it does not create release
bundles, publish releases, create git tags, create signed tags, or execute
protected actions.

Default output path:

- `artifacts/platform-release-bundle-provenance/latest/platform-release-bundle-provenance.json`
- `artifacts/platform-release-bundle-provenance/latest/bundle-hash-requirement-rows.json`
- `artifacts/platform-release-bundle-provenance/latest/bundle-manifest-rows.json`
- `artifacts/platform-release-bundle-provenance/latest/bundle-verification-rows.json`
- `artifacts/platform-release-bundle-provenance/latest/release-bundle-boundary.json`
- `artifacts/platform-release-bundle-provenance/latest/validation-report.json`
- `artifacts/platform-release-bundle-provenance/latest/summary.md`

Check mode:

```bash
npm run platform:release-bundle-provenance -- --check
```

`--check` validates bundle provenance policy without writing or overwriting
artifacts. Missing package, lockfile, ledger, or P346 provenance evidence blocks
future release-bundle provenance readiness.
