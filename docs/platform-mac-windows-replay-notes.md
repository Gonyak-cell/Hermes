# Platform Mac/Windows Replay Notes

Phase 351 starts the P351-P355 operator handoff sequence for cross-OS replay
context.

`platform:mac-windows-replay-notes` consumes the P350 provenance freeze in
memory, records Mac snapshot and Windows history replay notes, and verifies that
history import, checkout mutation, artifact regeneration, and lockfile mutation
remain outside this report. It does not run commands, import git history, change
the repository checkout, mutate lockfiles, regenerate artifacts, or execute
protected actions.

Default output path:

- `artifacts/platform-mac-windows-replay-notes/latest/platform-mac-windows-replay-notes.json`
- `artifacts/platform-mac-windows-replay-notes/latest/replay-note-rows.json`
- `artifacts/platform-mac-windows-replay-notes/latest/replay-gate-rows.json`
- `artifacts/platform-mac-windows-replay-notes/latest/mac-windows-replay-boundary.json`
- `artifacts/platform-mac-windows-replay-notes/latest/validation-report.json`
- `artifacts/platform-mac-windows-replay-notes/latest/summary.md`

Check mode:

```bash
npm run platform:mac-windows-replay-notes -- --check
```

`--check` validates replay-note readiness without writing or overwriting
artifacts. Missing package script registration, validation-chain registration,
or ledger acceptance blocks the notes.
