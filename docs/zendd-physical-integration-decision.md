# Zendd Physical Integration Decision

`project:zendd-physical-integration-decision` is the P741-P760 decision layer
for whether Zendd should stay external or be physically imported into Hermes.

The current safe decision is to keep Zendd in its external checkout and operate
through the Hermes external-project adapter. Submodule, subtree, workspace link,
monorepo directory move, raw project copy, and future mutation modes are
documented BLOCK until a later migration work order proves they are safer than
the adapter.

The command does not move Zendd code, create submodules or subtrees, create
workspace links, copy raw project files, mutate Zendd, apply receipts, execute
rollback, or promote physical movement to PASS.

## Command

```bash
npm run project:zendd-physical-integration-decision -- --check
```

To inspect a different external Zendd checkout:

```bash
npm run project:zendd-physical-integration-decision -- --zendd-root <path>
```

Artifacts are written to `artifacts/zendd-physical-integration-decision/latest`
unless `--check` is used:

- `zendd-physical-integration-decision.json`
- `physical-integration-policy.json`
- `integration-option-rows.json`
- `evidence-comparison-rows.json`
- `physical-movement-block-rows.json`
- `operating-mode-rows.json`
- `next-action-rows.json`
- `physical-integration-closeout-rows.json`
- `physical-integration-gate-rows.json`
- `validation-report.json`
- `summary.md`

## Decision Rules

- `external_project_adapter` is the only selected PASS mode.
- Physical code movement remains disabled.
- Submodule, subtree, workspace link, monorepo directory move, raw project copy,
  and hybrid future-mutation modes are documented BLOCK with owner and next
  action.
- Hermes controls Zendd by reference; Zendd remains the source of truth for its
  app/runtime/data.
- Future Zendd mutation requires scoped protected work orders, rollback target
  evidence, hard gates, and human receipts where protected.
- Future physical integration needs a new migration work order with evidence
  that it is safer than the external adapter.

## Closeout

P760 closes as `ready_for_external_adapter_operation`. This means Hermes can
continue to manage Zendd through boundary adapters, claim evidence, operator
surfaces, and protected work-order queues, but it does not authorize physical
code movement.
