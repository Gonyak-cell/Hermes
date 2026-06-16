# Execution Readiness API

This contract implements the first read-only API surface from the Hermes
execution platform handoff package.

## Route

- `GET /api/execution/readiness`
- `HEAD /api/execution/readiness`

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

Missing or invalid sources are represented as blocker rows. They do not become
silent readiness.

## Verification

```bash
npm run execution:readiness -- --check
node --test test/execution-readiness-api.test.mjs
```
