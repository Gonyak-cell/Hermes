# Evidence Review Draft

`Evidence Review Draft` turns the Evidence Viewer and Approval Queue review items into a structured decision draft. It does not send, merge, or approve protected material by itself. Its job is to make human evidence review fast and auditable.

## Run

```bash
npm run evidence:review:draft
```

Useful options:

```bash
npm run evidence:review:draft -- \
  --queue artifacts/approval-queue/latest/approval-queue.json \
  --out-dir artifacts/evidence-review-draft/latest
```

`--apply-safe-defaults` may prefill P1 internal evidence as `approve_evidence`, but client confidential and privileged material remains pending for attorney review.

## Outputs

- `evidence-review-draft.json`: review item ledger and policy summary
- `approval-decisions.draft.json`: `approval-decisions.v1` file that can be inspected, edited, and passed to `npm run approval:apply`
- `summary.md`: human-readable review summary

## Goal Role

This phase keeps the Evidence OS rule intact: machine-extracted evidence remains untrusted until reviewed. The draft separates “suggested decision” from “applied decision,” so later workflow stages can prove who approved each evidence item and under what policy.
