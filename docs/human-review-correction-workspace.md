# Human Review Correction Workspace

Phase 65 turns validation feedback into actor-specific editable correction workspaces. It extracts only the receipt rows that still need a human decision or correction, then writes per-actor receipt input subsets.

```bash
npm run control-plane:review-corrections
```

Useful options:

- `--feedback <path>`: Human Review Validation Feedback artifact.
- `--merge <path>`: Human Review Decision Register Merge artifact.
- `--out-dir <dir>`: output directory.
- `--run-at <iso>`: override `generated_at`.
- `--check`: fail when the workspace cannot be built safely.

Outputs:

- `human-review-correction-workspace.json`: full correction workspace artifact.
- `correction-items.json`: flat correction item list.
- `actor-workspaces.json`: required-actor rollup.
- `actors/<required_actor>/correction-workspace.json`: actor-specific correction rows.
- `actors/<required_actor>/receipt-input.json`: actor-specific editable receipt input subset.
- `actors/<required_actor>/corrections.md`: reviewer checklist.
- `summary.md`: top-level status.

Safe handling:

- This stage is correction-workspace-only.
- It does not write back to the decision register.
- It does not apply receipts.
- It does not execute protected delivery, merge, ERP, or external actions.

This gives each reviewer a small editable file instead of asking them to work from a large global receipt input.

After actor correction inputs are filled, merge them back into a single validation input with:

```bash
npm run control-plane:review-corrections:merge
```
