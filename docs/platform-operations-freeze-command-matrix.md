# Platform Operations Freeze Command Matrix

Status: P482 command specification.

`platform:operations-freeze-command-matrix` consumes the P481 source inventory
in memory and records the seven explicit platform-operations freeze acceptance
commands:

- `npm run platform:release-check -- --check`
- `npm run trading:release-check -- --check`
- `npm run validate`
- `npm test`
- `npm run contracts:validate -- --check`
- `npm run release:freeze -- --check`
- `npm run control-plane:loop`

The command matrix verifies that each command has a package script, is declared
in the P481-P500 ledger acceptance text, and has an explicit check-mode policy.
`npm run validate`, `npm test`, and `npm run control-plane:loop` are documented
non-`--check` commands because they are aggregate/test/loop commands rather than
write-capable generators.

## Command

```sh
npm run platform:operations-freeze-command-matrix -- --check
```

## Command Matrix Policy

Rows are `ready` only when the P481 source inventory is ready, the command
script exists, the ledger acceptance text names the command, and the command's
check-mode policy is satisfied.

The command matrix does not execute any acceptance command. It is a deterministic
operator checklist for later freeze phases and for human review.

## Human Review Note

This artifact proves the freeze command surface is registered and reviewable. It
does not replace actually running the acceptance commands before a release or
human freeze signoff.
