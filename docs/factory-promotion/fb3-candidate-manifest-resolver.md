# FB.3 Candidate Manifest Resolver

Status: ready with valid Law Firm OS-style Claude Opus 4.8 Max review completed and adjudicated.
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

FB.3 owns the JSON-only resolver capability and keeps the `.fb3` candidate
manifest id suffix. FB.4 owns the read-only starter artifact corpus
materialization that FB.3 references through `fb4_starter_artifact_corpus_*`
fields. The pairing is intentional: the resolver remains JSON-only and refuses
otherwise eligible candidate rows when required starter refs are missing.

`candidate_manifest_sha256` is a per-run snapshot hash because `generated_at` is
part of the hashed draft. This is acceptable for FB.3 previews because no
candidate apply, ledger append, source write, or downstream protected action is
opened. Before any downstream receipt uses the hash as a stable apply identity,
that downstream phase must explicitly decide whether to bind the snapshot hash
or introduce a separate content-stable identity hash.

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
npm run factory:claude-review-evidence -- --raw-review artifacts/factory-promotion/fb3-review-lawos-style-final/raw-output.json --prompt artifacts/factory-promotion/fb3-review-lawos-style-final/review-prompt.md --review-id fb3-opus-4-8-lawos-style-final --program-range FCORE-FB.3 --out-dir artifacts/factory-promotion/fb3-review-lawos-style-final/evidence-validation --check --require-valid
```

Current closeout path supersedes
`fb3-owner-claude-review-defer-receipt.json`. The owner later requested the
Claude review lane, and the final raw Opus 4.8 Max artifact validated as
`valid_review_evidence`. This counts as independent review evidence only; it
does not count as final approval, production PASS, enterprise PASS, or human
protected closeout adjudication.

## Review Closeout

Review receipt: `fb3-claude-opus-4-8-review-receipt.md`.

Evidence:

- reviewed tree commit SHA:
  `2f3be4e42f09148dc26fda44e2a82f150b1a14fe`
- implementation commit SHA for the FB.3 resolver/API/tests:
  `5dd51751c8e87185eea34122963ff385b4251a90`
- related starter corpus dependency commit SHA:
  `82f596d41a208070bb3f9f991563ffa1fe58b419`
- related Review API exposure commit SHA:
  `dbb670904d24819e5a7fa8f9e8ffbbf0969c90dc`
- raw artifact:
  `artifacts/factory-promotion/fb3-review-lawos-style-final/raw-output.json`
- normalized artifact receipt:
  `artifacts/factory-promotion/fb3-review-lawos-style-final/review-receipt.json`
- evidence validation artifact:
  `artifacts/factory-promotion/fb3-review-lawos-style-final/evidence-validation/claude-review-evidence-validation.json`
- prompt SHA-256:
  `87d4c24230ef497f0e1d785459ca93104548ba607e80e91e6f45a5af325e4f26`
- raw output SHA-256:
  `46abdb6c1bf8be736d7c44a831286faee97ab5d352196dc8087c33da382cbe93`

Review result:

- verdict: `APPROVE_WITH_FINDINGS`
- blocking findings: 0
- non-blocking findings: 4
- changes required before commit: false

Disposition:

- `FB3-NB-1` is fixed in the receipt trail by recording both the reviewed tree
  commit and the implementing FB.3/FB.4/API commits.
- `FB3-NB-2` is adjudicated and documented above: `.fb3` ids belong to the
  FB.3 resolver, while `fb4_*` fields record the required starter corpus
  dependency.
- `FB3-NB-3` is adjudicated and documented above: the current hash is a
  snapshot hash, not a stable apply identity hash.
- `FB3-NB-4` is fixed by adding direct regression coverage for the PS3 block
  reason and unmapped starter artifact ref branch.

Expected local result:

- candidate resolver targeted tests: 10/10 pass
- starter artifact corpus targeted tests: 8/8 pass
- Claude review evidence validator tests: 7/7 pass
- combined review-support test bundle: 25/25 pass
- default tracked seed projection: 9 resolver rows, 0 candidate manifests
- operational fresh PS2 fixture: 1 JSON-only candidate manifest
- missing starter template fixture: blocked, 0 candidate manifests
- stale PS2 fixture: blocked, 0 candidate manifests
- PS3+ fixture: fail closed
- invalid FB.3 429 raw review attempt: rejected as `invalid_not_review_evidence`
- Review API smoke: pass
- contracts validation: 214/214 pass
