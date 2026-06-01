# Trading Secret Scan Remediation Receipt Intake Fixtures

P430 consumes P429 receipt-template readiness and queues one pending human input
row for each Secrets Scan Gate remediation receipt template. The intake queue is
reference-only and does not receive, validate, or apply receipt payloads.

## Scope

- Source: P429 `trading:secret-scan-remediation-receipt-template-fixtures`.
- Output: `artifacts/trading-secret-scan-remediation-receipt-intake-fixtures/latest`.
- Workflow: `workflow.trading.secret_scan_remediation_receipt_intake_fixtures.v1`.
- Capability: `trading.secret_scan_remediation_receipt_intake_fixtures`.

## Safety Boundary

- Intake rows stay `pending_human_input`.
- Every intake row references a P429 receipt template.
- No receipt payload is received, validated, applied, or converted into
  approval.
- Secret values, `.env` files, Desktop config content, credential lookup,
  broker writes, exchange writes, automatic redaction, deletion, rotation,
  artifact mutation, release publication, git operations, and protected actions
  remain false.

## Check

```sh
npm run trading:secret-scan-remediation-receipt-intake-fixtures -- --check
```
