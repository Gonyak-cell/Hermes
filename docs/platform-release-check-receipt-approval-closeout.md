# Platform Release-Check Receipt Approval Closeout

Status: P379 command specification.

`platform:release-check-receipt-approval-closeout` consumes the P378 receipt
approval plan in memory and closes the approval-plan readiness layer for future
human receipt approval closeout.

The approval closeout does not read actor workspace files, materialize merged
receipt input, receive receipt payloads, validate receipts, complete signoff,
apply approvals, read generated artifacts, execute release checks, run package
commands, publish releases, run git operations, execute protected actions,
enable live trading, submit orders, or perform broker or exchange writes.

## Command

```sh
npm run platform:release-check-receipt-approval-closeout -- --check
```

## Approval Closeout Policy

Each approval-closeout row is `ready_for_future_receipt_approval_closeout`. This
means the source P378 approval plan is ready and future approval closeout steps
are declared, but no receipt payload is validated, no signoff is completed, and
no approval is applied.

## Human Review Note

The approval closeout is an operator preparation surface only. Later gated
phases must collect, validate, approve, and sign off human receipts before any
release-facing output can be claimed.
