# FA.4 Seed Migration

Status: complete at owner-exception low trust.
Date: 2026-06-11

## Scope

FA.4 migrates the first reviewable factory seed baseline into
`data/factory/seed/`:

- 4 control-plan products from `src/product-domain-saas-factory.mjs`
- 5 fixture portfolio products from `src/work-os-live-control-surface.mjs`
- 1 migration receipt in `receipts-index.jsonl`

The original `const` arrays remain fallback fixtures. FA.4 does not redirect a
projection; FA.5 owns that.

## Seed Files

| File | Rows | Purpose |
|---|---:|---|
| `data/factory/seed/products.jsonl` | 9 | redacted seed product records |
| `data/factory/seed/receipts-index.jsonl` | 1 | FA.4 migration receipt |
| `data/factory/seed/state-transitions.jsonl` | 0 | intentionally empty in FA.4 |

All rows are hash-chain validated with the same canonical ledger hash rules used
by the local operational ledger.

## Verification

Commands run:

```bash
npm run factory:seed-migration -- --check --require-pass
npm run platform:factory-product-registry-store -- --check --require-pass
```

Observed result:

- `factory:seed-migration`: `ready_factory_seed_migration`
- `platform:factory-product-registry-store`: `ready_factory_seed_migration`
- seed products: 9
- migration receipts: 1
- validation errors: 0

## Authority Boundary

FA.4 writes only tracked redacted seed fixtures through the explicit migration
command. It keeps these false:

- `project_creation_allowed_now`
- `repo_write_allowed_now`
- `connector_write_allowed_now`
- `deployment_allowed_now`
- `protected_action_allowed_now`
- `production_pass_enabled`
- `enterprise_pass_enabled`

The active no-Opus exception remains `owner_exception_low_trust`; independent
review receipts are still deferred before production or enterprise trust.

## Handoff

FA.5 may redirect one projection to prefer operational ledger data, then tracked
seed data, then the existing const fallback. The fallback must remain visible in
the projection summary.
