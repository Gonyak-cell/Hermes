# Trading Market Order Disabled Fixtures

`trading:market-order-disabled-fixtures` consumes the P393 order-intent disabled
boundary and verifies that market orders remain disabled across research policy,
strategy examples, shadow intents, execution order-type controls, limited-live
routes, and full-auto routes.

The command checks market-order policy flags, sample order intent type, the
`no_market_order` strategy constraint, shadow non-executable intents, execution
order-type whitelist/throttle state, and disabled order submission routes.

## Command

```bash
npm run trading:market-order-disabled-fixtures -- --check
```

`--check` validates the market order disabled fixtures without overwriting
existing artifacts.

## Human Review Notes

- The command is report-only and read-only.
- The command does not submit market orders, enable order routes, execute live
  trades, write broker/exchange state, or execute protected actions.
- Any future market-order path must remain behind explicit human approval,
  risk gates, route gates, and non-live execution controls.
