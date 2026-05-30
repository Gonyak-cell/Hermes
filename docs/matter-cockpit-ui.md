# Matter Cockpit UI

`matter_cockpit_ui` is a read-only Desktop projection for Phase 293. It combines Matter Cockpit, Matter OS Profile, Matter Timeline, Matter Task Board, Matter Document Index, Evidence Viewer UI, Approval Queue UI, and the P292 Run Ledger Viewer guard into profile, timeline, task, document, evidence, and approval panels.

```bash
npm run matter:cockpit-ui -- --check
```

It does not read document content, read source file content, mutate matter/task/document/evidence state, apply approvals or receipts, execute delivery, execute routes, start a server, generate legal advice, or create client-facing output. All legal/client-facing and protected actions remain human-gated.
