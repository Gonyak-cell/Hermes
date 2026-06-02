# Platform Claim Receipt Verdict Refresh

`platform:claim-receipt-verdict-refresh` closes P516-P520 of the platform claim
adjudication layer. It consumes the frozen P500 claim registry and the P511-P515
operator surface, then evaluates optional external human receipt input.

The command is report-only. It does not create receipts, does not mutate the
frozen claim registry, and does not execute any `next_allowed_action`.

## Phase Mapping

- P516 validates optional external receipt payloads against the frozen BLOCK
  claims.
- P517 validates that a receipt binds to the same `claim_id` and
  `source_phase_slot` through the deterministic `human-receipt` ref.
- P518 marks PASS candidates only when a validated receipt is bound to the
  frozen claim and the receipt decision approves a PASS candidate.
- P519 retains documented BLOCK for every claim without a validated receipt.
- P520 closes the adjudication slice with PASS candidates plus retained BLOCK
  rows balanced back to the 40 frozen BLOCK claims.

## Receipt Input

The optional `--claim-receipt-input` JSON may be an array or an object with a
`receipts`, `claim_receipts`, or `items` array. A receipt must include:

- `receipt_id`
- `source_phase_slot`
- `claim_id`
- `human_receipt_ref`
- `receipt_source_ref`
- `receipt_actor`
- `receipt_decision`
- `receipt_status`
- `receipt_signed_at`
- `receipt_evidence_refs`

Only `receipt_status: "validated"` with
`receipt_decision: "approve_claim_pass_candidate"` can produce a PASS candidate.
Claims without that validated binding remain documented BLOCK.

## Boundaries

- No human receipt is auto-created by the harness.
- No source claim registry row is mutated.
- No PASS candidate is allowed without a validated receipt and claim binding.
- No package command, action command, server start, release, git operation,
  protected recovery, trading order, Desktop mutation, credential lookup, secret
  read, `.env` read, or Desktop config inspection is performed.
