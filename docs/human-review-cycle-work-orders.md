# Human Review Cycle Work Orders

Phase 70 turns the read-only Human Review Cycle Ledger into actor-specific work orders. It keeps the cycle ledger as the source of truth, enriches each item with correction feedback receipt paths when available, and gives each actor a concrete queue without applying any receipt or protected action.

```bash
npm run control-plane:review-cycle:work-orders
```

Useful options:

- `--cycle-ledger <path>`: Human Review Cycle Ledger artifact.
- `--correction-feedback <path>`: Human Review Correction Feedback artifact used for target receipt paths and required fields.
- `--out-dir <dir>`: output directory.
- `--run-at <iso>`: override `generated_at`.
- `--check`: fail when work orders cannot be built safely.

Outputs:

- `human-review-cycle-work-orders.json`: full work order artifact.
- `work-order-items.json`: one work order item per cycle item.
- `actor-work-orders.json`: required-actor rollup.
- `actors/<required_actor>/work-order.json`: actor-specific work order.
- `actors/<required_actor>/work-order.md`: actor-specific checklist.
- `summary.md`: top-level status.

Safe handling:

- This stage is work-order-only.
- It does not apply receipts.
- It does not execute protected delivery, merge, ERP, command, or external actions.
- Pending actor work stays pending until a human edits the relevant receipt input and the correction validation loop passes.
