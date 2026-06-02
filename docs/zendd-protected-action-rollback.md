# Zendd Protected Action Rollback

`project:zendd-protected-action-rollback` is the P721-P740 hardening layer
between cross-system claim freeze and the physical integration decision.

It does not execute protected actions, run Zendd release commands, run database
migrations, export client reports, apply receipts, rehearse or execute rollback,
mutate the external Zendd checkout, or move Zendd code.

## Command

```bash
npm run project:zendd-protected-action-rollback -- --check
```

To inspect a different external Zendd checkout:

```bash
npm run project:zendd-protected-action-rollback -- --zendd-root <path>
```

Artifacts are written to `artifacts/zendd-protected-action-rollback/latest`
unless `--check` is used:

- `zendd-protected-action-rollback.json`
- `protected-action-rollback-policy.json`
- `protected-action-rows.json`
- `rollback-target-rows.json`
- `protected-work-order-rows.json`
- `fail-closed-fixture-rows.json`
- `next-action-rows.json`
- `protected-action-rollback-closeout-rows.json`
- `protected-action-rollback-gate-rows.json`
- `validation-report.json`
- `summary.md`

## Hardening Rules

- Every protected action requires a cross-system freeze ref, protected work
  order ref, rollback target ref, hard gate ref, human receipt ref, recovery
  receipt ref, evidence ref, owner, block reason, and next action.
- Rollback targets are explicit but rollback rehearsal and execution remain
  disabled.
- Work orders are declared but not materialized or validated.
- Receipt application stays blocked.
- Physical Zendd code movement stays blocked until P741-P760.
- Fail-closed fixtures verify that missing work order, rollback target, human
  receipt, unsafe flags, receipt application, rollback rehearsal, physical move,
  and dirty-tree mutation do not enable action execution.

## Next Phase

P741-P760 should decide whether the external adapter remains safer than subtree,
submodule, workspace, or physical directory movement.
