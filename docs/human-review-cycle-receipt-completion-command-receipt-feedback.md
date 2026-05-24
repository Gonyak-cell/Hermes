# Human Review Cycle Receipt Completion Command Receipt Feedback

Phase 83 adds a read-only feedback layer after command receipt validation.

## Purpose

`control-plane:review-cycle:completion-command-receipts:feedback` turns command receipt validation items into actor-specific feedback bundles. It tells each human actor which manual command receipt rows still need to be completed or corrected.

## Inputs

- `artifacts/human-review-cycle-receipt-completion-command-receipt-validation/latest/human-review-cycle-receipt-completion-command-receipt-validation.json`
- `artifacts/human-review-cycle-receipt-completion-command-receipts/latest/human-review-cycle-receipt-completion-command-receipts.json`
- `artifacts/human-review-cycle-receipt-completion-command-queue/latest/human-review-cycle-receipt-completion-command-queue.json`

## Outputs

- `human-review-cycle-receipt-completion-command-receipt-feedback.json`
- `feedback-items.json`
- `actor-feedback.json`
- `summary.md`
- `actors/<required_actor>/feedback.json`
- `actors/<required_actor>/feedback.md`

## Safety Contract

This stage is feedback-only.

- It does not run queued commands.
- It does not edit receipt input rows.
- It does not apply receipts.
- It does not execute protected actions.
- It keeps `auto_execute_allowed: false` and `protected_actions_executed: false`.

## Status Model

- `pending_human_review`: at least one actor still needs to fill a command receipt.
- `ready_for_confirmation`: all relevant receipts have been validated and are ready for human confirmation.
- `attention`: one or more command receipt rows need correction.
- `blocked`: a required source artifact is unavailable or the safety contract is violated.
- `clear`: no feedback items remain.

## Control Plane Integration

The Control Plane Loop runs this stage after command receipt validation and before human gate receipt application. The Review Dashboard exposes the stage as `human_review_cycle_receipt_completion_command_receipt_feedback`, the Goal Checkpoint tracks it with `human_review_cycle_receipt_completion_command_receipt_feedback_gate`, and the Review API exposes:

- `/api/human-review-cycle-completion-command-receipt-feedbacks`
- `/api/human-review-cycle-completion-command-receipt-feedback-items`
- `/api/human-review-cycle-completion-command-receipt-actor-feedback`
