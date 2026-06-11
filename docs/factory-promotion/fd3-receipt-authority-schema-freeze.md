# FD.3 Receipt Authority Schema Freeze

Status: `ready_factory_receipt_authority_schema_freeze_pending_lawos_style_claude_review`

## Scope

FD.3 freezes the receipt envelope authority surface at the schema layer. FD.1
proved owner-attested receipt verification, and FD.2 proved the apply and
rollback runtime stayed unreachable. FD.3 adds a schema-only guard so a consumer
that only validates `schemas/factory-receipt-envelope.schema.json` still blocks
receipts that try to open apply, write, deploy, protected action, production, or
enterprise authority.

This phase does not open a product-creation lane, apply engine, rollback
executor, repo writer, connector writer, deployment path, production PASS, or
enterprise PASS.

## Implemented Contract

- `schemas/factory-receipt-envelope.schema.json` now requires 15 receipt
  authority flags and freezes every flag to `false`.
- Optional `fd_receipt_verify` runtime fields are also frozen to `false` when
  present:
  - `apply_engine_runtime_enabled_now`
  - `rollback_executor_runtime_enabled_now`
  - `apply_attempted_now`
  - `rollback_attempted_now`
- FD receipt verification metadata is allowlisted with `const: true` when
  present:
  - `bound_candidate_sha256_required`
  - `owner_attestation_required`
  - `replay_nonce_required`
- `subject.bound_candidate_sha256` and
  `subject.bound_review_docket_row_sha256` are accepted as SHA-256 bindings so
  FD.1 receipts can expose deterministic source-chain anchors without opening
  apply authority.
- The seed factory receipt ledger was regenerated under the frozen authority
  vector so tracked seed receipts remain valid under the stronger schema.

## Verifier

Command:

```bash
npm run factory:receipt-authority-schema-freeze -- --check --require-pass
```

Primary artifact:

```text
artifacts/factory-receipt-authority-schema-freeze/latest/factory-receipt-authority-schema-freeze.json
```

The verifier builds these rows:

- 15 authority schema rows, one per required `const: false` authority flag.
- 4 runtime schema rows for optional FD receipt runtime fields.
- Positive schema fixtures from the tracked seed receipt plus 3 FD.1 owner
  attestation receipts.
- 12 negative schema fixtures that must be blocked by schema validation alone.

## Negative Fixtures

The FD.3 verifier must block:

- missing `authority_flags.apply_allowed_now`
- `authority_flags.apply_allowed_now: true`
- `authority_flags.source_file_write_allowed_now: true`
- `authority_flags.ledger_append_allowed_now: true`
- `authority_flags.rollback_executor_runtime_enabled_now: true`
- `authority_flags.deployment_allowed_now: true`
- `authority_flags.protected_action_allowed_now: true`
- `authority_flags.production_pass_enabled: true`
- `authority_flags.enterprise_pass_enabled: true`
- unexpected extra authority flag with a true value
- `fd_receipt_verify.apply_engine_runtime_enabled_now: true`
- unexpected extra `fd_receipt_verify` runtime flag with a true value

All twelve are schema-only checks. They do not rely on includesText scans,
generated prose, or runtime apply execution.

## Source Binding

FD.3 reuses the same candidate review docket object for FD.1 receipt generation
and FD.2 apply-engine-closed verification. This prevents a false mismatch where
FD.1 receipts bind to one generated docket while FD.2 verifies against a freshly
generated sibling docket.

## Review Adjudication Notes

The first Law Firm OS-style Claude review produced only P3 findings. Two were
fixed before closeout:

- `authority_flags.additionalProperties` is now `false`, so unexpected authority
  keys cannot pass silently.
- production, enterprise, deployment, and protected-action gates now have
  dedicated true-value negative fixtures.
- `fd_receipt_verify.additionalProperties` is also now `false`, so unexpected
  runtime signal keys cannot pass silently.

The remaining P3 is an adjudication note: `fd3_command` and package-script
checks prove manifest self-consistency, not independent authority evidence. The
independent local evidence for FD.3 is the schema row proof and schema-only
negative fixtures.

## Authority Boundary

The boundary remains:

- read-only/report-only verifier
- no apply engine invocation
- no rollback executor invocation
- no runtime state mutation
- no ledger append by FD.3 itself
- no production or enterprise PASS
- Claude review may report findings but cannot mutate source or approve the
  protected closeout gate

## Validation

Required local checks before closeout:

```bash
node --check src/factory-receipt-authority-schema-freeze.mjs
node --check scripts/factory-receipt-authority-schema-freeze.mjs
node --test test/factory-receipt-authority-schema-freeze.test.mjs
npm run factory:receipt-authority-schema-freeze -- --check --require-pass
npm run factory:receipt-verify -- --check --require-pass
npm run factory:apply-engine-closed -- --check --require-pass
npm run contracts:validate -- --check
git diff --check
```

## Review

FD.3 requires one Law Firm OS-style read-only Claude Opus 4.8 max review before
the phase can be marked closeout-eligible. Auth failures, malformed JSON,
tool-call-shaped output, or empty output are rejected and do not count as review
evidence.
