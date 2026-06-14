# FA.5 Projection Redirection

Status: complete at owner-exception low trust.
Date: 2026-06-11

## Scope

FA.5 redirects `src/multi-project-saas-control-plane.mjs` to resolve its SaaS
project registry from the factory product store before falling back to the
legacy projection fixture.

Read order:

1. `data/factory/local/products.jsonl`
2. `data/factory/seed/products.jsonl`
3. existing P9400 source projection fallback

The default repository state uses the tracked FA.4 seed and selects the 5
`fixture_portfolio` rows that match the P9400 project IDs.

## Visible Fallback Contract

The projection now exposes:

- `factory_product_projection_source`
- `summary.factory_product_source_tier`
- `summary.factory_product_source_fallback_used`
- `summary.factory_product_selected_count`
- per-row `factory_product_source_tier`
- per-row `factory_product_source_fallback_used`

Fallback is allowed only as a visible read-only projection state. It does not
open project creation, repo writes, connector writes, runtime execution,
production PASS, enterprise PASS, or final approval.

## Verification

Commands run:

```bash
npm run platform:multi-project-saas-control-plane -- --check
npm run platform:product-domain-saas-factory -- --check
npm run platform:product-build-verification-loop -- --check
npm run platform:saas-factory-mode -- --check
npm run platform:connector-external-app-governance -- --check
npm run platform:execution-write-authority-maturity -- --check
node --test test/multi-project-saas-control-plane.test.mjs
```

Observed result:

- `multi-project-saas-control-plane`: ready, source tier `tracked_seed`, 5
  selected products, 0 validation errors
- `product-domain-saas-factory`: ready, status unchanged
- `product-build-verification-loop`: ready, status unchanged
- `saas-factory-mode`: blocked with visible source/FCORE waiver state, 0
  validation errors, status unchanged
- `connector-external-app-governance`: blocked pending source/review receipt, 0
  validation errors, status unchanged
- `execution-write-authority-maturity`: blocked pending source/review receipt, 0
  validation errors, status unchanged
- targeted multi-project tests: 15/15 pass

## Handoff

FA.6 may add a read-only `/api/factory/products` route. It must keep POST and
other mutating methods blocked and must continue to expose whether a response is
coming from the operational ledger, tracked seed, or fallback projection.
