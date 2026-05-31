# Trading Order Frequency Throttle Fixtures

`trading:order-frequency-throttle-fixtures` consumes the P396 short-selling
disabled boundary and verifies that order generation remains throttled to zero
across signal, risk, execution, paper/shadow, limited-live, and full-auto
surfaces.

The fixture is read-only and report-only. It checks deterministic examples for
zero daily order capacity, blocked order-intent generation, disabled submit
routes, non-executable shadow intents, and full-auto order-generation denial.

## Command

```sh
npm run trading:order-frequency-throttle-fixtures -- --check
```

`--check` validates the order-frequency throttle fixtures without overwriting
existing artifacts. Running without `--check` writes the report under
`artifacts/trading-order-frequency-throttle-fixtures/latest`.

## Review Note

- Human review is required before any future daily order cap, order-intent
  route, live submit route, or automatic order generation can be enabled.
- The command does not generate order intents, submit orders, enable live
  execution, write broker/exchange state, mutate protected artifacts, run git,
  or publish release outputs.
