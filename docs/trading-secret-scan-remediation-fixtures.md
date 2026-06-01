# Trading Secret Scan Remediation Fixtures

P428 consumes P427 secret-scan fail-closed readiness and records the operator
remediation boundary for Secrets Scan Gate findings. The dashboard may surface a
fix action, but the action stays advisory and human-review-only.

## Scope

- Source: P427 `trading:secret-scan-fail-closed-fixtures`.
- Source: Review Dashboard Secrets Scan Gate action items.
- Source: Control-plane action plan command mapping.
- Source: Control-plane human gate receipt instructions.
- Output: `artifacts/trading-secret-scan-remediation-fixtures/latest`.
- Workflow: `workflow.trading.secret_scan_remediation_fixtures.v1`.
- Capability: `trading.secret_scan_remediation_fixtures`.

## Safety Boundary

- `fix_secrets_scan_gate` and `rerun_secrets_scan_gate` are not mapped to
  automatic control-plane commands.
- Pending human receipt rows do not close gates or trigger protected actions.
- No automatic secret redaction, deletion, rotation, apply, or fix scripts are
  registered in the package command surface.
- Secret values, `.env` files, Desktop config content, credential lookup,
  broker writes, exchange writes, artifact mutation, release publication, git
  operations, and protected actions remain false.

## Check

```sh
npm run trading:secret-scan-remediation-fixtures -- --check
```
