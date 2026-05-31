# Platform Release-Check Signoff Receipt Intake

Status: P369 command specification.

`platform:release-check-signoff-receipt-intake` consumes the P368 receipt
templates in memory and creates receipt-intake rows that wait for external
human input.

The command does not receive receipts, validate receipts, mark rows ready for
validation, complete signoff, apply approvals, materialize receipts, read
generated artifacts, execute release checks, run package commands, publish
releases, run git operations, execute protected actions, enable live trading,
submit orders, or perform broker or exchange writes.

## Command

```sh
npm run platform:release-check-signoff-receipt-intake -- --check
```

## Intake Policy

Each row stays `awaiting_human_receipt` and `ready_for_human_input`. Later
receipt validation phases may consume completed human input, but this command
only records the intake queue and the no-execution boundary.

## Human Review Note

Receipt intake rows are not validated receipts. Operators must collect and
validate actual human receipts before claiming signoff readiness.
