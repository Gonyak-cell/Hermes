# Meeting Minutes Workflow

Phase 248 adds a deterministic meeting-minutes workflow for local law-firm operations.

The workflow reads the Project Alpha matter file, the existing Matter Timeline artifact, and a local board-minutes note. It emits read-only agenda rows, operational decision rows, draft action items, and evidence links so the team can review meeting outputs without mutating matter data or task state.

Guardrails:

- Outputs are internal operational scaffolds only.
- Attorney/human review and partner approval are required before any client-facing use.
- Decision rows are not legal conclusions or legal advice.
- Action items do not write task state, transition workflows, execute runtime actions, deliver outputs, or perform protected actions.
- Desktop views are read-only projections and are not the source of truth.

Command:

```bash
npm run law-firm:meeting-minutes -- --check
```
