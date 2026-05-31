# Platform Reproducibility Check Registry

Phase 356 starts the P356-P360 reproducibility check sequence.

`platform:reproducibility-check-registry` consumes P355 replay handoff closeout in
memory, verifies the P341-P356 reproducibility commands are registered in
`package.json` and the validation chain, and records the future P361-P380
release-check bridge declared in the platform operations ledger. It does not run
the checks, execute release-check commands, install dependencies, regenerate
artifacts, import history, change checkout state, perform git operations, submit
trading orders, or execute protected actions.

Default output path:

- `artifacts/platform-reproducibility-check-registry/latest/platform-reproducibility-check-registry.json`
- `artifacts/platform-reproducibility-check-registry/latest/reproducibility-check-rows.json`
- `artifacts/platform-reproducibility-check-registry/latest/release-chain-bridge-rows.json`
- `artifacts/platform-reproducibility-check-registry/latest/reproducibility-gate-rows.json`
- `artifacts/platform-reproducibility-check-registry/latest/reproducibility-boundary.json`
- `artifacts/platform-reproducibility-check-registry/latest/validation-report.json`
- `artifacts/platform-reproducibility-check-registry/latest/summary.md`

Check mode:

```bash
npm run platform:reproducibility-check-registry -- --check
```

`--check` validates reproducibility registry readiness without writing or
overwriting artifacts. Missing package script registration, validation-chain
registration, P356 ledger acceptance, or future release-check bridge declarations
blocks the registry.
