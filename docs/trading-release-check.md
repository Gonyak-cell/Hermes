# Trading Release Check

Status: P361 command specification.

`trading:release-check` is the first unified check command in the P361-P380
platform operations stability tranche. It executes the contract validation,
release freeze, and Trading Pack command stack in `--check` mode so operators
do not have to remember the command order.

The command is intentionally a control-plane check runner. Child commands are
invoked with `--check`, and the command records that it does not install
dependencies, mutate packages or lockfiles, publish releases, perform git
operations, execute protected actions, enable live trading, enable full-auto,
submit orders, or perform broker/exchange writes.

## Command

```sh
npm run trading:release-check -- --check
```

## Child Check Stack

- `contracts:golden-fixtures -- --check`
- `contracts:validate -- --check`
- `release:freeze -- --check`
- `trading:validate -- --check`
- `trading:safety-check -- --check`
- `trading:golden-fixtures -- --check`
- `trading:dashboard -- --check`
- `trading:strategy-taxonomy -- --check`
- `trading:market-data-report -- --check`
- `trading:feature-report -- --check`
- `trading:signal-report -- --check`
- `trading:model-train-report -- --check`
- `trading:model-eval-report -- --check`
- `trading:backtest-report -- --check`
- `trading:risk-check -- --check`
- `trading:paper-report -- --check`
- `trading:shadow-report -- --check`
- `trading:execution-report -- --check`
- `trading:limited-live-report -- --check`
- `trading:full-auto-report -- --check`

## Human Review Note

The release-check summary is release-facing and trading-facing operational
evidence. An operator must review the generated summary before relying on it for
release decisions or Trading Pack readiness claims.
