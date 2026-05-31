# Platform Release Check

Status: P363 command specification.

`platform:release-check` is the top-level release-readiness bridge for the
P361-P380 stability tranche. It composes the platform ops check, Trading release
check, repository validation chain, repository tests, contract validation, and
release freeze validation so operators do not rely on remembered command order.

The command intentionally does not belong to `npm run validate`, because it
runs `npm run validate` as one of its child commands. The source rows fail if
the validation chain would recursively call `platform:release-check`.

## Command

```sh
npm run platform:release-check -- --check
```

## Child Commands

- `npm run platform:ops-check -- --check`
- `npm run trading:release-check -- --check`
- `npm run validate`
- `npm test`
- `npm run contracts:validate -- --check`
- `npm run release:freeze -- --check`

## Boundary

`platform:release-check` executes package commands, but it records that the
release check itself does not install dependencies, mutate packages or
lockfiles, regenerate artifacts outside guarded child checks, publish releases,
run git operations, execute protected actions, enable live trading, enable
full-auto, submit orders, or perform broker or exchange writes.

## Human Review Note

The release-check report is release-facing and trading-facing operational
evidence. An operator must review the summary before relying on it as a platform
release-readiness claim.
