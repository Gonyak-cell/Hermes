# Store Policy Adapter

Phase 126 adds the store-level policy adapter used before a real database RLS implementation exists.

The adapter is intentionally deterministic. It consumes the Access Audit Projection and Data Classification Rule Engine, then compiles each access audit row into a store query plan. A plan is executable only when the source audit row is `view_allowed` and `can_retrieve = true`. Review and denied rows remain non-executable even if they contain complete filters.

## Required filters

Every compiled query plan must carry:

- `tenant_id`
- `matter_id`
- `classification`
- `policy_snapshot_id`
- `access_audit_record_id`

Resource plans must also carry `resource_id`.

The important design point is that matter and classification filters are not prompt instructions. They are query-layer requirements. A request missing those filters is blocked before retrieval.

## Negative probes

Each query plan emits enforcement probes for:

- baseline required filters
- missing matter filter
- missing classification filter
- missing policy snapshot filter
- cross-matter filter
- unfiltered query

All dangerous probes must be blocked. This lets the control plane verify the intended RLS behavior before PostgreSQL Row Level Security or another store backend is introduced.

## Outputs

`npm run contracts:store-policy` writes:

- `store-policy-adapter.json`
- `store-policy-rules.json`
- `rls-filter-templates.json`
- `query-policy-bindings.json`
- `store-query-plans.json`
- `enforcement-probes.json`
- `validation-report.json`
- `summary.md`
