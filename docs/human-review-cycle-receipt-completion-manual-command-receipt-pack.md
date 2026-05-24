# Human Review Cycle Receipt Completion Manual Command Receipt Pack

Phase 90 turns the frozen baseline and command receipt workspace into actor-specific manual command receipt packs. It answers the practical reviewer question: which receipt input file should be edited, which fields are required, and which command rows still need manual receipt evidence.

Inputs:

- `artifacts/human-review-cycle-receipt-completion-baseline/latest/human-review-cycle-receipt-completion-baseline.json`
- `artifacts/human-review-cycle-receipt-completion-command-receipt-workspace/latest/human-review-cycle-receipt-completion-command-receipt-workspace.json`

Outputs:

- `artifacts/human-review-cycle-receipt-completion-manual-command-receipt-pack/latest/human-review-cycle-receipt-completion-manual-command-receipt-pack.json`
- `artifacts/human-review-cycle-receipt-completion-manual-command-receipt-pack/latest/actor-receipt-packs.json`
- `artifacts/human-review-cycle-receipt-completion-manual-command-receipt-pack/latest/pack-items.json`
- `artifacts/human-review-cycle-receipt-completion-manual-command-receipt-pack/latest/actors/<actor>/manual-command-receipt-pack.json`
- `artifacts/human-review-cycle-receipt-completion-manual-command-receipt-pack/latest/actors/<actor>/receipt-input-template.json`
- `artifacts/human-review-cycle-receipt-completion-manual-command-receipt-pack/latest/actors/<actor>/README.md`

Safety invariants:

- The pack is read-only with respect to source artifacts.
- It does not run commands.
- It does not edit receipts automatically.
- It does not execute protected actions.
- Held commands and protected approval blockers are carried as non-receipt blockers for later phases.

Validation:

- Each pending command receipt blocker in the baseline must have one pack item.
- Each actor receipt pack must include a target receipt input path.
- Each pack item must list required receipt fields.
- Each editable receipt must contain placeholders for every required field.
- The pack item count must match the baseline pending command receipt count.

CLI:

```bash
npm run control-plane:review-cycle:completion-manual-command-receipt-pack
```

Review API:

- `/api/human-review-cycle-completion-manual-command-receipt-packs`
- `/api/human-review-cycle-completion-manual-command-receipt-pack-actors`
- `/api/human-review-cycle-completion-manual-command-receipt-pack-items`
