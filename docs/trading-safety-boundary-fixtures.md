# Trading Safety Boundary Fixtures

`trading:safety-boundary-fixtures` consumes the P381-P387 Trading safety
fixture chain and produces a consolidated safety boundary view for P388.

The command verifies that safety regression, route inventory, approval
absence, live adapter disabled, credential lookup disabled, broker write
disabled, and exchange write disabled layers are all ready. It also proves the
combined boundary still blocks limited-live, full-auto, automatic order
submission, live order submission, live adapters, credential lookup, broker
writes, exchange writes, live cancel, real orders, and protected actions.

## Command

```bash
npm run trading:safety-boundary-fixtures -- --check
```

`--check` validates the consolidated safety boundary without overwriting
existing artifacts.

## Human Review Notes

- The command is report-only and read-only.
- The command does not enable live trading, full-auto, order submission,
  broker writes, exchange writes, credentials, approvals, release publishing,
  git operations, or protected actions.
- The output is a review packet for operators before P389+ work, not a
  trading enablement receipt.
