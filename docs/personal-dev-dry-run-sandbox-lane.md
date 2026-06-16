# Personal-Dev Dry-Run Sandbox Lane

This PR05 lane moves Hermes execution readiness from L1 candidate projection to
L2 dry-run sandbox projection for the `personal-dev` domain pack.

It consumes:

- `personal-dev` execution candidate rows
- Agent Bridge limited runtime plan rows
- runtime-invoker dry-run ledger semantics

It emits:

- `personal_dev_dry_run_sandbox_rows`
- `personal_dev_dry_run_invocation_rows`
- `personal_dev_dry_run_route_rows`
- `personal_dev_dry_run_boundary`

The route is read-only:

- `GET /api/execution/personal-dev-dry-runs`
- `HEAD /api/execution/personal-dev-dry-runs`

## Boundary

This lane only prints intended commands and projects sandbox/invocation shapes.
It does not create worktrees, execute commands, call runtimes, capture command
output, write files, apply patches, create pull requests, merge, release,
deploy, expose secrets, or grant production/enterprise trust.

`actual_isolation` remains `not_created` because no physical worktree exists at
L2. The requested isolation is still `git_worktree` so later L3+ implementation
must preserve that boundary before any scoped mutation can be considered.

## Verification

```bash
npm run execution:personal-dev-dry-runs -- --check
node --test test/personal-dev-dry-run-sandbox-lane.test.mjs
npm run execution:readiness -- --check
```
