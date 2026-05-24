# Human Review Cycle Receipt Completion Command Receipt Workspace

Phase 84 adds an actor-specific workspace after command receipt feedback.

## Purpose

`control-plane:review-cycle:completion-command-receipts:workspace` converts command receipt feedback into editable command receipt input files. It gives a human actor a concrete `receipt-input.json` to fill after manually running refresh commands.

## Inputs

- `artifacts/human-review-cycle-receipt-completion-command-receipt-feedback/latest/human-review-cycle-receipt-completion-command-receipt-feedback.json`
- `artifacts/human-review-cycle-receipt-completion-command-receipts/latest/human-review-cycle-receipt-completion-command-receipts.json`

## Outputs

- `human-review-cycle-receipt-completion-command-receipt-workspace.json`
- `workspace-items.json`
- `actor-workspaces.json`
- `summary.md`
- `actors/<required_actor>/command-receipt-workspace.json`
- `actors/<required_actor>/receipt-input.json`
- `actors/<required_actor>/workspace.md`

## Safety Contract

This stage is draft-only.

- It does not run commands.
- It does not merge actor receipt inputs.
- It does not apply receipts.
- It does not execute protected actions.
- It keeps `auto_execute_allowed: false`, `receipt_edits_must_be_manual: true`, and `protected_actions_executed: false`.

## Status Model

- `pending_human_review`: at least one editable command receipt row still needs human input.
- `ready_for_confirmation`: command receipts are valid and waiting for human confirmation.
- `attention`: one or more rows need correction.
- `blocked`: a required source artifact is unavailable or the safety contract is violated.
- `clear`: no workspace items remain.

## Control Plane Integration

The Control Plane Loop runs this stage after command receipt feedback and before human gate receipt application. The Review Dashboard exposes the stage as `human_review_cycle_receipt_completion_command_receipt_workspace`, the Goal Checkpoint tracks it with `human_review_cycle_receipt_completion_command_receipt_workspace_gate`, and the Review API exposes:

- `/api/human-review-cycle-completion-command-receipt-workspaces`
- `/api/human-review-cycle-completion-command-receipt-workspace-items`
- `/api/human-review-cycle-completion-command-receipt-actor-workspaces`
