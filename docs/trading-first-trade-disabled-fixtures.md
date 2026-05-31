# Trading First Trade Disabled Fixtures

`trading:first-trade-disabled-fixtures` consumes the P391 promotion-disabled
boundary and verifies that limited-live first-trade submission remains blocked
without explicit approval, first-trade confirmation, order capacity, enabled
order routes, live cancel, live fills, or real order reporting.

The command checks limited-live approval state, first-trade confirmation, order
caps, dashboard disabled routes, auto-cancel state, post-trade reconciliation,
and daily live report evidence.

## Command

```bash
npm run trading:first-trade-disabled-fixtures -- --check
```

`--check` validates the first trade disabled fixtures without overwriting
existing artifacts.

## Human Review Notes

- The command is report-only and read-only.
- The command does not accept approval receipts, confirm a first trade, submit
  orders, cancel live orders, record live fills, or execute protected actions.
- Any future first-trade path must remain behind explicit human approval,
  protected-action receipt gates, and deterministic order-cap checks.
