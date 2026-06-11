# FA.6 Read-Only Factory Products API Freeze

Status: complete at owner-exception low trust with Opus Max read-only review evidence.
Date: 2026-06-11

## Scope

FA.6 exposes the factory product registry through the read-only Review API:

```bash
node scripts/review-api.mjs --once /api/factory/products
```

The route reads:

1. `data/factory/local/products.jsonl`
2. `data/factory/seed/products.jsonl`

If both sources are empty, the API fails closed with
`503 factory_products_unavailable`. It does not promote the legacy P9400
projection fallback into factory-store truth.

## Contract

`GET /api/factory/products` returns a `review-api-collection.v1` envelope with:

- `collection: "factory_products"`
- `source_tier: "operational_ledger"` or `"tracked_seed"`
- `read_only: true`
- `method_allowlist: ["GET", "HEAD"]`
- `mutation_allowed: false`
- `raw_confidential_material_visible: false`

Supported filters:

- `product_id`
- `product_state`
- `receipt_id`
- `source_tier`
- `seed_record_kind`
- `limit`

`HEAD /api/factory/products` is allowed and returns a bodyless response.
`POST`, `PUT`, `PATCH`, and `DELETE` return `405 method_not_allowed`.

## Freeze Boundary

FA.6 does not open:

- project creation
- repo writes
- connector writes
- deployment
- protected actions
- API mutation methods
- store mutation through the Review API
- production PASS
- enterprise PASS
- Codex, Claude, or Fable final approval authority

## Verification Plan

Commands to run before closeout:

```bash
node --check src/review-api.mjs
node --check scripts/review-api-smoke.mjs
node --test test/review-api-factory-products.test.mjs
npm run api:smoke
npm run factory:seed-migration -- --check --require-pass
npm run platform:factory-product-registry-store -- --check --require-pass
npm run contracts:validate -- --check
git diff --check
```

Claude Code review was completed with Opus Max in read-only/no-tools mode.

Counted review receipt:

- `docs/factory-promotion/fa6-claude-opus-max-review-receipt.md`
- verdict: `pass_with_notes`
- blocking findings: none
- changes required before FA.6 commit: none

## Handoff

FA.7 may prepare the FA freeze packet after this route, tests, documentation,
and Opus Max review receipt are committed.
