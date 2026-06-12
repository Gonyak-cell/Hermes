# FB.3 Claude Opus Max Review Packet

Status: completed with valid Law Firm OS-style Opus 4.8 Max review evidence.
Date: 2026-06-11
Requested reviewer lane: Claude Code Opus Max.

Original owner defer receipt:
`docs/factory-promotion/fb3-owner-claude-review-defer-receipt.json`.

The original defer receipt is now superseded by the final validated review
artifact. It remains part of the audit history only and does not describe the
current FB.3 closeout state.

## Review Command Contract

The Codex lane requested the final review with the Law Firm OS-style wrapper:

```bash
claude -p "$(cat artifacts/factory-promotion/fb3-review-lawos-style-final/review-prompt.md)" \
  --model claude-opus-4-8 \
  --effort max \
  --permission-mode dontAsk \
  --tools "" \
  --output-format json \
  --max-budget-usd 4 \
  --no-session-persistence
```

Before launch, Codex checked for stale Claude review processes and treated
empty, interrupted, malformed, auth-failed, quota-failed, or tool-call-shaped
attempts as non-evidence. The final raw artifact was captured only after the
Claude process exited with code 0 and stderr 0 bytes.

Final prompt:

- path: `artifacts/factory-promotion/fb3-review-lawos-style-final/review-prompt.md`
- SHA-256:
  `87d4c24230ef497f0e1d785459ca93104548ba607e80e91e6f45a5af325e4f26`
- reviewed tree commit SHA:
  `2f3be4e42f09148dc26fda44e2a82f150b1a14fe`

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

Final valid evidence:

- raw artifact:
  `artifacts/factory-promotion/fb3-review-lawos-style-final/raw-output.json`
- parsed payload:
  `artifacts/factory-promotion/fb3-review-lawos-style-final/review-payload.json`
- artifact receipt:
  `artifacts/factory-promotion/fb3-review-lawos-style-final/review-receipt.json`
- evidence validation:
  `artifacts/factory-promotion/fb3-review-lawos-style-final/evidence-validation/claude-review-evidence-validation.json`
- verdict: `APPROVE_WITH_FINDINGS`
- blocking findings: 0
- non-blocking findings: 4
- changes required before commit: false
- Claude session id: `0914cfc9-78e0-45f9-984b-fbd04396cded`
- Claude result uuid: `e22654a7-a54e-44ed-9512-f1e7062103cd`

## Evidence Validation Command

Every raw review artifact must be classified with the deterministic validator
before it is counted:

```bash
npm run factory:claude-review-evidence -- \
  --review-id fb3-opus-4-8-lawos-style-final \
  --program-range FCORE-FB.3 \
  --raw-review artifacts/factory-promotion/fb3-review-lawos-style-final/raw-output.json \
  --prompt artifacts/factory-promotion/fb3-review-lawos-style-final/review-prompt.md \
  --out-dir artifacts/factory-promotion/fb3-review-lawos-style-final/evidence-validation \
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
