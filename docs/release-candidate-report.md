# Release Candidate Report

Phase 311 adds `release_candidate_report`, a deterministic read-only release candidate verification report for the v1.0 acceptance envelope.

The report records the validate/test, contracts, API/dashboard, control-plane, E2E, deployment/operator, Desktop readiness, and human-review backlog matrix. It does not run commands, start servers, call routes, deploy, recover, mutate approvals/receipts/policies, execute protected actions, generate legal advice, or produce client-facing output.

Outputs are written under `artifacts/release-candidate-report/latest`:

- `release-candidate-report.json`
- `release-candidate-sources.json`
- `release-candidate-matrix.json`
- `release-candidate-commands.json`
- `release-candidate-gates.json`
- `release-candidate-boundary.json`
- `validation-report.json`
- `summary.md`

Use:

```bash
npm run release:candidate -- --check
```

The report keeps pending approvals and operational blockers visible so the P312 freeze can make an explicit release decision instead of hiding human-review state.
