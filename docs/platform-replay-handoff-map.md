# Platform Replay Handoff Map

Phase 353 records the first replay handoff refinement after the lockfile policy.

`platform:replay-handoff-map` consumes P352 lockfile policy in memory and maps
the six replay scopes to owner roles, expected evidence, and next operator
actions. It does not run commands, regenerate artifacts, import history, change
checkout state, perform git operations, submit trading orders, or execute
protected actions.

Default output path:

- `artifacts/platform-replay-handoff-map/latest/platform-replay-handoff-map.json`
- `artifacts/platform-replay-handoff-map/latest/replay-handoff-rows.json`
- `artifacts/platform-replay-handoff-map/latest/replay-handoff-gate-rows.json`
- `artifacts/platform-replay-handoff-map/latest/replay-handoff-boundary.json`
- `artifacts/platform-replay-handoff-map/latest/validation-report.json`
- `artifacts/platform-replay-handoff-map/latest/summary.md`

Check mode:

```bash
npm run platform:replay-handoff-map -- --check
```

`--check` validates replay handoff readiness without writing or overwriting
artifacts. Missing package script registration, validation-chain registration,
or ledger acceptance blocks the handoff map.
