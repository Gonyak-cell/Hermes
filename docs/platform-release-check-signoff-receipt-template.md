# Platform Release-Check Signoff Receipt Template

Status: P368 command specification.

`platform:release-check-signoff-receipt-template` consumes the P367 signoff
ledger in memory and produces human-fillable receipt templates for each
release-check signoff requirement.

The command does not complete receipts, complete signoff, apply approvals,
materialize human receipts, read generated artifacts, execute release checks,
run package commands, publish releases, run git operations, execute protected
actions, enable live trading, submit orders, or perform broker or exchange
writes.

## Command

```sh
npm run platform:release-check-signoff-receipt-template -- --check
```

## Receipt Template Policy

Each template stays `ready_for_human_receipt` until a human fills it outside the
command. Required fields include reviewer identity, review time, source signoff
row, decision, evidence reference, and blocker note.

Allowed decisions are:

- `signoff_ready`
- `return_with_blocker`

## Human Review Note

Receipt templates are not receipts. Operators must collect and validate actual
human receipts before claiming release-check signoff.
