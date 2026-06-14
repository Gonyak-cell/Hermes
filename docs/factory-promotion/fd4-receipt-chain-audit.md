# FD.4 Receipt Chain Audit

Status: `ready_factory_receipt_chain_audit_lawos_style_claude_reviewed`

## Scope

FD.4 links the FD receipt evidence into one read-only audit surface. It does not
open apply, rollback, source-write, ledger-append, deployment, protected-action,
production, or enterprise authority.

The audit binds:

- tracked seed receipt ledger validity
- FD.1 owner-attestation receipt chain
- FD.2 apply-intent and rollback-verification rows
- FD.3 receipt authority schema freeze evidence

## Verifier

Command:

```bash
npm run factory:receipt-chain-audit -- --check --require-pass
```

Primary artifact:

```text
artifacts/factory-receipt-chain-audit/latest/factory-receipt-chain-audit.json
```

The verifier rebuilds FD.1, FD.2, and FD.3 from one candidate review docket so
candidate hashes and review docket row hashes cannot drift between nested source
builds.

## Rows

FD.4 emits:

- 1 seed receipt chain row for the tracked FA.4 migration receipt.
- 3 FD.1 owner receipt chain rows, one per owner-attestation receipt.
- 3 FD.2 apply/rollback chain rows, one per blocked apply intent and rollback
  verification pair.
- 4 FD.3 schema freeze chain rows:
  - 15 authority flags required and `const: false`
  - 4 `fd_receipt_verify` runtime fields frozen
  - seed plus FD.1 receipts schema-valid
  - 12 schema-only negative fixtures blocked

## Negative Fixtures

FD.4 blocks four chain-level regressions:

- seed receipt ledger invalid
- FD.1 owner receipt `prev_entry_hash` break
- FD.2 apply-intent receipt hash mismatch
- FD.3 negative fixture count drop

These are deterministic chain checks, not includesText/prose scans.

## Authority Boundary

The boundary remains:

- read-only/report-only verifier
- no apply engine invocation
- no rollback executor invocation
- no runtime state mutation
- no ledger append by FD.4 itself
- no production or enterprise PASS
- Claude review may report findings but cannot mutate source or approve the
  protected closeout gate

## Validation

Required local checks before closeout:

```bash
node --check src/factory-receipt-chain-audit.mjs
node --check scripts/factory-receipt-chain-audit.mjs
node --test test/factory-receipt-chain-audit.test.mjs
npm run factory:receipt-chain-audit -- --check --require-pass
npm run factory:receipt-verify -- --check --require-pass
npm run factory:apply-engine-closed -- --check --require-pass
npm run factory:receipt-authority-schema-freeze -- --check --require-pass
npm run contracts:validate -- --check
git diff --check
```

## Review

FD.4 received one valid Law Firm OS-style Claude Opus 4.8 max follow-up review:

```text
docs/factory-promotion/fd4-claude-opus-4-8-review-receipt.md
```

Result:

- Verdict: `APPROVE`
- P0/P1/P2/P3 findings: `0/0/0/0`
- Blocks phase closeout: `false`
- Blocks factory promotion: `false`

Two read-only tool-mode follow-up attempts timed out with empty stdout and were
rejected as invalid review evidence. The valid review used a no-tools bounded
prompt fallback after those invalid attempts. Auth failures, malformed JSON,
tool-call-shaped output, or empty output remain rejected and do not count as
review evidence.
