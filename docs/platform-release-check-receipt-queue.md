# Platform Release-Check Receipt Queue

Status: P372 command specification.

`platform:release-check-receipt-queue` consumes the P371 status ledger in memory
and produces a deterministic queue of human receipt collection items for the
release-check chain.

The queue does not receive receipts, validate receipts, complete signoff, apply
approvals, read generated artifacts, execute release checks, run package
commands, publish releases, run git operations, execute protected actions,
enable live trading, submit orders, or perform broker or exchange writes.

## Command

```sh
npm run platform:release-check-receipt-queue -- --check
```

## Queue Policy

Each queue row is `queued_for_human_receipt`. This means the corresponding
release-check item is ready for external human input, but it is not ready for
validation and has not received a receipt.

## Human Review Note

The receipt queue is a collection snapshot only. Later gated phases must collect,
validate, and apply receipts before any release signoff or release-facing output
can be claimed.
