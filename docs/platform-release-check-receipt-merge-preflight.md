# Platform Release-Check Receipt Merge Preflight

Status: P376 command specification.

`platform:release-check-receipt-merge-preflight` consumes the P375 receipt
workspace merge manifest in memory and declares deterministic preflight rows for
future merged receipt validation.

The preflight does not read actor workspace files, materialize merged receipt
input, receive receipt payloads, validate receipts, complete signoff, apply
approvals, read generated artifacts, execute release checks, run package
commands, publish releases, run git operations, execute protected actions,
enable live trading, submit orders, or perform broker or exchange writes.

## Command

```sh
npm run platform:release-check-receipt-merge-preflight -- --check
```

## Preflight Policy

Each preflight row is `ready_for_future_receipt_merge_validation`. This means
the source P375 merge row is ready, and the future validation checklist is
declared, but no actor workspace input or merged receipt payload is present.

## Human Review Note

The preflight is an operator preparation surface only. Later gated phases must
materialize, collect, merge, validate, and apply human receipts before any
release signoff or release-facing output can be claimed.
