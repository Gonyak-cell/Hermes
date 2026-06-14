# FD.1 Factory Receipt Verify

Status: ready locally and Law Firm OS-style Claude Opus 4.8 max reviewed.
Date: 2026-06-12

## Scope

FD.1 opens the FD tranche with a deterministic receipt integrity verifier:

```bash
npm run factory:receipt-verify -- --check --require-pass
```

The verifier consumes the FC.5 freeze handoff, FC.3 candidate review docket,
tracked FA seed receipt ledger, and `factory-receipt-envelope.v1`. It proves
that receipt envelopes are bound to candidate packet hashes before any apply
path can be considered. The owner-attestation rows are deterministic verifier
fixtures only; they do not replace real owner adjudication.

## Receipt Binding

FD.1 builds and verifies three owner-attestation receipt envelopes, one per
candidate packet. Each receipt binds:

- `receipt_id`
- `issuer.issuer_role: human_owner`
- `issuer.engine_resolved_model_id: human`
- candidate `product_id`
- candidate packet id
- `subject.bound_candidate_sha256`
- `subject.bound_review_docket_row_sha256`
- owner attestation id
- replay-prevention nonce
- `payload_sha256`, `prev_entry_hash`, and receipt ledger `entry_hash`

The receipt rows are verification evidence only. They do not approve, apply,
write, deploy, or grant production/enterprise trust.

## Negative Fixtures

FD.1 executes four negative fixture checks:

- forged `bound_candidate_sha256` -> blocked
- missing or forged owner attestation -> blocked
- replayed nonce -> blocked
- attempted apply-engine open -> blocked

These fixtures are computed from actual receipt rows and verifier outcomes.
They are not hardcoded pass labels.

## Apply Boundary

These remain false:

- `receipt_apply_engine_reachable_now`
- `apply_engine_runtime_enabled_now`
- `rollback_executor_runtime_enabled_now`
- `apply_allowed_now`
- `source_file_write_allowed_now`
- `ledger_append_allowed_now`
- `persistent_ledger_append_allowed_now`
- `repo_write_allowed_now`
- `connector_write_allowed_now`
- `deployment_allowed_now`
- `protected_action_allowed_now`
- production PASS and enterprise PASS

FD.1 verifies receipt integrity. It does not implement a reachable apply engine
or rollback executor.

## Claude Review Receipt

FD.1 has a valid Law Firm OS-style Claude Opus 4.8 max read-only review:

- receipt doc: `docs/factory-promotion/fd1-claude-opus-4-8-review-receipt.md`
- final raw artifact:
  `artifacts/factory-promotion/fd1-review-lawos-style-followup/raw-output.json`
- normalized receipt:
  `artifacts/factory-promotion/fd1-review-lawos-style-followup/review-receipt.json`
- verdict: `PASS_WITH_FINDINGS`
- P0/P1/P2 findings: 0
- P3 findings: 5, fixed/addressed/deferred as non-blocking

Claude is independent review evidence only. It is not final owner approval and
does not grant runtime apply/write/deploy, protected action, production, or
enterprise authority.

## Verification

```bash
node --check src/factory-receipt-verifier.mjs
node --check scripts/factory-receipt-verifier.mjs
node --test test/factory-receipt-verifier.test.mjs
npm run factory:receipt-verify -- --check --require-pass
git diff --check
```

Observed local result before Claude review:

- FD.1 targeted tests: 5/5 pass
- receipt command: ready, 3/3 candidate receipts, 4/4 negative fixtures blocked
- apply engine reachable: false
- validation errors: 0
