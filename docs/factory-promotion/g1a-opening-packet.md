# G1a Opening Packet

Status: ready locally, packet-only, G1a still closed.
Date: 2026-06-12

## Scope

G1a prepares the Law Firm OS-style gate-opening packet for
`project_creation_allowed_now`.

```bash
npm run factory:g1a-opening-packet -- --check --require-pass
node scripts/review-api.mjs --once /api/factory/g1a-opening-packet
```

The packet does not create projects, sign owner receipts, mutate source, open
`SOURCE_LITERAL_GATE_OPEN_COMMITS.G1a`, run commands, write repositories, call
connectors, deploy, grant production PASS, grant enterprise PASS, or complete
Factory Promotion.

## Packet Contents

- owner `gate_opening` receipt template:
  `artifacts/factory-g1a-opening-packet/latest/owner-gate-opening-receipt-template.json`
- isolated source-literal opening commit plan:
  `artifacts/factory-g1a-opening-packet/latest/source-literal-opening-commit-plan.json`
- Law Firm OS-style Claude Opus 4.8 Max review packet:
  `artifacts/factory-g1a-opening-packet/latest/independent-review-packet.json`
- first-use audit checklist:
  `artifacts/factory-g1a-opening-packet/latest/first-use-audit-checklist.json`
- review prompt:
  `artifacts/factory-g1a-opening-packet/latest/review-prompt.md`

The owner receipt is `template_not_signed`, the source-literal plan is
`planned_not_applied`, the independent review is `packet_ready_review_not_run`,
and the first-use audit is `template_not_performed`.

## Law Firm OS-Style Review Contract

The review packet uses the same hardened pattern as the Law Firm OS closeout
lane:

- compact repo-local prompt
- `claude-opus-4-8`
- `--effort max`
- `--permission-mode dontAsk`
- read-only tools: `Read,Grep,Glob`
- JSON-only reviewer response
- JSON Schema-enforced Claude CLI output
- raw output captured after process exit
- invalid evidence rejected when empty, auth-failed, quota-limited,
  interrupted, malformed, tool-call-shaped, source-mutating, or final-approval
  claiming

The packet includes this validator command:

```bash
npm run factory:claude-review-evidence -- \
  --review-id g1a-opus-4-8-lawos-style \
  --program-range G-SERIES.1a \
  --raw-review artifacts/factory-g1a-opening-packet/latest/raw-output.json \
  --prompt artifacts/factory-g1a-opening-packet/latest/review-prompt.md \
  --out-dir artifacts/factory-g1a-opening-packet/latest/evidence-validation \
  --check \
  --require-valid
```

Final valid review receipt:
[g1a-claude-opus-4-8-review-receipt.md](g1a-claude-opus-4-8-review-receipt.md).

Final review result:

- verdict: `APPROVE_WITH_FINDINGS`
- blocking findings: 0
- non-blocking findings: 2
- changes required before commit: false
- raw output SHA-256:
  `c36d58656c215906038a58548e217f3ba2e050041fe5484e3659681e83c0e253`
- review receipt SHA-256:
  `c5950c142df262a2a6ab90ecb60069fc72dac466fbc9a5e09846c2cdedaca974`

## Current Evidence

- status: `ready_factory_g1a_opening_packet`
- G0 status: `ready_factory_gate_opening_readiness`
- G1a status: `ready_for_owner_gate_receipt_and_source_literal_commit`
- owner receipt template ready: true
- independent review packet ready: true
- G1a open now: false
- project creation allowed: false
- production PASS enabled: false
- enterprise PASS enabled: false
- validation errors: 0

Run-specific artifact hashes for this generated packet:

- main artifact SHA-256:
  `50683a1d524b2989f0a17b7379ea3a9ebf67b294415db0c4940ae9f086049637`
- owner receipt template SHA-256:
  `4c56e7f9d91f54927bb3d28dc6432ffbbfc7b1c1620a9ebcd3866bbe8d401904`
- source-literal plan SHA-256:
  `8abb8c08a59f19d1e08f22d512b958b6f3562954e050ead58f3f3d5c7a9e81fd`
- independent review packet SHA-256:
  `421965fab93bd8e8f290d278ef62cbc3394c8306ab5052d72db1c04406ba66df`
- review prompt SHA-256:
  `e52342e4f1d05027288b7d1f94ae80a01e3dc2738d589536e71b54d98f8b5166`

## Invalid Attempt History

- `invalid-attempt-001`: Claude exited 0 and stderr was empty, but the result
  contained prose before the JSON payload. The evidence validator rejected it
  with `payload.extracted`, `payload.verdict_present`, and
  `payload.blocking_findings_array`. Raw SHA-256:
  `7f15817afd861f24f85ae2f99d557073615435dfefec3da4ed8972c36a5d241e`.

## Negative Fixtures

G1a packet blocks:

- data-only G1a opening attempt
- unsigned owner receipt attempt
- source-plan-only opening attempt
- non-G1a authority opening attempt
- AI final approval attempt

## Verification

```bash
node --check src/factory-g1a-opening-packet.mjs
node --check scripts/factory-g1a-opening-packet.mjs
node --check src/review-api.mjs
node --check scripts/review-api-smoke.mjs
node --test test/factory-g1a-opening-packet.test.mjs
npm run factory:g1a-opening-packet -- --check --require-pass
npm run api:smoke
npm run contracts:validate -- --check
git diff --check
```
