# Platform Ops Check

Status: P362 command specification.

`platform:ops-check` is the platform-side check bridge for the P361-P380
stability tranche. It verifies runtime baseline health, contract validation,
domain-pack registry health, control-plane loop runner readiness, and
dashboard/API smoke readiness without rebuilding dashboard artifacts or running
the full control-plane loop.

The command runs deterministic validators in memory and uses a one-step
control-plane loop probe that creates no artifacts. It records that it does not
execute package commands, install dependencies, mutate packages or lockfiles,
write dashboard/API state, publish releases, run git operations, execute
protected actions, enable live trading, enable full-auto, submit orders, or
perform broker writes.

## Command

```sh
npm run platform:ops-check -- --check
```

## Readiness Surfaces

- `platform:runtime-baseline` in-memory validation.
- `contracts:golden-fixtures` in-memory validation.
- `contracts:validate` in-memory validation.
- `packs:validate` in-memory domain-pack registry validation.
- `control-plane:loop` source and runner probe readiness.
- `dashboard:build` and `api:smoke` source/route-index readiness.

## Human Review Note

The ops-check report is release-facing operational evidence. An operator must
review the summary before using it as a platform release-readiness claim.
