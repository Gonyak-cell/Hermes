# Trading Manual Resume Disabled Fixtures

`trading:manual-resume-disabled-fixtures` consumes the P388 consolidated safety
boundary and verifies that halt, rollback, disaster recovery, and resume paths
remain manual-review gated and route-disabled.

The command checks execution emergency halt, execution manual resume policy,
paper/shadow kill-switch dry-run, limited-live rollback-to-paper, full-auto
disaster recovery, and the full-auto operator handbook. It fails if manual
resume is no longer required, if a resume route is enabled, if live orders are
cancelled, if rollback stops targeting paper mode, or if external broker
recovery/protected action routes become available.

## Command

```bash
npm run trading:manual-resume-disabled-fixtures -- --check
```

`--check` validates the manual resume disabled fixtures without overwriting
existing artifacts.

## Human Review Notes

- The command is report-only and read-only.
- The command does not execute halt, resume, rollback, recovery, broker, or
  exchange actions.
- Any future resume path still requires a human approval receipt and must stay
  outside default control-plane execution.
