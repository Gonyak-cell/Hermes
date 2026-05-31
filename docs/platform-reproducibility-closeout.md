# Platform Reproducibility Closeout

Phase 360 closes the P341-P360 reproducibility baseline tranche.

`platform:reproducibility-closeout` consumes P359 reproducibility operator review
in memory, verifies the P341-P360 reproducibility commands are registered in
`package.json` and the validation chain, and records the P361-P380 unified
release-check range as the next platform operations block. It does not execute
checks, execute release-check commands, complete review, apply approvals,
materialize proof, read artifacts, collect evidence, install dependencies,
regenerate artifacts, import history, change checkout state, perform git
operations, submit trading orders, or execute protected actions.

Default output path:

- `artifacts/platform-reproducibility-closeout/latest/platform-reproducibility-closeout.json`
- `artifacts/platform-reproducibility-closeout/latest/reproducibility-closeout-rows.json`
- `artifacts/platform-reproducibility-closeout/latest/reproducibility-closeout-gate-rows.json`
- `artifacts/platform-reproducibility-closeout/latest/reproducibility-closeout-boundary.json`
- `artifacts/platform-reproducibility-closeout/latest/validation-report.json`
- `artifacts/platform-reproducibility-closeout/latest/summary.md`

Check mode:

```bash
npm run platform:reproducibility-closeout -- --check
```

`--check` validates closeout readiness without writing or overwriting artifacts.
Missing package script registration, validation-chain registration, source
operator review readiness, P360 ledger acceptance, or P361-P380 next-range
declaration blocks closeout.
