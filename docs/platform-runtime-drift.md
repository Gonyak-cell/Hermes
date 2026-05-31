# Platform Runtime Drift Check

Phase 342 adds a deterministic runtime/dependency drift report for the
P341-P500 Platform Operations Stability Program.

`platform:drift-check` builds the P341 runtime baseline in memory and compares
the current local state to the P341 expected runtime, dependency, and provenance
values. The report is read-only and does not install dependencies, mutate
package files, create tags, publish releases, execute recovery actions, enable
Desktop mutation, or enable Trading live/full-auto/order submission.

Default output path:

- `artifacts/platform-runtime-drift/latest/platform-runtime-drift.json`
- `artifacts/platform-runtime-drift/latest/runtime-drift-rows.json`
- `artifacts/platform-runtime-drift/latest/dependency-drift-rows.json`
- `artifacts/platform-runtime-drift/latest/provenance-drift-rows.json`
- `artifacts/platform-runtime-drift/latest/source-fingerprints.json`
- `artifacts/platform-runtime-drift/latest/runtime-drift-boundary.json`
- `artifacts/platform-runtime-drift/latest/validation-report.json`
- `artifacts/platform-runtime-drift/latest/summary.md`

Check mode:

```bash
npm run platform:drift-check -- --check
```

`--check` validates the drift report without writing or overwriting artifacts.
Any runtime, dependency, provenance, schema, Desktop, or Trading safety drift
turns the command into a failing check and leaves the existing artifact tree
untouched.
