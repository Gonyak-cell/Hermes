# Trading Live Adapter Disabled Fixtures

Status: P384 command specification.

`trading:live-adapter-disabled-fixtures` consumes P383 approval absence evidence
and verifies that live adapter state remains disabled across execution,
paper/shadow, limited-live, full-auto, and market-data failover surfaces.

## Command

```sh
npm run trading:live-adapter-disabled-fixtures -- --check
```

`--check` validates the live adapter disabled fixtures without overwriting
existing artifacts. Without `--check`, generated reports are written under
`artifacts/trading-live-adapter-disabled-fixtures/latest/`.

## Covered Boundaries

- The execution `live_adapter` is disabled by default and cannot use external
  network access or live writes.
- Broker and exchange interfaces keep write methods disabled.
- Shadow live data remains read-only and credential-free.
- Limited-live outage gates can reference the live adapter boundary, but live
  submission and live cancellation remain blocked.
- Full-auto broker/exchange failover targets paper and does not require a live
  adapter.
