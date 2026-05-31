# Platform Release-Check Receipt Workspace

Status: P374 command specification.

`platform:release-check-receipt-workspace` consumes the P373 receipt validation
rules in memory and declares deterministic workspace rows for future human
receipt input.

The workspace does not materialize receipt input files, receive receipt payloads,
validate receipts, complete signoff, apply approvals, read generated artifacts,
execute release checks, run package commands, publish releases, run git
operations, execute protected actions, enable live trading, submit orders, or
perform broker or exchange writes.

## Command

```sh
npm run platform:release-check-receipt-workspace -- --check
```

## Workspace Policy

Each workspace row is `ready_for_human_receipt_input`. This means the editable
receipt fields are declared for the reviewer role, but no receipt file has been
materialized and no payload is ready for validation.

## Human Review Note

The workspace is an operator preparation surface only. Later gated phases must
materialize, collect, merge, validate, and apply human receipts before any
release signoff or release-facing output can be claimed.
