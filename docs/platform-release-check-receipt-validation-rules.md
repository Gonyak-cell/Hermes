# Platform Release-Check Receipt Validation Rules

Status: P373 command specification.

`platform:release-check-receipt-validation-rules` consumes the P372 receipt
queue in memory and declares the deterministic validation rules that future
human receipt payloads must satisfy.

The rules ledger does not receive receipt payloads, validate receipts, complete
signoff, apply approvals, read generated artifacts, execute release checks, run
package commands, publish releases, run git operations, execute protected
actions, enable live trading, submit orders, or perform broker or exchange
writes.

## Command

```sh
npm run platform:release-check-receipt-validation-rules -- --check
```

## Rule Policy

Each rule row is `ready_for_future_receipt_validation`. The required fields are
`reviewer_id`, `reviewed_at`, `source_signoff_row_id`, `decision`,
`evidence_reference`, and `blocker_note`. Allowed decisions are `signoff_ready`
and `return_with_blocker`.

## Human Review Note

This command only declares validation rules. Later gated phases must receive and
validate human receipts before any signoff or release-facing output can be
claimed.
