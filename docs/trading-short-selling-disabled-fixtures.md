# Trading Short Selling Disabled Fixtures

`trading:short-selling-disabled-fixtures` consumes the P395 leverage disabled
boundary and verifies that short selling remains disabled across research
policy, asset capability flags, strategy constraints, paper/order-intent
examples, and the risk short-selling capability gate.

The command checks `short_selling_enabled`, asset `short_allowed`, the
`no_short` strategy constraint, absence of short-side paper orders, and the P210
risk guard that blocks short selling and order-intent generation.

## Command

```bash
npm run trading:short-selling-disabled-fixtures -- --check
```

`--check` validates the short selling disabled fixtures without overwriting
existing artifacts.

## Human Review Notes

- The command is report-only and read-only.
- The command does not enable short selling, borrow checks, order intents,
  live trades, broker writes, or protected actions.
- Any future short-selling path must remain behind explicit human approval,
  risk gates, jurisdiction checks, route gates, and non-live execution controls.
