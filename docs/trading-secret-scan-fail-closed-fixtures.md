# Trading Secret Scan Fail-Closed Fixtures

P427 consumes P426 secret-scan attention readiness and the P300 Secrets Scan
Gate output to prove the platform fails closed on credential, token, env,
Desktop config, provider-key, protected config write, and secret-transfer
leakage signals.

## Scope

- Source: P426 `trading:secret-scan-attention-fixtures`.
- Source: P300 `security:secrets-scan-gate`.
- Output: `artifacts/trading-secret-scan-fail-closed-fixtures/latest`.
- Workflow: `workflow.trading.secret_scan_fail_closed_fixtures.v1`.
- Capability: `trading.secret_scan_fail_closed_fixtures`.

## Safety Boundary

- The fixture reads only prior structured artifacts and source/docs metadata.
- The synthetic leakage probe is a redacted decision check; it does not
  materialize secret values or inspect `.env` or Desktop config content.
- Every Secrets Scan Gate row must declare `fail_on_leakage`, forbid leakage,
  require human review, and keep client-facing readiness false.
- Credential lookup, broker writes, exchange writes, artifact mutation, release
  publication, git operations, and protected actions remain false.

## Check

```sh
npm run trading:secret-scan-fail-closed-fixtures -- --check
```
