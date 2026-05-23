# Human Review Receipt Workspace

`Human Review Receipt Workspace` turns the agenda receipt intake into actor-specific editable receipt inputs. It is the first place where the pending human receipt rows are split into practical work folders for the reviewer, attorney, operator, developer, or content owner.

```bash
npm run control-plane:review-workspace
```

Outputs:

- `human-review-receipt-workspace.json`: workspace manifest, actor groups, workspace entries, safe handling, and validation
- `actor-workspaces.json`: per-actor workspace manifest
- `workspace-entries.json`: one row per receipt requirement/intake item
- `actors/<required_actor>/receipt-input.json`: standard `control-plane-human-gate-receipts-input.v1` subset for that actor
- `actors/<required_actor>/review.md`: human-readable review checklist
- `summary.md`: top-level workspace summary

Safe handling:

- The workspace writes editable receipt drafts only.
- It does not apply receipts.
- It does not execute protected delivery, merge, ERP, or external actions.
- Every edited actor receipt input must still pass human gate receipt validation before any receipt application command.

This keeps `/goal`'s Gate/Approval layer explicit: agenda is for deciding what must be reviewed, intake turns decisions into standard receipt input, and workspace gives each actor a clean file to fill without bypassing validation.
