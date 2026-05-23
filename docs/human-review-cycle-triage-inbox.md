# Human Review Cycle Triage Inbox

Phase 72 turns verified Human Review Cycle Work Orders and their Target Audit results into actor-specific triage inboxes. It is an inbox-only stage: it tells each reviewer which receipt rows are ready to edit, but it does not apply receipts or execute protected actions.

```bash
npm run control-plane:review-cycle:triage
```

Useful options:

- `--work-orders <path>`: Human Review Cycle Work Orders artifact.
- `--target-audit <path>`: Human Review Cycle Target Audit artifact.
- `--out-dir <dir>`: output directory.
- `--run-at <iso>`: override `generated_at`.
- `--check`: fail when validation finds missing target audit linkage or blocked triage items.

Outputs:

- `human-review-cycle-triage-inbox.json`: full triage inbox artifact.
- `triage-items.json`: one triage item per work order item.
- `actor-triage-inboxes.json`: required-actor rollup.
- `actors/<required_actor>/triage-inbox.json`: actor-specific triage inbox.
- `actors/<required_actor>/triage-inbox.md`: actor-specific readable queue.
- `summary.md`: top-level status.

Safe handling:

- This stage is inbox-only.
- It reads work orders and target audits but does not edit receipt inputs.
- It does not execute protected delivery, merge, ERP, command, or external actions.
- Every triage item keeps `auto_execute_allowed: false` and `protected_actions_executed: false`.

Next stage:

- A human reviewer edits the referenced receipt input rows, then the validation/application stages can be rerun under the existing gates.
