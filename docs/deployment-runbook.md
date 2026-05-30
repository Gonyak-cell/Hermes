# Deployment Runbook

Phase 309 adds `deployment_runbook`, a deterministic read-only deployment runbook for the v1.0 final acceptance envelope.

The runbook documents these operating lanes:

- local Windows baseline verification
- development integration verification
- production-like dry-run verification
- optional Desktop Companion read-only deployment posture
- rollback and restore procedure

Outputs are written under `artifacts/deployment-runbook/latest`:

- `deployment-runbook.json`
- `deployment-runbook-sources.json`
- `deployment-environments.json`
- `deployment-commands.json`
- `deployment-checklists.json`
- `deployment-rollback-procedures.json`
- `deployment-gate-results.json`
- `deployment-runbook-boundary.json`
- `validation-report.json`
- `summary.md`

The artifact is runbook-only. It does not execute deployment, Desktop Companion installation, server start, route execution, rollback, restore, protected actions, delivery, legal advice, or client-facing output.
