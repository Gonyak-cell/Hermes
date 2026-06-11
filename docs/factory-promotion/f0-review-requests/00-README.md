# F0.1 Independent Review Request Packets

Status: request packets only, not review evidence.
Date: 2026-06-11

These files prepare the two missing F0.1 independent review requests.

They do not prove that a review happened, do not unblock F0.1, and must not be
used as `includesText` validation substrate.

## Required Reviews

| Target | Request Packet | Required Receipt Output |
|---|---|---|
| Connector external app governance | [connector-external-app-governance-opus-review-request.md](connector-external-app-governance-opus-review-request.md) | `artifacts/connector-external-app-governance/review/claude-connector-governance-review-receipt.json` |
| Execution/write authority maturity | [execution-write-authority-maturity-opus-review-request.md](execution-write-authority-maturity-opus-review-request.md) | `artifacts/execution-write-authority-maturity/review/claude-execution-write-authority-review-receipt.json` |

## Receipt Rules

Each performed review receipt must satisfy both:

1. The current module validator shape:
   - `review_engine: "claude_code_opus_max"`
   - `receipt_status: "complete"`
   - target `scope_*: true`
   - `unresolved_finding_count: 0`
2. The F0 preflight integrity shape checked by `npm run factory:receipt-preflight -- --check`:
   - `reviewed_commit_sha`
   - `prompt_sha256`
   - `raw_output_sha256`
   - `engine_resolved_model_id`
   - `scope_id`
   - no Fable planning-lane evidence
   - no write/deploy/protected/pass/final-approval authority opened

Use [receipt-template.json](receipt-template.json) as the shape template, but do
not copy placeholders into final receipts.

## Operator Sequence

1. Commit the planning/tooling package or otherwise record the exact commit SHA to review.
2. Verify request packet integrity with `npm run factory:f0-review-request-doctor -- --check --require-pass`.
3. Build the dispatch packet with `npm run factory:f0-review-dispatch-packet -- --check --require-pass`.
4. Run each request packet in a real Opus-family independent review session.
5. Save the raw reviewer output and compute its SHA256.
6. Normalize the required receipt JSON with [receipt-intake-runbook.md](receipt-intake-runbook.md).
7. Run `npm run factory:receipt-preflight -- --check --require-pass`.
8. Run `npm run factory:promotion-f0-gate -- --check --require-pass`.
9. Run the target module check:
   - `npm run platform:connector-external-app-governance -- --check`
   - `npm run platform:execution-write-authority-maturity -- --check`

If either review has findings, set `unresolved_finding_count` accordingly and do
not mark F0.1 passed.
