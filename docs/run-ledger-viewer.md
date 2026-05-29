# Run Ledger Viewer

`Run Ledger Viewer` is the Phase 292 read-only projection over workflow run, agent run, tool invocation, audit, log, and artifact ledger metadata.

The viewer renders Desktop session rows, workflow progress rows, event-backed history rows, agent activity rows, tool activity rows, and log/artifact reference rows. It displays references only: it does not read log content, read artifact content, replay events, execute routes, start a server, mutate ledgers, apply approvals, deliver output, generate legal advice, or produce client-facing output.

Human review note: resume, retry, cancel, delivery, legal analysis, and client-facing outputs remain human-gated.
