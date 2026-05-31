# Trading Loss Streak Cooldown Fixtures

`trading:loss-streak-cooldown-fixtures` consumes the P397 order-frequency
throttle boundary and verifies that loss streak cooldown, halt, and manual
resume controls stay human-gated and non-mutating.

The fixture is read-only and report-only. It checks deterministic examples for
inactive current cooldown state, declared cooldown thresholds, risk halt policy,
paper loss review gates, limited-live halt gates, execution manual resume, and
full-auto control-plane-only disable behavior.

## Command

```sh
npm run trading:loss-streak-cooldown-fixtures -- --check
```

`--check` validates the loss-streak cooldown fixtures without overwriting
existing artifacts. Running without `--check` writes the report under
`artifacts/trading-loss-streak-cooldown-fixtures/latest`.

## Review Note

- Human review is required before any future cooldown bypass, halt resume,
  live order submission, or full-auto disable action can be applied.
- The command does not submit orders, enable live execution, cancel live orders,
  write broker/exchange state, mutate protected artifacts, run git, or publish
  release outputs.
