# Trading Credential Lookup Disabled Fixtures

Status: P385 command specification.

`trading:credential-lookup-disabled-fixtures` consumes P384 live adapter disabled
evidence and verifies that credential lookup and secret exposure stay disabled
across execution, market-data, paper/shadow, limited-live, full-auto, and
research/backtest/paper surfaces.

## Command

```sh
npm run trading:credential-lookup-disabled-fixtures -- --check
```

`--check` validates the credential lookup disabled fixtures without overwriting
existing artifacts. Without `--check`, generated reports are written under
`artifacts/trading-credential-lookup-disabled-fixtures/latest/`.

## Covered Boundaries

- Credential broker lookup remains disabled.
- Plaintext secrets and model-context secrets remain forbidden.
- Vendor credentials and external API keys are not required.
- Paper/shadow and limited-live surfaces stay credential-free.
- Full-auto failover cannot require external credentials or live adapter access.
- Secret logging remains blocked.
