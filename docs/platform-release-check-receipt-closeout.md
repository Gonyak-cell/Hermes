# Platform Release-Check Receipt Closeout

Status: P380 command specification.

`platform:release-check-receipt-closeout` consumes the P379 receipt approval
closeout in memory and closes the P361-P380 release-check receipt readiness
chain before P381 trading safety regression fixtures.

The receipt closeout does not read actor workspace files, materialize merged
receipt input, receive receipt payloads, validate receipts, complete signoff,
apply approvals, read generated artifacts, execute release checks, run package
commands, publish releases, run git operations, execute protected actions,
enable live trading, submit orders, or perform broker or exchange writes.

## Command

```sh
npm run platform:release-check-receipt-closeout -- --check
```

## Receipt Closeout Policy

Each closeout row is `ready_for_release_check_receipt_chain_closeout`. This
means the source P379 approval closeout is ready, P361-P380 receipt readiness is
closed, and human receipt collection, validation, signoff, and approval
application remain pending.

## Human Review Note

The receipt closeout is an operator preparation surface only. Later gated
phases must collect, validate, approve, and sign off human receipts before any
release-facing output can be claimed; P381 starts safety regression checks, not
receipt application.
