# G1a Source Literal Preflight

Status: preflight layer ready locally, waiting for signed owner receipt.
Date: 2026-06-12

## Scope

G1a source literal preflight validates the future isolated source commit that
would bind a signed owner `gate_opening` receipt to
`SOURCE_LITERAL_GATE_OPEN_COMMITS.G1a`.

```bash
npm run factory:g1a-source-literal-preflight
npm run factory:g1a-source-literal-preflight -- --check
node scripts/review-api.mjs --once /api/factory/g1a-source-literal-preflight
```

The current default owner receipt is still unsigned, so the preflight status is
`waiting_for_signed_g1a_owner_receipt`.

## Future Commit Shape

If a valid signed owner receipt is supplied, this preflight can become
`ready_g1a_source_literal_commit_preflight`. Even then, this command does not
mutate source. It only constrains the future commit to:

- exactly one file: `src/factory-gate-opening-readiness.mjs`
- flip exactly `SOURCE_LITERAL_GATE_OPEN_COMMITS.G1a` from `false` to `true`
- bind exactly one signed owner receipt in `SOURCE_LITERAL_GATE_OPENING_RECEIPTS`
- keep G1b/G2/G3, production, enterprise, deployment, connector, and AI final
  approval authorities closed
- leave first-use audit as a required follow-up, not a claimed current fact

## Current Evidence

- status: `waiting_for_signed_g1a_owner_receipt`
- owner receipt signed: false
- ready for isolated source literal commit: false
- source mutation applied now: false
- first-use audit present: false
- G1a open now: false
- project creation allowed: false
- preflight rows pass/wait/fail: 11/1/0
- validation errors: 0

Run-specific artifact hashes:

- main artifact SHA-256:
  `23b996cd38a9425a610a03309b7544b25fdf669aaa634285771cea27be32e770`
- preflight rows SHA-256:
  `072d7911ad675bcdf839263f578b65314fad03210e17829a2df0f11fb5958c79`
- proposed source literal change SHA-256:
  `7ed48fb5c8802a3c1295976ad8e96468e5ae217eeb310d6eedc81f848b0eb979`
- boundary SHA-256:
  `c5a337f1c0f51c636361dbff12c4fa36faa06e52127b0b7001972fc46798cf40`

Final valid review receipt:
[g1a-source-literal-preflight-claude-opus-4-8-review-receipt.md](g1a-source-literal-preflight-claude-opus-4-8-review-receipt.md).

Final review result:

- verdict: `APPROVE_WITH_FINDINGS`
- blocking findings: 0
- non-blocking findings: 4
- changes required before commit: false
- raw output SHA-256:
  `63ecbfe9b4357b009b6db51f79f2891e3b0f82bbe597d1adb1fbcdff60498a85`
- extracted review payload SHA-256:
  `483dd9e8687d1858d8777b878024c401acba1edc11bbed5241c8f0aae808e3cd`

## Boundary

This preflight does not sign receipts, edit source, open
`SOURCE_LITERAL_GATE_OPEN_COMMITS.G1a`, create project workspaces, append
persistent ledgers, write repositories, call connectors, run commands, deploy,
grant protected action authority, grant production PASS, grant enterprise PASS,
or complete Factory Promotion.

Readiness here is only readiness for a later isolated source-literal commit. G1a
still remains closed until the signed owner receipt, isolated source commit, and
first-use audit sequence are captured.

## Verification

```bash
node --check src/factory-g1a-source-literal-preflight.mjs
node --check scripts/factory-g1a-source-literal-preflight.mjs
node --check src/review-api.mjs
node --check scripts/review-api-smoke.mjs
node --test test/factory-g1a-source-literal-preflight.test.mjs
npm run factory:g1a-source-literal-preflight -- --check
npm run api:smoke
npm run contracts:validate -- --check
git diff --check
```
