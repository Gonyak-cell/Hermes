# Platform Runtime Replay Window

Phase 343 adds a read-only replay-window artifact for runtime/dependency
stability operations.

`platform:replay-window` consumes the P342 drift check in memory and publishes
the operator replay windows that should be used when runtime files, dependency
policy, schemas, generated artifacts, cross-OS history, or Trading safety
surfaces change. It does not execute those commands. The artifact is a handoff
map, not a runner.

Default output path:

- `artifacts/platform-runtime-replay-window/latest/platform-runtime-replay-window.json`
- `artifacts/platform-runtime-replay-window/latest/replay-windows.json`
- `artifacts/platform-runtime-replay-window/latest/replay-command-rows.json`
- `artifacts/platform-runtime-replay-window/latest/operator-handoff-rows.json`
- `artifacts/platform-runtime-replay-window/latest/runtime-replay-boundary.json`
- `artifacts/platform-runtime-replay-window/latest/validation-report.json`
- `artifacts/platform-runtime-replay-window/latest/summary.md`

Check mode:

```bash
npm run platform:replay-window -- --check
```

`--check` validates the replay-window report without writing or overwriting
artifacts. If the source P342 drift check detects runtime/dependency drift, the
P343 replay-window artifact is blocked until that drift is reviewed.

Boundary:

- No command execution.
- No dependency install.
- No package or lockfile mutation.
- No git import, tag, or release operation.
- No recovery or protected-action execution.
- Desktop remains a read-only operator surface.
- Trading live/full-auto/order submission and broker writes remain disabled.
