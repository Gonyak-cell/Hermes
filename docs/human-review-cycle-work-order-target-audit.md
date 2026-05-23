# Human Review Cycle Work Order Target Audit

Phase 71 checks that each Human Review Cycle Work Order points to an actual editable receipt input and that the expected gate row exists in that file. It is an audit-only stage for making the actor work order queue safe to use.

```bash
npm run control-plane:review-cycle:target-audit
```

Useful options:

- `--work-orders <path>`: Human Review Cycle Work Orders artifact.
- `--out-dir <dir>`: output directory.
- `--run-at <iso>`: override `generated_at`.
- `--check`: fail when target files or rows are unavailable.

Outputs:

- `human-review-cycle-work-order-target-audit.json`: full target audit artifact.
- `target-audit-items.json`: one audit item per work order item.
- `actor-target-audits.json`: required-actor rollup.
- `actors/<required_actor>/target-audit.json`: actor-specific target audit.
- `actors/<required_actor>/target-audit.md`: actor-specific readable audit.
- `summary.md`: top-level status.

Safe handling:

- This stage is audit-only.
- It reads target receipt inputs but does not edit or apply them.
- It does not execute protected delivery, merge, ERP, command, or external actions.

Next stage:

- `npm run control-plane:review-cycle:triage` turns verified work orders and target audit items into actor-specific triage inboxes.
