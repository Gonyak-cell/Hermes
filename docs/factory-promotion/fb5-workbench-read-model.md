# FB.5 Factory Workbench Read Model

Status: ready after Law Firm OS-style Claude Opus 4.8 max review.
Date: 2026-06-11

## Scope

FB.5 adds the read-only factory workbench v0 projection:

```bash
npm run factory:workbench -- --check --require-pass
node scripts/review-api.mjs --once /api/factory/workbench
```

The workbench composes FB.2 stage rows, FB.3 candidate manifest resolver rows,
and FB.4 starter artifact readiness into one operator-facing row per product.

## Workbench Row

Each row exposes:

- product id, tenant id, workspace id, display name, and domain packs
- current PS state, stage gate status, freshness status, and latest receipt refs
- resolver status and workbench view status
- candidate manifest id, hash, JSON preview, and visibility flag when available
- starter artifact materialized/missing ref counts
- blocker ids and next operator actions
- allowed view-only affordances
- forbidden write/apply/deploy/trust affordances

Default tracked seed state returns 9 stage-only rows and 0 candidate previews.
A fresh operational PS2 fixture returns 1 candidate preview without opening
write authority.

## Boundary

FB.5 is still read-only. It does not create products, append ledgers, advance
PS3, write candidate manifests, apply candidates, merge branches, call
connectors, deploy, or grant production/enterprise trust.

These remain false:

- `source_file_write_allowed_now`
- `ledger_append_allowed_now`
- `ps3_transition_append_allowed_now`
- `candidate_manifest_write_allowed_now`
- `apply_allowed_now`
- all project/repo/connector/deploy/protected-action/production/enterprise
  authority flags

## Review API

`GET /api/factory/workbench` returns a `review-api-collection.v1` envelope with
`collection: "factory_workbench_rows"`.

Supported filters:

- `product_id`
- `current_product_state`
- `stage_gate_status`
- `freshness_status`
- `resolver_status`
- `workbench_view_status`
- `workbench_queue_status`
- `candidate_manifest_json_available`
- `starter_artifact_corpus_status`
- `limit`

Mutation methods return `405 method_not_allowed`.

## Negative Fixtures

The executable missing-template fixture runs the workbench through a blocked
candidate resolver and must fail closed with 0 candidate previews.

Mutation methods on `/api/factory/workbench` return `405 method_not_allowed`.

## Review Receipt

FB.5 was reviewed with the Law Firm OS closeout pattern:

- model: `claude-opus-4-8`
- effort: `max`
- tools: `Read,Grep,Glob`
- permission mode: `dontAsk`
- prompt shape: compact repo-local review request plus JSON schema
- verdict: `PASS_WITH_FINDINGS`
- P0/P1/P2 blockers: 0
- P3 findings: fixed in this tranche

## Verification

```bash
node --check src/factory-workbench-read-model.mjs
node --check scripts/factory-workbench-read-model.mjs
node --check src/review-api.mjs
node --check scripts/review-api-smoke.mjs
node --test test/factory-stage-read-model.test.mjs test/factory-candidate-manifest-resolver.test.mjs test/factory-starter-artifact-corpus.test.mjs test/factory-workbench-read-model.test.mjs
npm run factory:workbench -- --check --require-pass
npm run api:smoke
npm run contracts:validate -- --check
git diff --check
```

Expected local result:

- FB.1-FB.5 targeted tests: 33/33 pass
- workbench command: 9 products, 9 rows, 0 candidate previews, 0 validation errors
- Review API smoke: pass
- contracts validation: 214/214 pass
