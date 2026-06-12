# G0 Gate Opening Readiness

Status: ready locally, read-only, no G-series authority opened.
Date: 2026-06-12

## Scope

G0 adds the deterministic G-series gate opening readiness read model:

```bash
npm run factory:gate-opening-readiness -- --check --require-pass
node scripts/review-api.mjs --once /api/factory/gate-opening-readiness
```

The command evaluates the G1a/G1b/G2/G3 gate matrix from
`05-gate-opening-program.md` against the current F0 and FCORE FA-FE evidence.
It does not open project creation, repository writes, command execution,
deployment, connectors, protected actions, production PASS, enterprise PASS, or
factory-promotion goal completion.

## Source Literal Boundary

Gate opening remains source-literal only:

- runtime data cannot flip a gate open
- owner receipts are countable only when a future isolated source commit names
  them
- one gate is opened per commit
- one receipt permits one scoped action
- first-use audit remains required after opening

Current state:

- G1a prerequisites are ready, but the owner `gate_opening` receipt, isolated
  source literal opening commit, and first-use audit are missing.
- G1b prerequisites are ready, but G1a is not open.
- G2 is blocked until G1b has at least three no-incident usage rows.
- G3 is blocked until G2 and release-candidate evidence are ready.

All gate rows expose `gate_open_now: false`.

## Review API

`GET /api/factory/gate-opening-readiness` returns a
`review-api-collection.v1` envelope with
`collection: "factory_gate_opening_readiness_rows"`.

Supported filters:

- `gate_id`
- `gate_name`
- `authority_flag`
- `ps_transition`
- `prerequisite_status`
- `previous_gate_status`
- `gate_status`
- `gate_open_now`
- `owner_gate_opening_receipt_present`
- `source_literal_gate_open_commit_present`
- `limit`

Mutation methods return `405 method_not_allowed`.

## Local Evidence

Current local run:

- status: `ready_factory_gate_opening_readiness`
- program range: `G-SERIES.0`
- source program range: `FCORE-FA-FE`
- prerequisites ready: 8/8
- gate rows: 4
- gate open count: 0
- G1a status: `ready_for_owner_gate_receipt_and_source_literal_commit`
- source literal gate-open commits: 0
- owner gate-opening receipts: 0
- first-use audits: 0
- deferred gates closed: 6/6
- negative fixtures blocked: 5/5
- validation errors: 0

Artifact hashes:

- main artifact SHA-256:
  `04a44ecab7ee785061fd941ab1630522219a2c8f38ffc3e7145868b20433acff`
- gate rows SHA-256:
  `387017d712682ec6d897181d64c849e57d2b2610fbb9c86bd5113d56719716f4`
- boundary SHA-256:
  `1ba4bd48d709546fbd5223308e4bef5e03459c88c51f56f034f40caba800a9f2`

## Negative Fixtures

G0 blocks:

- data-only G1a opening attempt
- owner receipt without source literal commit
- source literal commit without owner receipt
- production/enterprise trust opening attempt
- AI final approval attempt

## Verification

```bash
node --check src/factory-gate-opening-readiness.mjs
node --check scripts/factory-gate-opening-readiness.mjs
node --check src/review-api.mjs
node --check scripts/review-api-smoke.mjs
node --test test/factory-gate-opening-readiness.test.mjs
npm run factory:gate-opening-readiness -- --check --require-pass
npm run api:smoke
npm run contracts:validate -- --check
git diff --check
```
