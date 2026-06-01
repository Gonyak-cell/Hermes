# Trading Secret Scan Remediation Receipt Workspace Fixtures

P432 consumes P431 receipt validation-rule readiness and declares external
human workspace rows for each queued Secrets Scan Gate remediation receipt. The
workspace layer exposes editable fields and references only; it does not
materialize receipt input files or read actor workspace payloads.

## Scope

- Source: P431 `trading:secret-scan-remediation-receipt-validation-rules-fixtures`.
- Output: `artifacts/trading-secret-scan-remediation-receipt-workspace-fixtures/latest`.
- Workflow: `workflow.trading.secret_scan_remediation_receipt_workspace_fixtures.v1`.
- Capability: `trading.secret_scan_remediation_receipt_workspace_fixtures`.

## Safety Boundary

- Every P431 validation-rule row has one workspace row.
- Editable receipt fields and external human workspace references are declared.
- No receipt input file is materialized and no actor workspace file or payload is
  read.
- No receipt payload is received, validated, applied, or converted into
  approval.
- Secret values, `.env` files, Desktop config content, credential lookup,
  broker writes, exchange writes, automatic redaction, deletion, rotation,
  artifact mutation, release publication, git operations, and protected actions
  remain false.

## Check

```sh
npm run trading:secret-scan-remediation-receipt-workspace-fixtures -- --check
```
