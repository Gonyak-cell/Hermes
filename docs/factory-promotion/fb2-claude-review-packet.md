# FB.2 Claude Opus Max Review Packet

Status: ready for read-only independent review.
Date: 2026-06-11
Requested reviewer lane: Claude Code Opus Max.

## Review Command Contract

The Codex lane must request this review with:

```bash
claude --model opus --effort max --tools "" --no-session-persistence --output-format json -p "$REVIEW_PROMPT" \
  | tee artifacts/factory-promotion/fb2-review/claude-opus-max-review.raw.json
```

Before launch, check for stale Claude review processes. During long quiet
periods, inspect process liveness and raw artifact growth before retrying. Do
not count a review without a captured raw artifact.

## Invalid Review Outputs

Do not count the review as evidence when any of these are true:

- the raw artifact is missing
- the output contains `Not logged in` or asks to run `/login`
- the output is malformed JSON
- the output is only a tool-call shaped payload without a review verdict
- the process is interrupted or has no final verdict
- the review used source-mutating tools
- a later follow-up review supersedes the artifact

Only the final valid raw Opus Max artifact may be referenced as FB.2 review
evidence.

## Scope To Review

FB.2 extends the factory stage surface into a read-only control view:

- `src/factory-stage-read-model.mjs`
- `src/review-api.mjs`
- `test/factory-stage-read-model.test.mjs`
- `docs/factory-state-store.md`
- `docs/review-api.md`
- `docs/factory-promotion/fb2-stage-control-view.md`
- `docs/factory-promotion/99-structured-summary.json`

## Intended Behavior

- `npm run factory:stage -- --check --require-pass` still reads factory
  products from local ledger first, then tracked seed.
- `/api/factory/stage` remains `GET`/`HEAD` only.
- Stage rows expose `gate_status`, `blocker_ids`, `next_operator_actions`,
  `stage_progress`, freshness fields, and queue-depth fields.
- Source timestamps older than seven days become stale rows with stale badges
  and `freshness_blocks_new_adjudication: true`.
- Candidate manifest preview remains unavailable until FB.3.
- Candidate/workbench queue depths remain `0`.
- PS3+ transition rows still fail closed.
- Candidate writes, apply behavior, project creation, repo writes, connector
  writes, deployment, protected actions, production PASS, and enterprise PASS
  all remain closed.

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

1. Does FB.2 preserve the read-only factory boundary?
2. Do freshness and control-view fields create any implied write, approval, or
   candidate-instantiation authority?
3. Can candidate manifests, candidate queues, apply behavior, PS3+ transitions,
   or protected actions be reached through the changed command/API?
4. Does stale-source handling make stale state visible and block new
   adjudication without failing the whole read model unnecessarily?
5. Are the tests sufficient for the added control-view behavior and negative
   fixtures?
6. Are there any blocking findings that must be fixed before committing FB.2?

## Required Review Shape

Return a concise JSON-compatible review result with:

- `verdict`
- `blocking_findings`
- `non_blocking_findings`
- `changes_required_before_commit`
- `validated_commands`
- `review_notes`

