# Platform Replay Handoff Closeout

Phase 355 closes the P351-P355 replay handoff sequence.

`platform:replay-handoff-closeout` consumes P354 replay evidence checklist in
memory, verifies the P351-P355 replay handoff commands are registered, and
records closeout readiness without running replay actions. It does not execute
commands, regenerate artifacts, collect evidence, import history, change
checkout state, perform git operations, submit trading orders, or execute
protected actions.

Default output path:

- `artifacts/platform-replay-handoff-closeout/latest/platform-replay-handoff-closeout.json`
- `artifacts/platform-replay-handoff-closeout/latest/replay-handoff-closeout-rows.json`
- `artifacts/platform-replay-handoff-closeout/latest/replay-handoff-closeout-gate-rows.json`
- `artifacts/platform-replay-handoff-closeout/latest/replay-handoff-closeout-boundary.json`
- `artifacts/platform-replay-handoff-closeout/latest/validation-report.json`
- `artifacts/platform-replay-handoff-closeout/latest/summary.md`

Check mode:

```bash
npm run platform:replay-handoff-closeout -- --check
```

`--check` validates replay handoff closeout readiness without writing or
overwriting artifacts. Missing package script registration, validation-chain
registration, or ledger acceptance blocks the closeout.
