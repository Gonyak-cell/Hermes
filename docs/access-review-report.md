# Access Review Report

Phase 302 adds `access_review_report`, a read-only review layer over the existing matter access policy evaluator and access audit projection.

The report keeps tenant, matter, user, runtime, and resource dimensions queryable without granting access, revoking access, mutating permissions, reading source content, ingesting sources, transferring externally, starting a server, executing routes, executing protected actions, generating legal advice, or producing client-facing output.

## Inputs

- `artifacts/retention-deletion-policy/latest/retention-deletion-policy.json`
- `artifacts/matter-access-policy/latest/matter-access-policy-evaluator.json`
- `artifacts/access-audit/latest/access-audit-projection.json`
- `artifacts/matter-profile-team-ledger/latest/matter-profile-team-ledger.json`
- `artifacts/wall-policy-contract/latest/wall-policy-contract.json`
- `artifacts/identity-policy-matter-freeze/latest/identity-policy-matter-freeze.json`

## Outputs

- `artifacts/access-review-report/latest/access-review-report.json`
- `artifacts/access-review-report/latest/access-review-source-statuses.json`
- `artifacts/access-review-report/latest/access-review-subjects.json`
- `artifacts/access-review-report/latest/access-review-matter-rows.json`
- `artifacts/access-review-report/latest/access-review-resource-rows.json`
- `artifacts/access-review-report/latest/access-review-findings.json`
- `artifacts/access-review-report/latest/access-review-gate-results.json`
- `artifacts/access-review-report/latest/access-review-boundary.json`
- `artifacts/access-review-report/latest/validation-report.json`

## Command

```bash
npm run compliance:access-review-report -- --check
```
