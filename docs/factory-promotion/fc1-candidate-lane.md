# FC.1 Factory Candidate Lane

Status: ready after Law Firm OS-style Claude Opus 4.8 max review.
Date: 2026-06-11

## Scope

FC.1 adds the read-only factory candidate lane:

```bash
npm run factory:candidate-lane -- --check --require-pass
node scripts/review-api.mjs --once /api/factory/candidate-lane
```

The lane consumes the FB.5 workbench. For each fresh `PS2_receipt_bound`
product with a visible JSON candidate manifest, it produces a reviewable packet
instead of applying a patch.

## Candidate Packet

Each packet includes:

- `candidate_packet_id`, product id, candidate manifest id, and manifest hash
- planned isolated git-worktree path
- generated unified diff packet
- draft rollback plan
- executed deterministic preflight
- candidate packet SHA-256

The default tracked seed state remains ready with 0 candidate packets because
all tracked seed products are still `PS0_seed`. Operational PS2 fixtures produce
real packet rows for review.

## Hash Ledger

FC.1 records one chained hash ledger row per candidate packet. Each row binds:

- candidate packet hash
- candidate manifest hash
- diff packet hash
- rollback plan hash
- preflight hash
- previous ledger entry hash

This ledger is generated for review evidence only. FC.1 does not append it to
the persistent product state store.

## Boundary

FC.1 does not create products, create git worktrees, write files, append
ledgers, apply patches, merge branches, call connectors, deploy, or grant
production/enterprise trust.

These remain false:

- `source_file_write_allowed_now`
- `ledger_append_allowed_now`
- `repo_write_allowed_now`
- `connector_write_allowed_now`
- `deployment_allowed_now`
- `protected_action_allowed_now`
- `patch_apply_enabled`
- `apply_allowed_now`
- production PASS and enterprise PASS

## Review API

`GET /api/factory/candidate-lane` returns a `review-api-collection.v1` envelope
with `collection: "factory_candidate_packet_rows"`.

Supported filters:

- `candidate_packet_id`
- `candidate_packet_status`
- `product_id`
- `candidate_manifest_id`
- `worktree_lane_status`
- `diff_packet_status`
- `rollback_plan_status`
- `preflight_status`
- `limit`

Mutation methods return `405 method_not_allowed`.

## Negative Fixtures

The executable FC.1 negative fixtures cover:

- apply attempt blocked with `patch_apply_enabled: false`
- attempted path outside planned isolated worktree blocked
- protected path target blocked

## Review Receipt

FC.1 was reviewed with the Law Firm OS closeout pattern:

- model: `claude-opus-4-8`
- effort: `max`
- tools: `Read,Grep,Glob`
- permission mode: `dontAsk`
- prompt shape: compact repo-local review request plus JSON schema
- verdict: `PASS_WITH_FINDINGS`
- P0/P1/P2 blockers: 0
- P3 findings: fixed in this tranche
- invalid evidence rejected when auth-failed, empty, malformed, interrupted, or
  tool-call-shaped

Claude is independent review evidence only. It is not final approval and does
not open protected-action, production, or enterprise authority.

## Verification

```bash
node --check src/factory-candidate-lane.mjs
node --check scripts/factory-candidate-lane.mjs
node --check src/review-api.mjs
node --check scripts/review-api-smoke.mjs
node --test test/factory-stage-read-model.test.mjs test/factory-candidate-manifest-resolver.test.mjs test/factory-starter-artifact-corpus.test.mjs test/factory-workbench-read-model.test.mjs test/factory-candidate-lane.test.mjs
npm run factory:candidate-lane -- --check --require-pass
npm run api:smoke
npm run contracts:validate -- --check
git diff --check
```
