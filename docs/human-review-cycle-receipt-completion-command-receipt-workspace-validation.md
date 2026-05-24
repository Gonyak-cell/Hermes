# Human Review Cycle Receipt Completion Command Receipt Workspace Validation

Phase 86 validates the merged command receipt input created from actor workspaces.

## Purpose

`control-plane:review-cycle:completion-command-receipts:workspace:validate` runs the existing command receipt validator against the merged workspace `receipt-input.json`. This keeps one validation contract for command-run receipts while tracking post-merge validation as its own Control Plane stage.

## Inputs

- `artifacts/human-review-cycle-receipt-completion-command-receipts/latest/human-review-cycle-receipt-completion-command-receipts.json`
- `artifacts/human-review-cycle-receipt-completion-command-receipt-workspace-merge/latest/receipt-input.json`

## Outputs

- `human-review-cycle-receipt-completion-command-receipt-validation.json`
- `validated-command-receipts.json`
- `receipt-errors.json`
- `summary.md`

## Safety Contract

This stage is validation-only.

- It does not run commands.
- It does not edit actor or merged receipt inputs.
- It does not apply receipts.
- It does not execute protected actions.
- It keeps `auto_execute_allowed: false`, `command_receipt_validation_only: true`, `receipt_edits_must_be_manual: true`, and `protected_actions_executed: false`.

## Status Model

- `pending_receipts`: merged command receipt rows still need manual execution evidence.
- `ready_to_confirm`: merged command receipt rows have terminal manual-run evidence and can move to a later confirmation step.
- `blocked_invalid_receipts`: merged input rows contain invalid or mismatched receipt evidence.
- `blocked_missing_source`: a required source artifact is unavailable.
- `clear`: no validation items remain.

## Control Plane Integration

The Control Plane Loop runs this stage after command receipt workspace merge and before human gate receipt application. The Review Dashboard exposes the stage as `human_review_cycle_receipt_completion_command_receipt_workspace_validation`, the Goal Checkpoint tracks it with `human_review_cycle_receipt_completion_command_receipt_workspace_validation_gate`, and the Review API exposes:

- `/api/human-review-cycle-completion-command-receipt-workspace-validations`
- `/api/human-review-cycle-completion-command-receipt-workspace-validation-items`
- `/api/human-review-cycle-completion-command-receipt-workspace-validation-errors`
- `/api/validated-human-review-cycle-completion-command-workspace-receipts`
