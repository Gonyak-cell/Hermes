# Trading Order Intent Disabled Fixtures

`trading:order-intent-disabled-fixtures` consumes the P392 first-trade boundary
and verifies that order-intent generation remains disabled or non-executable
across signals, model improvement, backtests, risk, shadow order intents, and
execution submission routes.

The command checks signal-to-order-intent gates, model order-intent permissions,
backtest order-intent boundaries, risk pre-order blocking, shadow review-only
intents, and execution submit throttles/routes.

## Command

```bash
npm run trading:order-intent-disabled-fixtures -- --check
```

`--check` validates the order intent disabled fixtures without overwriting
existing artifacts.

## Human Review Notes

- The command is report-only and read-only.
- The command does not create order intents, enable submit routes, submit
  orders, execute live trades, or execute protected actions.
- Any future order-intent path must remain behind risk gates, human approval
  receipts, and non-live execution controls.
