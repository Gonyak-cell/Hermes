# Trading Secret Scan Remediation Receipt Validation Rules Fixtures

P431 consumes P430 receipt-intake readiness and declares deterministic future
validation rules for each queued Secrets Scan Gate remediation receipt. The
rules copy required fields and allowed outcomes from the pending human templates,
but do not receive, validate, or apply receipt payloads.

## Scope

- Source: P430 `trading:secret-scan-remediation-receipt-intake-fixtures`.
- Output: `artifacts/trading-secret-scan-remediation-receipt-validation-rules-fixtures/latest`.
- Workflow: `workflow.trading.secret_scan_remediation_receipt_validation_rules_fixtures.v1`.
- Capability: `trading.secret_scan_remediation_receipt_validation_rules_fixtures`.

## Safety Boundary

- Validation rule rows are declarations for future human receipts only.
- Every P430 intake row has a matching validation-rule row.
- Required receipt fields and allowed outcomes are copied without forbidden
  secret-material field names.
- No receipt payload is received, validated, applied, or converted into
  approval.
- Secret values, `.env` files, Desktop config content, credential lookup,
  broker writes, exchange writes, automatic redaction, deletion, rotation,
  artifact mutation, release publication, git operations, and protected actions
  remain false.

## Check

```sh
npm run trading:secret-scan-remediation-receipt-validation-rules-fixtures -- --check
```
