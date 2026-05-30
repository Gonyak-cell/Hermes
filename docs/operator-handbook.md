# Operator Handbook

Phase 310 adds `operator_handbook`, a deterministic read-only operator handbook for the Windows baseline.

The handbook combines the P309 deployment runbook with approval, receipt, policy violation, recovery, run ledger, and dashboard/API freeze artifacts. It is a Desktop-oriented operator surface only: it does not apply approvals, receipts, policy changes, recovery, rollback, restore, commands, routes, delivery, legal advice, or client-facing output.

Outputs are written under `artifacts/operator-handbook/latest`:

- `operator-handbook.json`
- `operator-handbook-sources.json`
- `operator-surfaces.json`
- `operator-workflows.json`
- `operator-screens.json`
- `operator-recovery-procedures.json`
- `operator-gates.json`
- `operator-handbook-boundary.json`
- `validation-report.json`
- `summary.md`

Use:

```bash
npm run operator:handbook -- --check
```

The handbook preserves human review and attorney-review gates for legal or client-facing outcomes and keeps the accepted Windows baseline stable before Phase 217+ work continues toward Phase 312.
