# Platform Operations Freeze Receipt Workspace Merge

Status: P493 command specification.

`platform:operations-freeze-receipt-workspace-merge` consumes the P492 receipt
workspace in memory and declares deterministic merge rows for future human
receipt workspace inputs across the operations-freeze acceptance lanes.

The merge manifest does not read actor workspace files, materialize receipt
input files, materialize merged receipt input, receive receipt payloads,
validate receipts, complete signoff, apply approvals, read generated artifacts,
execute acceptance commands, run package commands, publish releases, run git
operations, execute protected recovery or protected actions, enable trading
live/full-auto modes, submit orders, perform broker or exchange writes, inspect
Desktop config content, read `.env` files, read secret values, perform
credential lookup, or promote Desktop as a source of truth.

## Command

```sh
npm run platform:operations-freeze-receipt-workspace-merge -- --check
```

## Merge Policy

Each merge row is `ready_for_future_receipt_merge`. This means the source P492
workspace row is ready for human input, but actor workspace input is absent and
no merged receipt payload is ready for validation.

## Human Review Note

The merge manifest is an operator preparation surface only. Later gated phases
must materialize, collect, merge, validate, and apply human receipts before any
operations-freeze readiness, protected recovery, release-facing, Desktop, or
trading-facing output can be claimed.
