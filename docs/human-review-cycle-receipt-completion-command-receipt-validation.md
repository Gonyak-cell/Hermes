# Human Review Cycle Receipt Completion Command Receipt Validation

`npm run control-plane:review-cycle:completion-command-receipts:validate` validates command-run receipts created by the command receipts stage.

It is intentionally conservative:

- It does not execute queued commands.
- It does not edit target receipt inputs.
- It does not apply receipts or protected actions.
- Pending command receipts remain pending and are not treated as proof of execution.
- Non-pending command receipts must include execution actor, time, output reference, notes, and the exact command that was run.

Default inputs:

- `artifacts/human-review-cycle-receipt-completion-command-receipts/latest/human-review-cycle-receipt-completion-command-receipts.json`
- `artifacts/human-review-cycle-receipt-completion-command-receipts/latest/receipt-input-draft.json`

Default output:

- `artifacts/human-review-cycle-receipt-completion-command-receipt-validation/latest/human-review-cycle-receipt-completion-command-receipt-validation.json`
- `artifacts/human-review-cycle-receipt-completion-command-receipt-validation/latest/validated-command-receipts.json`
- `artifacts/human-review-cycle-receipt-completion-command-receipt-validation/latest/receipt-errors.json`
- `artifacts/human-review-cycle-receipt-completion-command-receipt-validation/latest/summary.md`

Typical query points:

- `/api/human-review-cycle-completion-command-receipt-validations?validation_status=pending_receipts`
- `/api/human-review-cycle-completion-command-receipt-validation-items?validation_status=pending_receipt`
- `/api/human-review-cycle-completion-command-receipt-errors`
- `/api/validated-human-review-cycle-completion-command-receipts`

This stage is the checkpoint between manual command execution and any later refresh confirmation. It validates receipts only.

The next stage, `control-plane:review-cycle:completion-command-receipts:feedback`, converts these validation items into actor-specific feedback bundles. That feedback layer remains read-only and tells reviewers which command receipt rows still need manual completion or correction.
