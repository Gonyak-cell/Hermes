# Human Review Cycle Receipt Completion Command Receipt Workspace Merge

Phase 85 merges actor-specific command receipt inputs into one validation input.

## Purpose

`control-plane:review-cycle:completion-command-receipts:workspace:merge` reads the actor workspaces created by the command receipt workspace stage and produces a canonical `receipt-input.json` for command receipt validation.

## Inputs

- `artifacts/human-review-cycle-receipt-completion-command-receipt-workspace/latest/human-review-cycle-receipt-completion-command-receipt-workspace.json`
- `actors/<required_actor>/receipt-input.json` files referenced by the workspace artifact

## Outputs

- `human-review-cycle-receipt-completion-command-receipt-workspace-merge.json`
- `receipt-input.json`
- `merge-items.json`
- `actor-inputs.json`
- `summary.md`

## Safety Contract

This stage is merge-only.

- It does not run commands.
- It does not edit actor receipt inputs.
- It does not validate command results.
- It does not apply receipts.
- It does not execute protected actions.
- It keeps `auto_execute_allowed: false`, `receipt_edits_must_be_manual: true`, `validation_required_before_application: true`, and `protected_actions_executed: false`.

## Status Model

- `pending_human_review`: at least one merged command receipt row is still pending.
- `ready_for_validation`: one or more merged command receipts have terminal manual-run evidence and can be validated.
- `blocked`: a required source artifact is unavailable or the safety contract is violated.
- `clear`: no merge items remain.

## Control Plane Integration

The Control Plane Loop runs this stage after command receipt workspace and before human gate receipt application. The Review Dashboard exposes the stage as `human_review_cycle_receipt_completion_command_receipt_workspace_merge`, the Goal Checkpoint tracks it with `human_review_cycle_receipt_completion_command_receipt_workspace_merge_gate`, and the Review API exposes:

- `/api/human-review-cycle-completion-command-receipt-workspace-merges`
- `/api/human-review-cycle-completion-command-receipt-merge-items`
- `/api/human-review-cycle-completion-command-receipt-actor-inputs`
- `/api/merged-human-review-cycle-completion-command-receipt-input`
