# Platform Operator Handoff

Phase 344 adds structured operator handoff packets for the runtime/dependency
stability program.

`platform:operator-handoff` consumes the P343 replay-window report in memory and
turns each replay window into a human-reviewable packet with required evidence,
required decisions, owner role, and next operator action. It does not execute
commands, regenerate artifacts, import git history, apply approvals, run
recovery, or produce client-facing output.

Default output path:

- `artifacts/platform-operator-handoff/latest/platform-operator-handoff.json`
- `artifacts/platform-operator-handoff/latest/operator-handoff-packets.json`
- `artifacts/platform-operator-handoff/latest/handoff-evidence-rows.json`
- `artifacts/platform-operator-handoff/latest/handoff-decision-rows.json`
- `artifacts/platform-operator-handoff/latest/operator-handoff-boundary.json`
- `artifacts/platform-operator-handoff/latest/validation-report.json`
- `artifacts/platform-operator-handoff/latest/summary.md`

Check mode:

```bash
npm run platform:operator-handoff -- --check
```

`--check` validates the handoff packet map without writing or overwriting
artifacts. If P343 replay-window readiness is blocked, the P344 handoff is also
blocked until the source drift/replay issue is reviewed.
