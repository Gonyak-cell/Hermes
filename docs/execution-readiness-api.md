# Execution Readiness API

This contract implements the first read-only API surface from the Hermes
execution platform handoff package.

## Route

- `GET /api/execution/readiness`
- `HEAD /api/execution/readiness`
- `GET /api/execution/personal-dev-candidates`
- `HEAD /api/execution/personal-dev-candidates`

All other methods are rejected. The route never invokes runtimes, starts
sandboxes, runs commands, writes ledgers, applies receipts, or opens deployment
authority.

## Projection

The readiness model binds these sources:

- execution schema registry
- desktop read model
- Agent Bridge limited runtime plan
- Factory stage read model
- Factory G-series runtime guards
- personal-dev execution candidate lane

Missing or invalid sources are represented as blocker rows. They do not become
silent readiness.

L0 covers read-only observability. L1 covers read-only personal-dev candidate
projection. L2 and higher still remain blocked until isolated dry-run execution,
worktree mutation, patch packaging, PR handoff, deployment, and enterprise
authority are separately implemented and reviewed.

## Verification

```bash
npm run execution:readiness -- --check
npm run execution:personal-dev-candidates -- --check
node --test test/execution-readiness-api.test.mjs
```
