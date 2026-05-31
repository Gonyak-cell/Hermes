# Platform Release-Check Evidence Index

Status: P365 command specification.

`platform:release-check-evidence-index` records the operator-facing evidence
map for the P361-P364 release-check bridge commands. It indexes the command,
documentation, expected report path, validation-chain policy, and human-review
status for:

- `trading:release-check`
- `platform:ops-check`
- `platform:release-check`
- `platform:release-check-no-write-audit`

The index does not execute release checks, rebuild artifacts, publish releases,
run git operations, execute protected actions, enable live trading, submit
orders, or perform broker or exchange writes.

## Command

```sh
npm run platform:release-check-evidence-index -- --check
```

## Evidence Policy

- `trading:release-check`, `platform:ops-check`, and
  `platform:release-check-no-write-audit` must remain in `npm run validate`.
- `platform:release-check` must remain outside `npm run validate`, because it
  calls `npm run validate` as a child command.
- Every evidence row is human-review required before being treated as
  release-facing proof.

## Human Review Note

The evidence index is release-facing operational evidence. An operator must
review the index before relying on it as a release-readiness map.
