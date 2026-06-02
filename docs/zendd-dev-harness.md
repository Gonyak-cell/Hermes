# Zendd Dev Harness

`project:zendd-dev-harness` is the P541-P560 read-only adapter that lets Hermes
model Zendd development work without editing the Zendd checkout.

## Command

```bash
npm run project:zendd-dev-harness -- --check
```

Optional:

```bash
npm run project:zendd-dev-harness -- --zendd-root <path>
```

## Outputs

- `artifacts/zendd-dev-harness/latest/zendd-dev-harness.json`
- `artifacts/zendd-dev-harness/latest/project-dev-profile.json`
- `artifacts/zendd-dev-harness/latest/work-order-policy.json`
- `artifacts/zendd-dev-harness/latest/intake-mapping-rows.json`
- `artifacts/zendd-dev-harness/latest/lane-policy-rows.json`
- `artifacts/zendd-dev-harness/latest/test-command-candidate-rows.json`
- `artifacts/zendd-dev-harness/latest/protected-route-rows.json`
- `artifacts/zendd-dev-harness/latest/hermes-function-coverage-rows.json`
- `artifacts/zendd-dev-harness/latest/validation-report.json`
- `artifacts/zendd-dev-harness/latest/summary.md`

## Safety Boundary

- The adapter does not mutate Zendd files, create Zendd worktrees, or execute
  Zendd commands.
- Every requested Zendd change becomes a work order packet with `project_id`,
  scope, owner, claim, evidence, review/gate, receipt when protected, rollback
  target, and next allowed action.
- Backend, frontend, Electron, VDR, LDD, client-output, release, and security
  lanes are modeled but not materialized.
- Test/lint/check scripts are command candidates only. They need P561-P580
  command evidence bridge before execution.
- Protected routes such as VDR source handling, LDD fact/issue outputs,
  client-facing reports, DB migrations, releases, secrets, and physical
  integration cannot PASS without evidence, gate/review, and required receipt.
