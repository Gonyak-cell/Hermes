# FB.1 Factory Stage Read Model

Status: ready with valid Opus Max read-only review.
Date: 2026-06-11

## Scope

FB.1 adds the first product-specific PS state read model:

```bash
npm run factory:stage -- --check --require-pass
```

It also exposes the Review API route:

```bash
node scripts/review-api.mjs --once /api/factory/stage
```

## Contract

The read model resolves products from:

1. `data/factory/local/products.jsonl`
2. `data/factory/seed/products.jsonl`

It reads state-transition ledgers and computes `current_product_state` from the
latest transition per product.

Default tracked seed state:

- product count: 9
- product source tier: `tracked_seed`
- transition count: 0
- all products: `PS0_seed`

## Negative Fixture

PS3 or later transition rows block the stage read model before FB promotion.
This keeps FB.1 as a read-only status projection and prevents the stage surface
from becoming a candidate/apply lane.

## Review API

`GET /api/factory/stage` returns a `review-api-collection.v1` envelope with
`collection: "factory_stage_rows"`.
The envelope keeps `mutation_allowed: false` and
`raw_confidential_material_visible: false`.

Supported filters:

- `product_id`
- `current_product_state`
- `base_product_state`
- `product_source_tier`
- `limit`

Mutation methods return `405 method_not_allowed`.

## Boundary

FB.1 does not open:

- PS3 transition append
- candidate manifest writes
- apply behavior
- project creation
- repo writes
- connector writes
- deployment
- protected actions
- production PASS
- enterprise PASS
- final approval authority

## Verification

Commands run before Opus Max review:

```bash
node --check src/factory-stage-read-model.mjs
node --check scripts/factory-stage-read-model.mjs
node --check src/review-api.mjs
node --test test/factory-stage-read-model.test.mjs
npm run factory:stage -- --check --require-pass
npm run api:smoke
npm run contracts:validate -- --check
git diff --check
```

Observed local result:

- factory stage targeted tests: 9/9 pass
- factory stage command: ready, 9 products, source `tracked_seed`, 0 transitions, 0 errors
- Review API smoke: pass
- contracts validation: 214/214 pass
- Opus Max review packet: `fb1-claude-review-packet.md`
- Opus Max final review receipt: `fb1-claude-opus-max-review-receipt.md`
- Opus Max final verdict: `approve_no_blocking_findings`

## Handoff

FB.2 may extend this surface into a `/api/factory/stage` candidate-oriented
control view only after Opus Max review has no blocking findings. Apply and
candidate writes must remain closed.
