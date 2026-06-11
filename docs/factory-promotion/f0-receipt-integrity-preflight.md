# F0 Receipt Integrity Preflight

Status: F0 pre-implementation guard, not approval.
Date: 2026-06-11

## Purpose

F0.1 must not unblock connector or execution/write authority gates by dropping label-only receipt JSON files.

The current connector and execution/write authority gates still accept simple field-matching review receipts. Until the full FD receipt envelope replaces those gates, every F0.1 missing review receipt must pass this preflight before it can be treated as an unblock input.

## Scope

This preflight applies to:

- `artifacts/connector-external-app-governance/review/claude-connector-governance-review-receipt.json`
- `artifacts/execution-write-authority-maturity/review/claude-execution-write-authority-review-receipt.json`

## Required Binding Fields

Each F0.1 receipt must pass the machine preflight command:

```bash
npm run factory:receipt-preflight -- --check
```

For performed reviews, prefer generating the receipt through:

```bash
npm run factory:f0-review-receipt-intake -- --scope-id <scope> --raw-output-path <raw-output> --reviewed-commit-sha <sha> --engine-resolved-model-id <model>
```

Each F0.1 receipt must include:

| Field | Requirement |
|---|---|
| `scope_id` | Exact reviewed scope: connector external app governance or execution/write authority maturity |
| `reviewed_commit_sha` | Commit SHA of the repo state reviewed by the independent reviewer |
| `prompt_sha256` | SHA256 of the exact review prompt sent to the reviewer |
| `raw_output_sha256` | SHA256 of the durable raw reviewer output |
| `receipt_file_sha256` | SHA256 of the receipt file computed by the preflight |
| `engine_resolved_model_id` | Literal resolved model id from the reviewer runtime |
| `review_engine` | Current validator compatibility field. Must be `claude_code_opus_max` until FD replaces the gate |
| `unresolved_finding_count` | Integer count from normalized review finding loop |
| scope boolean | Current validator compatibility field: `scope_connector_external_app_governance` or `scope_execution_write_authority_maturity` |

## Required Negative Checks

The preflight must reject:

- receipt with missing reviewed commit SHA
- receipt whose model label differs from `engine_resolved_model_id`
- normalized receipt generated from failed Claude CLI/API output rather than completed review output
- receipt whose `raw_output_sha256` does not match the raw output body
- receipt whose `receipt_file_sha256` does not match the normalized receipt file
- receipt for a different scope
- receipt from the Fable planning session that authored this package
- receipt with unresolved or blocking findings hidden from the finding loop
- receipt that opens any write/deploy/protected/final-approval/production/enterprise authority flag

## F0.1 Acceptance Rule

F0.1 is complete only when both missing review receipts satisfy:

```text
current four-field validator shape passes
AND
F0 receipt-integrity preflight passes
AND
unresolved_finding_count === 0
AND
reviewed_commit_sha matches the intended F0 review target
```

For this run only, the human owner issued
`docs/factory-promotion/f0-owner-no-opus-exception-receipt.json`. That receipt
allows FA implementation to start at `owner_exception_low_trust` without
claiming that this F0.1 receipt preflight passed. The missing independent review
receipts remain deferred blockers before production PASS, enterprise PASS,
final approval, protected closeout, connector write, deployment, or release
approval.

FA implementation may start only after the aggregate F0 gate also passes:

```bash
npm run factory:promotion-f0-gate -- --check --require-pass
```

This preflight is not the final receipt system. FD still owns the full envelope, bound candidate hash, owner attestation, replay prevention, and gate replacement.

## Authority Boundary

Passing this preflight does not open project creation, repo write, connector write, command execution, deployment, protected action, production PASS, enterprise PASS, or any AI final approval.
