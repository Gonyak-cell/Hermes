# Identity/Policy/Matter Freeze

Phase 132 freezes the P113-P131 Identity, Policy, and Matter Boundary track as a deterministic regression report.

`npm run identity-policy:freeze` reads the identity, client/counterparty, matter team, wall, access, classification, model/tool/output policy, approval authority, policy snapshot binding, matter tagging, access audit, store policy, conflict check, personal workspace, policy golden fixture, policy operations surface, and matter boundary slice artifacts.

It writes `artifacts/identity-policy-matter-freeze/latest/`:

- `identity-policy-matter-freeze.json`
- `freeze-source-statuses.json`
- `freeze-checkpoints.json`
- `freeze-note.json`
- `freeze-note.md`
- `validation-report.json`
- `summary.md`

The freeze report does not mutate source artifacts, execute protected actions, deliver outputs, or approve legal work. It only records whether the track is regression-frozen and whether residual human actions remain.

Passing freeze criteria:

- every P113-P131 source artifact is readable and reports its expected complete status
- policy golden fixtures retain allow, review, and deny cases with locked regression hashes
- policy operations surface exposes decisions, violations, and pending approvals
- matter boundary slice preserves promoted resource paths and passes retrieval gates
- unassigned resources have zero executable query plans
- cross-workspace probes remain blocked
- package scripts and roadmap records include the P132 freeze command and phase record
