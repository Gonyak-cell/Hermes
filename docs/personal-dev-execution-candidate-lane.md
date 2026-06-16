# Personal-Dev Execution Candidate Lane

This contract implements PR04 of the execution platform transition: a read-only
candidate lane for the `personal-dev` domain pack.

## Sources

- execution schema registry
- personal-dev dashboard/API projection

The lane binds the six personal-dev panel sections (`repo`, `worktree`, `plan`,
`diff`, `test`, `pr`) to the execution handoff schemas. It emits candidate rows
and schema binding rows only.

## Boundary

The lane does not create `ExecutionRequest`, `CommandInvocation`, or
`ExecutionReceipt` artifacts. It does not run commands, write files, apply
patches, call GitHub, create PRs, merge, release, deploy, or open production or
enterprise trust.

## Route

- `GET /api/execution/personal-dev-candidates`
- `HEAD /api/execution/personal-dev-candidates`

All other methods are rejected.

## Verification

```bash
npm run execution:personal-dev-candidates -- --check
node --test test/personal-dev-execution-candidate-lane.test.mjs
```
