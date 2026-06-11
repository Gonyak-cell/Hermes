# FB.3 Claude Opus Max Review Packet

Status: prepared, but deferred by owner instruction until requested again.
Date: 2026-06-11
Requested reviewer lane: Claude Code Opus Max.

Owner defer receipt:
`docs/factory-promotion/fb3-owner-claude-review-defer-receipt.json`.

## Review Command Contract

The Codex lane must request this review with:

```bash
claude --model opus --effort max --tools "" --no-session-persistence --output-format json \
  -p "$(cat artifacts/factory-promotion/fb3-review/claude-opus-max-final.prompt.md)" \
  | tee artifacts/factory-promotion/fb3-review/claude-opus-max-final.raw.json
```

Before launch, check for stale Claude review processes. During long quiet
periods, inspect process liveness and raw artifact growth before retrying. Do
not count a review without a captured raw artifact.

Current final retry prompt:

- path: `artifacts/factory-promotion/fb3-review/claude-opus-max-final.prompt.md`
- SHA-256: recompute immediately before dispatch and bind in the final review
  receipt. The prompt must not be counted if it predates the current diff.

## Invalid Review Outputs

Do not count the review as evidence when any of these are true:

- the raw artifact is missing
- the output contains `Not logged in` or asks to run `/login`
- the output is malformed JSON
- the output is only a tool-call shaped payload without a review verdict
- the process is interrupted or has no final verdict
- the review used source-mutating tools
- a later follow-up review supersedes the artifact

Only the final valid raw Opus Max artifact may be referenced as FB.3 review
evidence.

## Evidence Validation Command

Every raw review artifact must be classified with the deterministic validator
before it is counted:

```bash
npm run factory:claude-review-evidence -- \
  --review-id fb3-opus-max-final \
  --program-range FCORE-FB.3 \
  --raw-review artifacts/factory-promotion/fb3-review/claude-opus-max-final.raw.json \
  --prompt artifacts/factory-promotion/fb3-review/claude-opus-max-review.prompt.md \
  --out-dir artifacts/factory-promotion/fb3-review/final-validation \
  --check --require-valid
```

The validator rejects auth failures, quota/rate-limit output, interrupted raw
captures, tool-call-shaped output, missing verdicts, missing
`blocking_findings`, final approval claims, production/enterprise PASS claims,
and source mutation claims.

## Scope To Review

FB.3 adds the JSON-only candidate manifest resolver:

- `src/factory-candidate-manifest-resolver.mjs`
- `scripts/factory-candidate-manifest-resolver.mjs`
- `src/review-api.mjs`
- `scripts/review-api-smoke.mjs`
- `test/factory-candidate-manifest-resolver.test.mjs`
- `package.json`
- `docs/factory-state-store.md`
- `docs/review-api.md`
- `docs/factory-promotion/fb3-candidate-manifest-resolver.md`
- `docs/factory-promotion/99-structured-summary.json`

## Intended Behavior

- `npm run factory:candidate-manifests -- --check --require-pass` reads the
  FB.2 stage read model.
- The default tracked seed path returns 9 resolver rows and 0 candidate
  manifests.
- Fresh `PS2_receipt_bound` rows produce `factory-candidate-manifest.v1` JSON
  previews.
- Stale PS2 rows do not expose candidate manifest ids.
- PS3+ rows fail closed through the stage read model.
- `/api/factory/candidate-manifests` is `GET`/`HEAD` only and read-only.
- Candidate manifest previews remain JSON-only.
- Starter artifact corpus materialization is deferred to FB.4.
- Source writes, ledger appends, PS3 transition append, candidate manifest
  writes, apply behavior, project creation, repo writes, connector writes,
  deployment, protected actions, production PASS, and enterprise PASS remain
  closed.

## Validation Evidence Before Review

Expected local validation set:

```bash
node --check src/claude-review-evidence-validator.mjs
node --check scripts/claude-review-evidence-validator.mjs
node --check src/factory-candidate-manifest-resolver.mjs
node --check scripts/factory-candidate-manifest-resolver.mjs
node --check src/factory-stage-read-model.mjs
node --check src/review-api.mjs
node --check scripts/review-api-smoke.mjs
node --test test/claude-review-evidence-validator.test.mjs test/factory-candidate-manifest-resolver.test.mjs
npm run factory:candidate-manifests -- --check --require-pass
npm run factory:claude-review-evidence -- --review-id fb3-opus-max-invalid-attempt-001 --program-range FCORE-FB.3 --raw-review artifacts/factory-promotion/fb3-review/claude-opus-max-review.raw.json --prompt artifacts/factory-promotion/fb3-review/claude-opus-max-review.prompt.md --out-dir artifacts/factory-promotion/fb3-review/invalid-attempt-001-validation
npm run api:smoke
npm run contracts:validate -- --check
git diff --check
```

After the final raw review is captured, run the Evidence Validation Command
above with `--check --require-valid` before creating the review receipt.

## Reviewer Questions

1. Does FB.3 preserve the JSON-only/read-only factory boundary?
2. Can candidate manifests, resolver rows, or the Review API route mutate source
   files, append ledgers, advance PS state, or apply candidates?
3. Does the resolver only create candidate manifest JSON for fresh PS2 rows?
4. Do stale rows and PS3+ rows fail closed?
5. Are the tests sufficient for default seed, eligible PS2, stale PS2, PS3,
   API read, HEAD, and mutation rejection?
6. Are there any blocking findings that must be fixed before committing FB.3?

## Required Review Shape

Return a concise JSON-compatible review result with:

- `verdict`
- `blocking_findings`
- `non_blocking_findings`
- `changes_required_before_commit`
- `validated_commands`
- `review_notes`
