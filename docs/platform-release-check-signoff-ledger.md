# Platform Release-Check Signoff Ledger

Status: P367 command specification.

`platform:release-check-signoff-ledger` consumes the P366 release-check review
packet in memory and records the human signoff receipt required for each
P361-P364 release-check command.

The ledger does not complete signoff, apply approvals, materialize receipts,
read generated artifacts, execute release checks, run package commands, publish
releases, run git operations, execute protected actions, enable live trading,
submit orders, or perform broker or exchange writes.

## Command

```sh
npm run platform:release-check-signoff-ledger -- --check
```

## Signoff Policy

Each signoff row stays `ready_for_human_signoff` until an external human receipt
is collected and validated by a later gate. The ledger records:

- the source review packet row,
- the required reviewer role,
- the required human release-check signoff receipt type,
- the expected signoff decision,
- the no-execution and no-mutation boundary.

## Human Review Note

The signoff ledger is not a signoff. It is the release-facing map of signoffs
that operators must collect before treating the release-check chain as signed
off.
