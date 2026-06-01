# Platform Operations Freeze

Status: P500 claim-freeze command specification.

`platform:operations-freeze` is the top-level result-suspicion gate for the
P341-P500 stability program. It consumes the P500 closeout in memory and
recasts P341-P480 source rows as claim registry rows.

Every claim must be one of two states:

- `pass`: evidence, reviewer/gate linkage, safe boundary flags, and any required
  human receipt are present.
- `blocked`: `block_reason`, `responsible_owner`, `next_allowed_action`, and any
  required documented human gate are present.

This prevents a result from passing merely because it says `complete`, `ready`,
`done`, `approved`, or `governance complete`.

## Command

```sh
npm run platform:operations-freeze -- --check
```

## Human Review Note

This command does not execute acceptance commands, inspect generated artifacts,
collect human receipts, apply approvals, publish releases, run git operations,
execute protected recovery, inspect secrets, mutate Desktop state, or enable
trading. It only proves that claim outcomes are either PASS with evidence or
BLOCKED with an owner and next allowed action.
