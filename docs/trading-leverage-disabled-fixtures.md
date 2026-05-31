# Trading Leverage Disabled Fixtures

`trading:leverage-disabled-fixtures` consumes the P394 market-order disabled
boundary and verifies that leverage and margin remain disabled across research
policy, asset capability flags, strategy constraints, backtest position sizing,
and the risk leverage/margin gate.

The command checks `leverage_enabled`, derivative/live capability flags, the
`no_leverage` strategy constraint, bounded backtest sizing, and the P209 risk
guard that blocks leverage, margin, and order-intent generation.

## Command

```bash
npm run trading:leverage-disabled-fixtures -- --check
```

`--check` validates the leverage disabled fixtures without overwriting existing
artifacts.

## Human Review Notes

- The command is report-only and read-only.
- The command does not enable margin, increase position size, generate order
  intents, submit orders, execute live trades, or execute protected actions.
- Any future leverage or margin path must remain behind explicit human approval,
  risk gates, route gates, and non-live execution controls.
