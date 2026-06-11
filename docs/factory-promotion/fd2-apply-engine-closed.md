# FD.2 Factory Apply Engine Closed

Status: ready locally and Law Firm OS-style Claude Opus 4.8 max reviewed.
Date: 2026-06-12

## Scope

FD.2 adds a deterministic closed apply-engine verifier:

```bash
npm run factory:apply-engine-closed -- --check --require-pass
```

The verifier consumes the FD.1 receipt verification result and the FC.3
candidate review docket. It builds apply-intent and rollback-verification rows
from real candidate, receipt, diff, rollback, and preflight hashes, but it does
not apply patches, mutate state, append ledgers, write source files, deploy, or
grant protected-action authority.

## Apply Intent Rows

FD.2 emits three apply-intent rows, one for each FD.1 verified receipt. Each row
binds:

- receipt id and receipt entry hash
- product id and candidate packet id
- candidate packet sha256
- review docket id and review docket row sha256
- diff packet id and diff sha256
- rollback plan id and rollback plan sha256
- preflight id, preflight sha256, and preflight status

Each intent is marked `blocked_apply_engine_unreachable`. This is intentional:
FD.2 proves that the receipt-consuming surface can be inspected without making
the apply engine reachable.

## Rollback Verification Rows

FD.2 emits three rollback-verification rows. Each rollback plan remains bound to
the candidate docket, but the rollback executor is also unreachable:

- `rollback_executor_invoked_now: false`
- `rollback_executed_now: false`
- `rollback_verification_status:
  blocked_rollback_executor_unreachable_no_state_mutation`

The rollback rows are failure-safe evidence only. They are not executable
rollback authority.

## Negative Fixtures

FD.2 executes five negative fixture checks:

- forged receipt apply attempt -> blocked
- bound candidate hash mismatch apply attempt -> blocked
- nonce reuse apply attempt -> blocked
- rollback after state mismatch -> failure report
- direct apply without FD receipt -> blocked

All fixtures keep apply and rollback runtime flags false.

## Authority Boundary

These remain false:

- `receipt_apply_engine_reachable_now`
- `receipt_apply_engine_opened_now`
- `apply_engine_runtime_enabled_now`
- `rollback_executor_runtime_enabled_now`
- `runtime_state_mutated_now`
- `apply_allowed_now`
- `source_file_write_allowed_now`
- `ledger_append_allowed_now`
- `persistent_ledger_append_allowed_now`
- `repo_write_allowed_now`
- `connector_write_allowed_now`
- `deployment_allowed_now`
- `protected_action_allowed_now`
- production PASS and enterprise PASS

FD.2 is still read-only and report-only. It prepares a deterministic apply and
rollback contract for later FD phases without opening the runtime.

## Claude Review

FD.2 has a valid Law Firm OS-style Claude Opus 4.8 max read-only review:

- receipt doc: `docs/factory-promotion/fd2-claude-opus-4-8-review-receipt.md`
- final raw artifact:
  `artifacts/factory-promotion/fd2-review-lawos-style-followup/raw-output.json`
- normalized receipt:
  `artifacts/factory-promotion/fd2-review-lawos-style-followup/review-receipt.json`
- verdict: `PASS_WITH_FINDINGS`
- P0/P1/P2 findings: 0
- P3 findings: 2, adjudicated as non-blocking for closed-engine FD.2

Claude review is independent evidence only. It cannot mutate source, grant final
approval, or open apply/write/deploy/protected/production/enterprise authority.

## Verification

```bash
node --check src/factory-apply-engine-closed.mjs
node --check scripts/factory-apply-engine-closed.mjs
node --test test/factory-apply-engine-closed.test.mjs
npm run factory:apply-engine-closed -- --check --require-pass
npm run contracts:validate -- --check
git diff --check
```

Observed local result before Claude review:

- FD.2 targeted tests: 4/4 pass
- apply-engine command: ready, 3/3 apply intents blocked, 3/3 rollback
  verifications blocked, 5/5 negative fixtures passed
- apply engine reachable: false
- rollback executor enabled: false
- runtime state mutated: false
- validation errors: 0

Observed post-adjudication review result:

- initial Claude P3 findings fixed: `FD2-001`, `FD2-002`
- residual P3 findings deferred before a reachable apply engine phase:
  `FD2-001-R1`, `FD2-002-R1`
- final Claude review status: valid, closeout eligible, no P0/P1/P2 blockers
