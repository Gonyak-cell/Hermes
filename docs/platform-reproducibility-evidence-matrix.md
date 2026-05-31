# Platform Reproducibility Evidence Matrix

Phase 357 records reproducibility evidence expectations after the P356 check
registry.

`platform:reproducibility-evidence-matrix` consumes P356 reproducibility check
registry in memory, groups the P341-P356 checks into evidence rows, and keeps the
future P361-P380 release-check bridge visible for operator review. It does not
collect evidence, run checks, execute release-check commands, install
dependencies, regenerate artifacts, import history, change checkout state,
perform git operations, submit trading orders, or execute protected actions.

Default output path:

- `artifacts/platform-reproducibility-evidence-matrix/latest/platform-reproducibility-evidence-matrix.json`
- `artifacts/platform-reproducibility-evidence-matrix/latest/reproducibility-evidence-rows.json`
- `artifacts/platform-reproducibility-evidence-matrix/latest/reproducibility-evidence-gate-rows.json`
- `artifacts/platform-reproducibility-evidence-matrix/latest/reproducibility-evidence-boundary.json`
- `artifacts/platform-reproducibility-evidence-matrix/latest/validation-report.json`
- `artifacts/platform-reproducibility-evidence-matrix/latest/summary.md`

Check mode:

```bash
npm run platform:reproducibility-evidence-matrix -- --check
```

`--check` validates the matrix without writing or overwriting artifacts. Missing
package script registration, validation-chain registration, source registry
readiness, P357 ledger acceptance, or future release-check bridge declarations
blocks the matrix.
