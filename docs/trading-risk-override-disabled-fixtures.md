# Trading Risk Override Disabled Fixtures

`trading:risk-override-disabled-fixtures` consumes the P389 manual-resume
boundary and verifies that risk override remains human-gated, protected-action
gated, receipt-required, route-disabled, and unable to create order intents or
live execution.

The command checks the risk override policy, primary risk artifact, risk safety
boundary, read-only dashboard disabled routes, and order-intent boundary.

## Command

```bash
npm run trading:risk-override-disabled-fixtures -- --check
```

`--check` validates the risk override disabled fixtures without overwriting
existing artifacts.

## Human Review Notes

- The command is report-only and read-only.
- The command does not apply overrides, accept receipts, create order intents,
  generate advice, submit orders, execute live trades, or execute protected
  actions.
- Any future override path must remain behind explicit human approval and
  protected-action receipt gates.
