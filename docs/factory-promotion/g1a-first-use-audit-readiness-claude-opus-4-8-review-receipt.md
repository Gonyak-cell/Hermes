# G1a First-Use Audit Readiness Claude Opus 4.8 Max Review Receipt

Status: valid read-only Opus 4.8 evidence captured.

- Program: `G-SERIES.1a.first-use-audit-readiness`
- Reviewed base commit: `764fe2788a2e`
- Reviewer lane: Claude Code Opus max
- Resolved model: `claude-opus-4-8`
- Final verdict: `APPROVE_WITH_FINDINGS`
- Blocking findings: 0
- Non-blocking findings: 1
- Changes required before commit: false
- Final approval: false
- Production PASS: false
- Enterprise PASS: false
- Source mutation performed: false

## Counted Evidence

- Substantive review raw:
  `artifacts/factory-g1a-first-use-audit-readiness/latest/raw-output-noschema.json`
- Substantive review raw SHA-256:
  `cc5981f571e07089e72fb0d770b1b5d79a64e51c1f73efa5c6fec359840897b5`
- Final normalized raw:
  `artifacts/factory-g1a-first-use-audit-readiness/latest/raw-output-normalized-from-raw.json`
- Final normalized raw SHA-256:
  `1a06fb0865dc661c22e96dae6aacbcaa987b2103480eeaa7880e6ec9f17f5318`
- Final normalization prompt:
  `artifacts/factory-g1a-first-use-audit-readiness/latest/review-prompt-normalize-from-raw.md`
- Final normalization prompt SHA-256:
  `4506edd7d8a363723f0ec43c49cb43de700fe8e13b28d64963a65f91b48287c6`
- Evidence validation:
  `artifacts/factory-g1a-first-use-audit-readiness/latest/evidence-validation-final/claude-review-evidence-validation.json`
- Evidence validation SHA-256:
  `f5b5411cb99d725066d7b87c6cf3d8ca92fb06842cbf245bbfe20e90a8483a00`
- Extracted payload:
  `artifacts/factory-g1a-first-use-audit-readiness/latest/evidence-validation-final/extracted-review-payload.json`
- Extracted payload SHA-256:
  `e5c2876622712191fe7b6447e27fbb8833ce9ce78a6d8decb2d910f946a6165d`

Validator command:

```bash
npm run factory:claude-review-evidence -- --review-id g1a-first-use-audit-readiness-opus-4-8-lawos-style-final --program-range G-SERIES.1a.first-use-audit-readiness --raw-review artifacts/factory-g1a-first-use-audit-readiness/latest/raw-output-normalized-from-raw.json --prompt artifacts/factory-g1a-first-use-audit-readiness/latest/review-prompt-normalize-from-raw.md --out-dir artifacts/factory-g1a-first-use-audit-readiness/latest/evidence-validation-final --check --require-valid
```

Result:

- `valid_review_evidence`
- `APPROVE_WITH_FINDINGS`
- blocking findings: 0
- invalid reasons: none
- validation errors: 0

## Invalid Attempts

The following attempts are explicitly not counted:

| Attempt | Raw artifact | Reason | Validation artifact SHA-256 |
|---|---|---|---|
| 001 | `artifacts/factory-g1a-first-use-audit-readiness/latest/raw-output.json` | read-tool/schema attempt terminated after 0-byte raw/stderr hang | `45ccfef32668f914a8bae8038acffa610b25dc5b92ccce014b2cd9052f78af61` |
| 002 | `artifacts/factory-g1a-first-use-audit-readiness/latest/raw-output-final.json` | compact read-tool/schema attempt terminated after 0-byte raw/stderr hang | `56b68007e8d56410520508fa80a60432a82fb5191e09e1d289ff1598bb987775` |
| 003 | `artifacts/factory-g1a-first-use-audit-readiness/latest/raw-output-notool-diff.json` | no-tool schema attempt terminated after 0-byte raw/stderr hang | `20e012bdf4f8e0c62eaa02b9a3a57bb7ddafefdef49a41b11e5bad8956a992d3` |

Schema-output mode was unstable during this run, while normal Opus 4.8
`--output-format json` calls completed. The counted evidence therefore uses a
substantive no-schema review followed by a normalized raw output derived from
that review payload and accepted by the Hermes evidence validator.

## Non-Blocking Finding

`G1A-FUA-INFO-01`: `ready` currently requires `waitCount === 0`, and the
`source.owner_receipt_signed` row emits `wait` when the receipt is unsigned.
This correctly blocks readiness today. Claude suggested optionally adding
`sourceState.ownerReceiptSigned === true` directly to the ready conjunction as a
redundant defense-in-depth guard. This is not required before commit.

## Boundary

This review does not open G1a, create a workspace, bind first-use audit into
source, grant production or enterprise trust, or replace human adjudication.
