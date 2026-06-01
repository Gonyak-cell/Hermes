# Trading Secret Scan Remediation Receipt Template Fixtures

P429 consumes P428 secret-scan remediation readiness and declares human-fillable
receipt templates for Secrets Scan Gate remediation. The templates record
external references and human decisions only; they do not receive or apply
receipt payloads.

## Scope

- Source: P428 `trading:secret-scan-remediation-fixtures`.
- Source: Control-plane human gate receipt instructions.
- Output: `artifacts/trading-secret-scan-remediation-receipt-template-fixtures/latest`.
- Workflow: `workflow.trading.secret_scan_remediation_receipt_template_fixtures.v1`.
- Capability: `trading.secret_scan_remediation_receipt_template_fixtures`.

## Safety Boundary

- Receipt templates remain pending human input.
- Templates include decision, reviewer, reference, notes, and completed-action
  fields, but no raw secret, token, provider-key, `.env`, or Desktop config
  content fields.
- No receipt payload is received, validated, applied, or converted into an
  approval.
- Credential lookup, broker writes, exchange writes, automatic redaction,
  deletion, rotation, artifact mutation, release publication, git operations,
  and protected actions remain false.

## Check

```sh
npm run trading:secret-scan-remediation-receipt-template-fixtures -- --check
```
