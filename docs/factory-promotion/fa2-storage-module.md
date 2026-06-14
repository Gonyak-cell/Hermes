# FA.2 Storage Module

Status: complete at owner-exception low trust.
Date: 2026-06-11

## Scope

FA.2 extends `platform:factory-product-registry-store` from schema readiness to
an executable local storage module:

- append-only JSONL ledgers under `data/factory/local/`
- `products.jsonl`, `state-transitions.jsonl`, and `receipts-index.jsonl`
- canonical `payload_sha256`, `prev_entry_hash`, and `entry_hash`
- product-scoped reads requiring explicit `product_id`
- local recovery by truncating a damaged ledger to the last valid prefix

This phase does not implement receipt-driven PS transitions. FA.3 owns
`PS0 -> PS1 -> PS2` transition handlers and receipt replay protection.

## Changed Contracts

| Contract | File | Change |
|---|---|---|
| `factory-product-registry-store.v1` | `schemas/factory-product-registry-store.schema.json` | FA.2 status, append ledger summary, product row chain fields |
| `factory-receipt-envelope.v1` | `schemas/factory-receipt-envelope.schema.json` | optional `entry_hash` for JSONL storage rows |
| state-store manual | `docs/factory-state-store.md` | JSONL file list, hash-chain rule, recovery, scoped reads |

## Verification

Commands run:

```bash
node --check src/factory-product-registry-store.mjs
node --check test/factory-product-registry-store.test.mjs
node --test test/factory-product-registry-store.test.mjs
npm run platform:factory-product-registry-store -- --check --require-pass
```

Observed result:

- `platform:factory-product-registry-store`: `ready_factory_product_registry_store_append_ledger`
- FA.2 targeted tests: 12/12 pass
- default ledger entries: 0
- validation errors: 0

Broad regression note:

- `npm test` was attempted and then stopped after known non-FA.2 failures had
  already appeared and the suite continued into long-running platform tests.
- Re-run failures were isolated to `test/check-no-write-policy.test.mjs`,
  `test/check-mode-guard-normalization.test.mjs`,
  `test/check-mode-scanner-robustness.test.mjs`, and the resource expansion
  subtest in `test/matter-harness.test.mjs`.
- `src/factory-product-registry-store.mjs` did not appear in the check-no-write
  offender list.

## Executable Negative Fixtures

The FA.2 test suite executes and observes these blocked paths:

- schema-invalid append -> reject
- stale `payload_sha256` append -> reject
- append after row rewrite -> reject
- damaged chain -> detect
- damaged chain recovery -> truncate to valid prefix, then append succeeds
- concurrent appends -> serialized chain
- missing `product_id` scoped read -> reject
- cross-product scoped read -> reject
- `--check` ledger write attempt -> reject

## Authority Boundary

FA.2 enables only local operational ledger append under `data/factory/local/`.
It keeps these false:

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

FA.3 may add receipt-driven state transition handlers for PS0-PS2 only.
PS3+ transitions, apply behavior, connector writes, deployment, and protected
actions remain structurally closed.
