# Platform Release-Check Review Packet

Status: P366 command specification.

`platform:release-check-review-packet` consumes the P365 release-check evidence
index in memory and turns each P361-P364 release-check evidence row into a
human-reviewable operator packet row with a reviewer role and expected decision.

The packet does not complete reviews, apply approvals, read generated
artifacts, execute release checks, run package commands, publish releases, run
git operations, execute protected actions, enable live trading, submit orders,
or perform broker or exchange writes.

## Command

```sh
npm run platform:release-check-review-packet -- --check
```

## Review Policy

- `trading:release-check` rows are assigned to a trading safety reviewer.
- `platform:ops-check` rows are assigned to a platform operator.
- `platform:release-check` rows are assigned to a release manager.
- `platform:release-check-no-write-audit` rows are assigned to a QA reviewer.

Each row expects the reviewer to accept the ready evidence or return it with a
blocker. The command only records the review packet; it does not mark review
complete or apply approval.

## Human Review Note

The review packet is release-facing operational evidence. An operator must
review the packet and the latest command outputs before relying on it as a
release-readiness signoff.
