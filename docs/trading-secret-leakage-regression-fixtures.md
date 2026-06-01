# Trading Secret Leakage Regression Fixtures

P424 consumes P423 secret-handle boundary readiness and records synthetic
secret-leakage regression cases. It proves external secret-handle placeholders
remain allowed as references while provider-key, bearer-token, private-key,
environment-dump, and Desktop provider-key visibility patterns remain blocked.

## Scope

- Source: P423 `trading:secret-handle-boundary-fixtures`.
- Output: `artifacts/trading-secret-leakage-regression-fixtures/latest`.
- Workflow: `workflow.trading.secret_leakage_regression_fixtures.v1`.
- Capability: `trading.secret_leakage_regression_fixtures`.

## Safety Boundary

- Regression rows use synthetic pattern IDs and redacted samples only.
- Raw secret values, provider keys, private keys, bearer tokens, and environment
  dumps are never materialized in repo artifacts.
- External secret handles stay reference-only and are not treated as plaintext
  secret material.
- Credential lookup, broker writes, exchange writes, command execution, artifact
  mutation, release publication, git operations, and protected actions remain
  false.

## Check

```sh
npm run trading:secret-leakage-regression-fixtures -- --check
```
