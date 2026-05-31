# Trading Exchange Write Disabled Fixtures

Status: P387 command specification.

`trading:exchange-write-disabled-fixtures` consumes P386 broker write disabled
evidence and verifies that exchange writes, live order submission, live
cancellation, real order side effects, and broker/exchange failover writes stay disabled
across execution, paper/shadow, limited-live, and full-auto surfaces.

## Command

```sh
npm run trading:exchange-write-disabled-fixtures -- --check
```

`--check` validates the exchange write disabled fixtures without overwriting
existing artifacts. Without `--check`, generated reports are written under
`artifacts/trading-exchange-write-disabled-fixtures/latest/`.

## Covered Boundaries

- Crypto exchange adapter write methods remain disabled.
- Live submit state and live order submission remain blocked.
- Paper/shadow no-order mode keeps exchange writes disabled.
- Limited-live approval absence and order caps block exchange writes.
- Live cancel routes stay disabled.
- Full-auto broker/exchange failover falls back to paper without exchange writes.
