# Trading Data Outage Halt Fixtures

`trading:data-outage-halt-fixtures` consumes the P399 model degradation halt
boundary and verifies that data outage halt controls stay armed, read-only, and
non-mutating.

The fixture is read-only and report-only. It checks deterministic examples for
risk data-outage and stale-data gates, market-data quality gates that block
usage on failure, paper/shadow outage halt detection, limited-live outage and
stale-data halts, and full-auto read-only failover behavior.

## Command

```sh
npm run trading:data-outage-halt-fixtures -- --check
```

`--check` validates the data outage halt fixtures without overwriting
existing artifacts. Running without `--check` writes the report under
`artifacts/trading-data-outage-halt-fixtures/latest`.

## Review Note

- Human review is required before any future data outage halt bypass, quality
  gate bypass, live-feed enablement, or full-auto failover action can be
  applied.
- The command does not enable live feeds, submit orders, enable live execution,
  write broker/exchange state, mutate protected artifacts, run git, or publish
  release outputs.
