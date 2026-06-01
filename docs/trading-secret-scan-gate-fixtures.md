# Trading Secret Scan Gate Fixtures

P425 consumes P424 secret-leakage regression readiness and records the bridge to
the existing platform Secrets Scan Gate. It proves the Trading secret regression
chain is paired with the package command, control-plane loop step, contract
validation requirement, Review API surfaces, and documentation boundary that
forbids reading real secret values.

## Scope

- Source: P424 `trading:secret-leakage-regression-fixtures`.
- Output: `artifacts/trading-secret-scan-gate-fixtures/latest`.
- Workflow: `workflow.trading.secret_scan_gate_fixtures.v1`.
- Capability: `trading.secret_scan_gate_fixtures`.

## Safety Boundary

- The fixture verifies registration and documentation only; it does not execute
  the security scan gate command.
- Existing `security:secrets-scan-gate` coverage stays attached to package,
  contract validation, control-plane loop, and Review API surfaces.
- Secret scan documentation must continue to forbid reading secret values,
  `.env` files, Desktop config content, network access, and protected actions.
- Credential lookup, broker writes, exchange writes, artifact mutation, release
  publication, git operations, and protected actions remain false.

## Check

```sh
npm run trading:secret-scan-gate-fixtures -- --check
```
