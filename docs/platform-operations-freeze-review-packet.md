# Platform Operations Freeze Review Packet

Status: P484 review-packet specification.

`platform:operations-freeze-review-packet` consumes the P483 operations freeze
evidence index in memory and turns each freeze acceptance evidence row into a
human-reviewable operator packet row with a reviewer role and expected decision.

The packet does not complete reviews, apply approvals, read generated
artifacts, execute acceptance commands, run package commands, publish releases,
run git operations, execute protected actions, enable live trading, submit
orders, inspect Desktop configuration, or expose secrets.

## Command

```sh
npm run platform:operations-freeze-review-packet -- --check
```

## Review Policy

- Platform release-check and release-freeze rows are assigned to a release manager.
- Trading release-check rows are assigned to a trading safety reviewer.
- `npm run validate` rows are assigned to a platform operator.
- `npm test` rows are assigned to a QA reviewer.
- Contract validation rows are assigned to a contract steward.
- Control-plane loop rows are assigned to a control-plane operator.

Each row expects the reviewer to accept the ready evidence or return it with a
blocker. The command only records the review packet; it does not mark review
complete or apply approval.

## Human Review Note

The review packet is operations-freeze evidence. An operator must review the
packet and the latest acceptance-command outputs before relying on it as a
freeze-readiness signoff.
