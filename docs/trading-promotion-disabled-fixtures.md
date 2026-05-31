# Trading Promotion Disabled Fixtures

`trading:promotion-disabled-fixtures` consumes the P390 risk-override boundary
and verifies that trading promotion paths remain human-gated, receipt-blocked,
route-disabled, and unable to enable shadow-live, limited-live, full-auto, order
submission, or live execution.

The command checks model promotion policy, backtest promotion boundary,
paper-to-shadow promotion, shadow-to-limited-live promotion,
limited-live-to-full-auto promotion, and full-auto approval state.

## Command

```bash
npm run trading:promotion-disabled-fixtures -- --check
```

`--check` validates the promotion disabled fixtures without overwriting existing
artifacts.

## Human Review Notes

- The command is report-only and read-only.
- The command does not accept promotion receipts, approve stages, enable live
  routes, create order intents, submit orders, execute live trades, or execute
  protected actions.
- Future promotion stages must remain behind independent human approval receipts
  and protected-action gates.
