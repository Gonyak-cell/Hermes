# Approval Queue UI

Phase 289 adds `approval_queue_ui`, a read-only approval queue panel projection for the Review Dashboard.

It combines pending rows from:

- `approval-queue`
- `approval-inbox`
- `control-plane-human-gate-receipts`
- `human-review-cycle-receipt-completion-protected-approval-request-pack`

Command:

```bash
npm run approval:queue-ui -- --check
```

Outputs are written under `artifacts/approval-queue-ui/latest`:

- `approval-queue-ui.json`
- `approval-queue-ui-panels.json`
- `approval-queue-ui-items.json`
- `approval-queue-target-artifacts.json`
- `approval-queue-receipt-previews.json`
- `approval-queue-protected-request-previews.json`
- `approval-queue-ui-boundary.json`
- `approval-queue-ui-checks.json`
- `validation-report.json`
- `summary.md`

The artifact is a UI projection only. It can show pending approvals, required actors, target artifact lookup rows, receipt draft previews, and protected request previews. It does not apply approvals, apply receipts, execute protected actions, execute routes, start a server, mutate state, generate legal advice, or create client-facing output.
