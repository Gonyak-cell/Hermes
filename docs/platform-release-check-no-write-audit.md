# Platform Release-Check No-Write Audit

Status: P364 command specification.

`platform:release-check-no-write-audit` verifies that the P361-P363
release-check bridge commands keep their `--check` no-overwrite guarantees
visible and test-backed. It audits source and tests for:

- `trading:release-check`
- `platform:ops-check`
- `platform:release-check`

The audit is intentionally lightweight. It does not run those commands, rebuild
artifacts, publish releases, run git operations, execute protected actions,
enable live trading, submit orders, or perform broker or exchange writes.

## Command

```sh
npm run platform:release-check-no-write-audit -- --check
```

## Readiness Signals

- Package scripts for all audited commands are registered.
- Each audited command parses `--check` and sets `write = false`.
- Each audited command only writes its own report when `options.write !== false`.
- Each audited command throws on validation failure in `--check` mode.
- Each audited command has a no-overwrite test for an existing artifact path.
- The audit command is included in `npm run validate`.

## Human Review Note

The no-write audit report is release-facing operational evidence. An operator
must review the summary before relying on it as proof that release-check
artifacts are safe to validate without overwriting existing evidence.
