# Human Review Cycle Receipt Completion Command Receipt Application

Phase 87 applies validated manual command receipts to the command queue ledger.

## Purpose

`control-plane:review-cycle:completion-command-receipts:apply` reads the merged command receipt validation artifact and records which manually run refresh commands can be treated as applied. It only patches derived queue state and audit artifacts. It does not run refresh commands, edit receipt inputs, or execute protected actions.

## Inputs

- `artifacts/human-review-cycle-receipt-completion-command-receipt-workspace-validation/latest/human-review-cycle-receipt-completion-command-receipt-validation.json`
- `artifacts/human-review-cycle-receipt-completion-command-queue/latest/human-review-cycle-receipt-completion-command-queue.json`

## Outputs

- `human-review-cycle-receipt-completion-command-receipt-application.json`
- `validated-command-receipts-to-apply.json`
- `applied-command-receipts.json`
- `audit-events.json`
- `patched-command-queue-items.json` when any validated command receipt is applied
- `summary.md`

## Safety Contract

This stage is receipt-application-only.

- It does not run commands.
- It does not edit actor, merged, or validated receipt inputs.
- It does not execute protected actions.
- It only derives applied command receipt, patched command queue item, and audit event artifacts when validation has ready command receipts.
- It keeps `auto_execute_allowed: false`, `command_receipt_application_only: true`, `refresh_commands_executed: false`, `protected_actions_executed: false`, and `receipt_edits_must_be_manual: true`.

## Status Model

- `nothing_to_apply`: no validated command receipts are ready yet.
- `applied`: validated command receipts were converted into applied receipt, queue patch, and audit artifacts.
- `blocked_validation_errors`: validation reported receipt errors.
- `blocked_missing_validation`: the command receipt validation artifact is unavailable.
- `blocked_missing_command_queue`: the source command queue artifact is unavailable.

## Control Plane Integration

The Control Plane Loop runs this stage after command receipt workspace validation and before receipt completion reconciliation. The Review Dashboard exposes the stage as `human_review_cycle_receipt_completion_command_receipt_application`, the Goal Checkpoint tracks it with `human_review_cycle_receipt_completion_command_receipt_application_gate`, and the Review API exposes:

- `/api/human-review-cycle-completion-command-receipt-applications`
- `/api/applied-human-review-cycle-completion-command-receipts`
- `/api/human-review-cycle-completion-command-receipt-application-pending-receipts`
- `/api/human-review-cycle-completion-command-receipt-application-audit-events`
