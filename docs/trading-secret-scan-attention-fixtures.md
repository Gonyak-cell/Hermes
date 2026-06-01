# Trading Secret Scan Attention Fixtures

P426 consumes P425 secret-scan gate readiness and records the operator attention
surface for secret leakage. It proves the Review Dashboard stage, leakage
counters, fix action, Review API filters, and Review API documentation remain
visible while no secret values are read or exposed.

## Scope

- Source: P425 `trading:secret-scan-gate-fixtures`.
- Output: `artifacts/trading-secret-scan-attention-fixtures/latest`.
- Workflow: `workflow.trading.secret_scan_attention_fixtures.v1`.
- Capability: `trading.secret_scan_attention_fixtures`.

## Safety Boundary

- The fixture reads only source/docs metadata and does not execute dashboard or
  API routes.
- Secret leakage attention states must remain visible through dashboard counters
  and Review API filters.
- No secret values, `.env` files, Desktop config content, provider keys, or raw
  secret material are read, materialized, or exposed.
- Credential lookup, broker writes, exchange writes, artifact mutation, release
  publication, git operations, and protected actions remain false.

## Check

```sh
npm run trading:secret-scan-attention-fixtures -- --check
```
