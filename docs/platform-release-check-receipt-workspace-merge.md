# Platform Release-Check Receipt Workspace Merge

Status: P375 command specification.

`platform:release-check-receipt-workspace-merge` consumes the P374 receipt
workspace in memory and declares deterministic merge rows for future human
receipt workspace inputs.

The merge manifest does not read actor workspace files, materialize merged
receipt input, receive receipt payloads, validate receipts, complete signoff,
apply approvals, read generated artifacts, execute release checks, run package
commands, publish releases, run git operations, execute protected actions,
enable live trading, submit orders, or perform broker or exchange writes.

## Command

```sh
npm run platform:release-check-receipt-workspace-merge -- --check
```

## Merge Policy

Each merge row is `ready_for_future_receipt_merge`. This means the source P374
workspace row is ready for human input, but actor workspace input is absent and
no merged receipt payload is ready for validation.

## Human Review Note

The merge manifest is an operator preparation surface only. Later gated phases
must materialize, collect, merge, validate, and apply human receipts before any
release signoff or release-facing output can be claimed.
