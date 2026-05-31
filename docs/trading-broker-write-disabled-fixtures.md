# Trading Broker Write Disabled Fixtures

Status: P386 command specification.

`trading:broker-write-disabled-fixtures` consumes P385 credential lookup
disabled evidence and verifies that broker writes, live order submission, live
cancellation, real order side effects, and broker failover writes stay disabled
across execution, paper/shadow, limited-live, and full-auto surfaces.

## Command

```sh
npm run trading:broker-write-disabled-fixtures -- --check
```

`--check` validates the broker write disabled fixtures without overwriting
existing artifacts. Without `--check`, generated reports are written under
`artifacts/trading-broker-write-disabled-fixtures/latest/`.

## Covered Boundaries

- Broker adapter write methods remain disabled.
- Live submit state and live order submission remain blocked.
- Paper/shadow no-order mode keeps broker writes disabled.
- Limited-live approval absence and order caps block broker writes.
- Live cancel routes stay disabled.
- Full-auto broker failover falls back to paper without broker writes.
