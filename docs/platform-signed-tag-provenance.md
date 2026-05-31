# Platform Signed-Tag Provenance

Phase 348 expands future signed-tag provenance for the P341-P360 stability
tranche.

`platform:signed-tag-provenance` consumes the P347 release-bundle provenance in
memory and records the policy rows and gates required before any future release
tag could be considered eligible. It does not run git commands, create tags,
create signed tags, materialize signing keys, create release bundles, publish
releases, or execute protected actions.

Default output path:

- `artifacts/platform-signed-tag-provenance/latest/platform-signed-tag-provenance.json`
- `artifacts/platform-signed-tag-provenance/latest/signed-tag-policy-rows.json`
- `artifacts/platform-signed-tag-provenance/latest/signed-tag-gate-rows.json`
- `artifacts/platform-signed-tag-provenance/latest/signed-tag-boundary.json`
- `artifacts/platform-signed-tag-provenance/latest/validation-report.json`
- `artifacts/platform-signed-tag-provenance/latest/summary.md`

Check mode:

```bash
npm run platform:signed-tag-provenance -- --check
```

`--check` validates signed-tag provenance policy without writing or overwriting
artifacts. Missing signed-tag policy wording or blocked P347 release-bundle
provenance blocks readiness.
