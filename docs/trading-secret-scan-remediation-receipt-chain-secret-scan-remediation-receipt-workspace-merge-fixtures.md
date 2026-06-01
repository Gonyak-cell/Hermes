# Trading Secret Scan Remediation Receipt Chain Secret Scan Remediation Receipt Workspace Merge Fixtures

P459 consumes P458 receipt-workspace readiness and declares future merge rows for
Secrets Scan Gate remediation receipts. The merge layer is a deterministic
manifest only: it does not read actor workspace files, merge receipt inputs, or
make receipt payloads ready for validation.

## Scope

- Source: P458 `trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-fixtures`.
- Output: `artifacts/trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-merge-fixtures/latest`.
- Workflow: `workflow.trading.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_fixtures.v1`.
- Capability: `trading.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_fixtures`.

## Safety Boundary

- Every P458 workspace row has one future merge row.
- Merge manifests are declared without performing a merge.
- No actor workspace file or payload is read.
- No receipt input file or merged receipt input is materialized.
- No receipt payload is received, validated, applied, or converted into
  approval.
- Secret values, `.env` files, Desktop config content, Desktop provider keys,
  credential lookup, remediation action, broker writes, exchange writes,
  automatic redaction, deletion, rotation, artifact mutation, release
  publication, git operations, and protected actions remain false.

## Check

```sh
npm run trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-merge-fixtures -- --check
```
