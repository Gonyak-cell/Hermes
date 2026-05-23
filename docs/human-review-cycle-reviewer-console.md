# Human Review Cycle Reviewer Console

Phase 73 renders the verified Human Review Cycle Triage Inbox as a reviewer-facing console. It joins each triage item with its context card and decision register row so each actor can see the target receipt input, required fields, allowed outcomes, evidence/matter context, and next actions in one place.

```bash
npm run control-plane:review-cycle:console
```

Useful options:

- `--triage-inbox <path>`: Human Review Cycle Triage Inbox artifact.
- `--context-bundle <path>`: Human Review Context Bundle artifact.
- `--decision-register <path>`: Human Review Decision Register artifact.
- `--out-dir <dir>`: output directory.
- `--run-at <iso>`: override `generated_at`.
- `--check`: fail when context cards, decision rows, target files, or safe-handling guarantees are missing.

Outputs:

- `human-review-cycle-reviewer-console.json`: full console artifact.
- `console-items.json`: one console item per triage item.
- `actor-consoles.json`: required-actor rollup.
- `index.html`: top-level static reviewer console.
- `actors/<required_actor>/index.html`: actor-specific static console.
- `actors/<required_actor>/reviewer-console.json`: actor-specific console data.
- `actors/<required_actor>/reviewer-console.md`: actor-specific readable queue.
- `summary.md`: top-level status.

Safe handling:

- This stage is view-only.
- It does not edit receipt inputs.
- It does not execute protected delivery, merge, ERP, command, or external actions.
- Every console item keeps `auto_execute_allowed: false` and `protected_actions_executed: false`.

Next stage:

- `npm run control-plane:review-cycle:field-audit` audits the referenced receipt rows and shows which required human decision fields are still pending.
- A human reviewer opens the actor console, edits the referenced receipt input manually, then reruns the correction merge, validation, and application gates.
