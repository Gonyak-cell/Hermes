# Platform Release-Check Status Ledger

Status: P371 command specification.

`platform:release-check-status-ledger` consumes the P370 signoff closeout in
memory and publishes a unified read-only status ledger for the release-check
chain. It keeps the command, evidence, review, signoff, receipt, and closeout
state visible while recording that human receipts are still pending.

The status ledger does not receive receipts, validate receipts, complete
signoff, apply approvals, read generated artifacts, execute release checks, run
package commands, publish releases, run git operations, execute protected
actions, enable live trading, submit orders, or perform broker or exchange
writes.

## Command

```sh
npm run platform:release-check-status-ledger -- --check
```

## Status Policy

Each status row is `ready_pending_human_receipt`. This is not a release signoff.
It means the P361-P370 release-check readiness chain is aligned and ready for
external receipt collection, but no receipt has been received or applied by this
ledger.

## Human Review Note

The status ledger is an operator visibility surface only. Operators must collect,
validate, and apply human receipts in later gated phases before claiming release
signoff or publishing any release-facing output.
