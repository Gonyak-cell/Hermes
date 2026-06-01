# Trading Broker Adapter Separation Fixtures

P421 consumes P420 promotion receipt-chain signoff closeout readiness and records
broker adapter separation fixtures for the next safety block. It proves simulated
and sandbox adapter contracts stay separate from the disabled live adapter
contract, default control-plane paths do not import or enable live adapter files,
and credentials remain reference-only.

## Scope

- Source: P420 `trading:promotion-receipt-chain-signoff-closeout-fixtures`.
- Output: `artifacts/trading-broker-adapter-separation-fixtures/latest`.
- Workflow: `workflow.trading.broker_adapter_separation_fixtures.v1`.
- Capability: `trading.broker_adapter_separation_fixtures`.

## Safety Boundary

- Simulated/sandbox contracts are present and simulation-only.
- The live adapter contract is disabled by default and not imported by default.
- Credential references remain disabled/reference-only; plaintext secrets,
  provider keys, environment dumps, and model-context secrets stay absent.
- Live execution, order submission, broker writes, exchange writes, artifact
  reads/writes, command execution, git operations, and protected actions remain
  false.

## Check

```sh
npm run trading:broker-adapter-separation-fixtures -- --check
```
