# Human Review Correction Validation

`Human Review Correction Validation` reruns the standard human gate receipt validator against the merged correction receipt input.

```sh
npm run control-plane:review-corrections:validate
```

Input:

- `artifacts/human-review-correction-workspace-merge/latest/receipt-input.json`
- `artifacts/control-plane-human-gate-receipts/latest/control-plane-human-gate-receipt-drafts.json`

Output:

- `artifacts/human-review-correction-validation/latest/control-plane-human-gate-receipt-validation.json`
- `artifacts/human-review-correction-validation/latest/validated-human-gate-receipts.json`
- `artifacts/human-review-correction-validation/latest/summary.md`

This stage does not apply receipts. It only proves that the correction workspace output can re-enter the validation loop without missing, unknown, or invalid receipt rows.

Operational meaning:

- `pending_receipts`: reviewers still need to fill correction receipt decisions.
- `ready_to_apply`: at least one corrected receipt is valid and can be considered by a future application stage.
- `blocked_missing_source`: receipt drafts or merged correction input are unavailable.
