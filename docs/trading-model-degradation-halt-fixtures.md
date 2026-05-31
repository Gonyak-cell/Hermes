# Trading Model Degradation Halt Fixtures

`trading:model-degradation-halt-fixtures` consumes the P398 loss-streak cooldown
boundary and verifies that model degradation halt controls stay source-bound,
human-gated, and non-mutating.

The fixture is read-only and report-only. It checks deterministic examples for
risk model degradation halt source binding, model-improvement degradation checks
that block promotion, paper-stage research model scorecards, limited-live model
degradation halt gates, and full-auto control-plane-only disable behavior.

## Command

```sh
npm run trading:model-degradation-halt-fixtures -- --check
```

`--check` validates the model degradation halt fixtures without overwriting
existing artifacts. Running without `--check` writes the report under
`artifacts/trading-model-degradation-halt-fixtures/latest`.

## Review Note

- Human review is required before any future model degradation halt bypass,
  model promotion, live model enablement, or full-auto disable action can be
  applied.
- The command does not deploy models, submit orders, enable live execution,
  write broker/exchange state, mutate protected artifacts, run git, or publish
  release outputs.
