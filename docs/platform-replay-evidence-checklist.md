# Platform Replay Evidence Checklist

Phase 354 records the replay evidence checklist that operators use before replay
handoff closeout.

`platform:replay-evidence-checklist` consumes P353 replay handoff map in memory
and records the expected evidence rows for runtime, contracts, validation,
artifact regeneration, cross-OS history, trading safety, and human review. It
does not collect evidence, run commands, regenerate artifacts, import history,
change checkout state, perform git operations, submit trading orders, or execute
protected actions.

Default output path:

- `artifacts/platform-replay-evidence-checklist/latest/platform-replay-evidence-checklist.json`
- `artifacts/platform-replay-evidence-checklist/latest/replay-evidence-rows.json`
- `artifacts/platform-replay-evidence-checklist/latest/replay-evidence-gate-rows.json`
- `artifacts/platform-replay-evidence-checklist/latest/replay-evidence-boundary.json`
- `artifacts/platform-replay-evidence-checklist/latest/validation-report.json`
- `artifacts/platform-replay-evidence-checklist/latest/summary.md`

Check mode:

```bash
npm run platform:replay-evidence-checklist -- --check
```

`--check` validates replay evidence checklist readiness without writing or
overwriting artifacts. Missing package script registration, validation-chain
registration, or ledger acceptance blocks the checklist.
