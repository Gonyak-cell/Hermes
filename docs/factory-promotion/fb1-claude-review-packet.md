# FB.1 Claude Opus Max Review Packet

Status: ready for read-only independent review.
Date: 2026-06-11
Requested reviewer lane: Claude Code Opus Max.

## Review Command Contract

The Codex lane must request this review with:

```bash
claude --model opus --effort max --tools "" --no-session-persistence --output-format json -p "$REVIEW_PROMPT" \
  | tee artifacts/factory-promotion/fb1-review/claude-opus-max-review.raw.json
```

Before launch, check for stale Claude review processes. During long quiet
periods, inspect process liveness and raw artifact growth before retrying.

## Invalid Review Outputs

Do not count the review as evidence when any of these are true:

- the raw artifact is missing
- the output contains `Not logged in` or asks to run `/login`
- the output is malformed JSON
- the output is only a tool-call shaped payload without a review verdict
- the process is interrupted or has no final verdict
- the review used source-mutating tools
- a later follow-up review supersedes the artifact

Only the final valid raw Opus Max artifact may be referenced as FB.1 review
evidence.

## Scope To Review

FB.1 adds the deterministic factory product PS-stage read model:

- `src/factory-stage-read-model.mjs`
- `scripts/factory-stage-read-model.mjs`
- `test/factory-stage-read-model.test.mjs`
- `package.json`
- `src/review-api.mjs`
- `scripts/review-api-smoke.mjs`
- `docs/review-api.md`
- `docs/factory-state-store.md`
- `docs/factory-promotion/fb1-stage-read-model.md`
- `docs/factory-promotion/99-structured-summary.json`

## Intended Behavior

- `npm run factory:stage -- --check --require-pass` reads factory products from
  `data/factory/local/products.jsonl` first, then tracked seed products.
- The default tracked seed projection returns 9 products, all at `PS0_seed`.
- State transitions from seed/local ledgers compute `current_product_state`.
- PS3 or later transition rows block the read model before FB promotion.
- The Review API exposes `/api/factory/stage` as a read-only collection.
- `POST`, `PUT`, `PATCH`, and `DELETE` return `405 method_not_allowed`.
- API responses keep `mutation_allowed: false` and
  `raw_confidential_material_visible: false`.

## Boundary That Must Stay Closed

FB.1 must not open:

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
- Codex final approval
- Claude final approval

## Validation Evidence Before Review

Expected local validation set:

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

## Reviewer Questions

1. Does FB.1 preserve the read-only factory boundary?
2. Can PS3+ transitions, candidate writes, apply behavior, or protected
   authority be reached through the new command/API?
3. Does the stage read model fail closed when required inputs are missing,
   invalid, or over-promoted?
4. Are the tests sufficient for the added behavior and negative fixtures?
5. Are there any blocking findings that must be fixed before committing FB.1?

## Required Review Shape

Return a concise JSON-compatible review result with:

- `verdict`
- `blocking_findings`
- `non_blocking_findings`
- `changes_required_before_commit`
- `validated_commands`
- `review_notes`
