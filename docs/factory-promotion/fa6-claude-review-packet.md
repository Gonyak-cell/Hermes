# FA.6 Claude Code Review Packet

Status: ready for Opus Max read-only review.
Date: 2026-06-11

## Reviewer Instructions

You are the independent Claude Code Opus Max reviewer for Hermes Factory
Promotion FA.6. This is a read-only review. Do not edit, write, format, stage,
commit, or otherwise mutate any files. Do not run commands that mutate the
worktree or external services.

Review the current uncommitted diff in `/Users/jws/Documents/Codex/Hermes`.
Focus on whether FA.6 safely adds a read-only Review API surface for factory
products without opening write authority or trust gates.

## Context

Hermes is being promoted into a SaaS Factory / Product Operating Platform.
FA.1-FA.5 already added product registry schemas, append-only ledgers,
receipt-driven PS0-PS2 transitions, a tracked seed migration, and a
store-first multi-project projection.

FA.6 scope:

- add `GET /api/factory/products` to `src/review-api.mjs`
- read factory products from `data/factory/local/products.jsonl` first
- fall back to `data/factory/seed/products.jsonl`
- fail closed with `503 factory_products_unavailable` when both stores are empty
- keep mutating methods blocked by the Review API global read-only guard
- add executable tests for tracked seed, filtering, POST 405, operational
  priority, and missing-store failure
- update smoke and docs

## Files To Inspect

- `src/review-api.mjs`
- `scripts/review-api-smoke.mjs`
- `test/review-api-factory-products.test.mjs`
- `docs/review-api.md`
- `docs/factory-state-store.md`
- `docs/factory-promotion/fa6-read-only-api-freeze.md`
- `docs/factory-promotion/99-structured-summary.json`

## Local Validation Already Run

```bash
node --check src/review-api.mjs
node --check scripts/review-api-smoke.mjs
node --test test/review-api-factory-products.test.mjs
npm run api:smoke
npm run factory:seed-migration -- --check --require-pass
npm run platform:factory-product-registry-store -- --check --require-pass
npm run contracts:validate -- --check
git diff --check
```

Observed local result before review:

- syntax checks passed
- factory products test: 7/7 pass
- API smoke passed
- seed migration ready, products 9/9, validation errors 0
- factory product registry store ready, validation errors 0
- contract validation suite: 214/214 pass, validation errors 0
- `git diff --check` passed

Latest post-Opus-notes hardening:

- route-local method guard added for `/api/factory/products`
- `HEAD /api/factory/products` test and smoke assertion added
- mutating methods test covers `POST`, `PUT`, `PATCH`, and `DELETE`
- factory authority flags are emitted through a closed allowlist

## Failure-Prevention Protocol

This review must follow the Law Firm OS closeout hardening posture:

- use Claude Code with model alias `opus` and effort `max`
- run with no Claude tools when the full diff and evidence are supplied in the
  prompt
- write raw Claude output to a durable artifact before promoting it to review
  evidence
- reject and do not count output that contains `Not logged in`, `/login`,
  malformed/tool-call-shaped output, no explicit verdict, or an interrupted
  process with no durable raw output
- if a process appears quiet, inspect process liveness before launching another
  review
- count only one valid Opus Max read-only review as FA.6 review evidence

Recommended invocation shape:

```bash
mkdir -p artifacts/factory-promotion/fa6-review
claude --model opus --effort max --tools "" --no-session-persistence \
  --output-format json \
  -p "<frozen diff + evidence prompt>" \
  | tee artifacts/factory-promotion/fa6-review/claude-opus-max-review.raw.json
```

## Review Questions

1. Does `/api/factory/products` preserve the intended read order:
   operational ledger, tracked seed, then fail closed?
2. Does the route avoid silently converting the legacy P9400 projection fallback
   into factory-store truth?
3. Are POST and other mutating methods blocked with `405 method_not_allowed`?
4. Does the response avoid exposing raw confidential material or secret-bearing
   data?
5. Are filters and route index/smoke coverage sufficient for FA.6?
6. Are the tests deterministic on a developer machine that may have local
   gitignored factory ledgers?
7. Do docs accurately describe trust boundaries and avoid implying production
   or enterprise approval?

## Required Output

Return:

- verdict: `pass`, `pass_with_notes`, or `block`
- findings ordered by severity, each with file and line reference when possible
- residual risks or test gaps
- whether any finding requires code/docs changes before FA.6 commit

Reminder: this review is not final human approval, production PASS, or
enterprise PASS.
