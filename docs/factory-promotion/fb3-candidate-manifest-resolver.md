# FB.3 Candidate Manifest Resolver

Status: ready with Claude review deferred by owner instruction.
Date: 2026-06-11

## Scope

FB.3 adds the JSON-only instantiation resolver:

```bash
npm run factory:candidate-manifests -- --check --require-pass
node scripts/review-api.mjs --once /api/factory/candidate-manifests
```

The resolver reads the FB.2 stage read model and returns one resolver row per
product. It generates a `factory-candidate-manifest.v1` JSON preview only when a
product is:

- `PS2_receipt_bound`
- fresh under the seven-day freshness policy
- free of PS3+ transitions

Default tracked seed state returns 9 resolver rows and 0 candidate manifests
because all tracked seed products are still `PS0_seed`.

## JSON-Only Boundary

FB.3 does not create starter artifact files, append ledgers, advance product
state, apply a candidate, create projects, write repositories, call connectors,
deploy, or grant final/production/enterprise approval.

These remain false:

- `source_file_write_allowed_now`
- `ledger_append_allowed_now`
- `ps3_transition_append_allowed_now`
- `candidate_manifest_write_allowed_now`
- `apply_allowed_now`
- all project/repo/connector/deploy/protected-action/production/enterprise
  authority flags

FB.4 now materializes the starter artifact corpus referenced by candidate
manifests. The resolver remains JSON-only and refuses otherwise eligible
candidate rows when required starter refs are missing.

## Review API

`GET /api/factory/candidate-manifests` returns a
`review-api-collection.v1` envelope with
`collection: "factory_candidate_manifest_rows"`.

Supported filters:

- `product_id`
- `current_product_state`
- `stage_gate_status`
- `freshness_status`
- `resolver_status`
- `candidate_manifest_id`
- `candidate_manifest_status`
- `candidate_manifest_kind`
- `candidate_manifest_json_available`
- `limit`

Mutation methods return `405 method_not_allowed`.

## Verification

Commands to run before Opus Max review:

```bash
node --check src/claude-review-evidence-validator.mjs
node --check scripts/claude-review-evidence-validator.mjs
node --check src/factory-candidate-manifest-resolver.mjs
node --check scripts/factory-candidate-manifest-resolver.mjs
node --check src/factory-starter-artifact-corpus.mjs
node --check scripts/factory-starter-artifact-corpus.mjs
node --check src/factory-stage-read-model.mjs
node --check src/review-api.mjs
node --check scripts/review-api-smoke.mjs
node --test test/claude-review-evidence-validator.test.mjs test/factory-candidate-manifest-resolver.test.mjs test/factory-starter-artifact-corpus.test.mjs
npm run factory:starter-artifacts -- --check --require-pass
npm run factory:candidate-manifests -- --check --require-pass
npm run api:smoke
npm run contracts:validate -- --check
git diff --check
```

Command to run after the final Opus Max raw artifact is captured:

```bash
npm run factory:claude-review-evidence -- --raw-review artifacts/factory-promotion/fb3-review/claude-opus-max-final.raw.json --prompt artifacts/factory-promotion/fb3-review/claude-opus-max-final.prompt.md --review-id fb3-opus-max-final --program-range FCORE-FB.3 --out-dir artifacts/factory-promotion/fb3-review/final-validation --check --require-valid
```

Current closeout path uses
`fb3-owner-claude-review-defer-receipt.json`: the human owner instructed Codex to
defer Claude review until explicitly requested again. This does not count as an
independent review, production PASS, enterprise PASS, or final approval.

Expected local result:

- candidate resolver targeted tests: 8/8 pass
- starter artifact corpus targeted tests: 5/5 pass
- Claude review evidence validator tests: 6/6 pass
- default tracked seed projection: 9 resolver rows, 0 candidate manifests
- operational fresh PS2 fixture: 1 JSON-only candidate manifest
- missing starter template fixture: blocked, 0 candidate manifests
- stale PS2 fixture: blocked, 0 candidate manifests
- PS3+ fixture: fail closed
- invalid FB.3 429 raw review attempt: rejected as `invalid_not_review_evidence`
- Review API smoke: pass
- contracts validation: 214/214 pass
