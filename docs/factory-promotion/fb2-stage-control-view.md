# FB.2 Factory Stage Control View

Status: ready for hardened Opus Max review.
Date: 2026-06-11

## Scope

FB.2 keeps the FB.1 command and route:

```bash
npm run factory:stage -- --check --require-pass
node scripts/review-api.mjs --once /api/factory/stage
```

It extends the product PS state read model into a read-only control view for the
future factory workbench. The route still returns `factory_stage_rows`; each row
now includes:

- `stage_progress`
- `gate_status`
- `blocker_ids` and `blocker_count`
- `next_operator_actions`
- `freshness_status`, `source_age_days`, and `stale_badge_required`
- `candidate_manifest_preview_status`
- `candidate_manifest_queue_depth`
- `workbench_queue_depth`

## Freshness Policy

FB.2 applies a seven-day source freshness window. The row source timestamp is
the latest valid product or transition timestamp for that product.

When the source is stale:

- `freshness_status` is `stale`
- `stale_badge_required` is `true`
- `freshness_blocks_new_adjudication` is `true`
- `gate_status` is `blocked_stale_source`
- `next_operator_actions` tells the operator to refresh sources before new
  adjudication

Freshness visibility does not grant owner, Codex, Claude, production, or
enterprise approval authority.

## Candidate Boundary

FB.2 does not instantiate candidate manifests. It only makes the candidate lane
visible as a blocked future affordance.

These remain closed:

- `candidate_manifest_preview_available: false`
- `candidate_manifest_queue_depth: 0`
- `workbench_queue_depth: 0`
- `candidate_manifest_write_allowed_now: false`
- `apply_allowed_now: false`
- `ps3_transition_append_allowed_now: false`
- all project/repo/connector/deploy/protected-action/production/enterprise
  authority flags

FB.3 is still required before any candidate manifest preview can become
available.

## Review API

`GET /api/factory/stage` remains read-only and supports the FB.2 filters:

- `product_id`
- `current_product_state`
- `base_product_state`
- `product_source_tier`
- `gate_status`
- `freshness_status`
- `stale_badge_required`
- `candidate_manifest_preview_status`
- `limit`

Mutation methods return `405 method_not_allowed`.

## Verification

Commands to run before Opus Max review:

```bash
node --check src/factory-stage-read-model.mjs
node --check scripts/factory-stage-read-model.mjs
node --check src/review-api.mjs
node --check scripts/review-api-smoke.mjs
node --test test/factory-stage-read-model.test.mjs
npm run factory:stage -- --check --require-pass
npm run api:smoke
npm run contracts:validate -- --check
git diff --check
```

Expected local result:

- factory stage targeted tests: 11/11 pass
- default tracked seed projection: 9 products, source `tracked_seed`, 0
  transitions, all `PS0_seed`
- default freshness: 9 fresh rows and 0 stale badges
- candidate manifest preview available count: 0
- candidate/workbench queue depths: 0
- Review API smoke: pass
- contracts validation: 214/214 pass
- Opus Max review packet: `fb2-claude-review-packet.md`
- Opus Max final review receipt: `fb2-claude-opus-max-review-receipt.md`
- Opus Max final verdict: `approve_no_blocking_findings`
