# Platform Release-Check Signoff Closeout

Status: P370 command specification.

`platform:release-check-signoff-closeout` consumes the P369 receipt-intake queue
in memory and marks the release-check signoff subchain ready for external human
receipt collection.

The closeout does not receive receipts, validate receipts, complete signoff,
apply approvals, read generated artifacts, execute release checks, run package
commands, publish releases, run git operations, execute protected actions,
enable live trading, submit orders, or perform broker or exchange writes.

## Command

```sh
npm run platform:release-check-signoff-closeout -- --check
```

## Closeout Policy

Each closeout row is `ready_for_human_receipt_collection`. This is not a
release signoff. It means the release-check evidence, review packet, signoff
ledger, receipt template, and receipt intake queue are aligned and awaiting
external human receipts.

## Human Review Note

The signoff closeout is a readiness map only. Operators must collect, validate,
and apply human receipts in later gated phases before claiming signoff.
