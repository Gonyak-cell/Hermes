# Platform Operations Freeze Receipt Merge Preflight

Status: P494 command specification.

`platform:operations-freeze-receipt-merge-preflight` consumes the P493
operations-freeze receipt workspace merge manifest in memory and declares
deterministic preflight rows for future merged receipt validation.

The preflight does not read actor workspace files, materialize receipt input,
materialize merged receipt input, receive receipt payloads, validate receipts,
complete signoff, apply approvals, read generated artifacts, execute acceptance
or package commands, publish releases, run git operations, execute protected
actions, run protected recovery, enable live trading, submit orders, perform
broker or exchange writes, inspect Desktop config, read `.env` files, look up
credentials, or expose secret values.

## Command

```sh
npm run platform:operations-freeze-receipt-merge-preflight -- --check
```

## Preflight Policy

Each preflight row is `ready_for_future_receipt_merge_validation`. This means
the source P493 merge row is ready and the future validation checklist is
declared, but no actor workspace input, merged receipt input, or receipt payload
is present.

## Human Review Note

The preflight is an operator preparation surface only. Later gated phases must
materialize, collect, merge, validate, and apply human receipts before any
operations-freeze readiness, release-facing output, protected action, recovery
step, trading write, Desktop source-of-truth claim, or secret-sensitive action
can be claimed.
