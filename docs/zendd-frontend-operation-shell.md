# Zendd Frontend Operation Shell

`project:zendd-frontend-operation-shell` is the P761-P780 entry point for the
Zendd external-adapter development operations UI. It normalizes the attached
Supabase-inspired design resources into Hermes-owned operator design tokens and
generates a read-only static shell for reviewing Zendd operation status.

The shell does not move Zendd code, mutate the external checkout, read secrets,
copy raw VDR or client material, execute Zendd commands, apply receipts, run
database migrations, package releases, or execute rollback.

## Command

```bash
npm run project:zendd-frontend-operation-shell -- --check
```

Artifacts are written to `artifacts/zendd-frontend-operation-shell/latest`
unless `--check` is used:

- `zendd-frontend-operation-shell.json`
- `phase-plan-rows.json`
- `design-token-rows.json`
- `operation-contract-rows.json`
- `frontend-shell-rows.json`
- `route-surface-rows.json`
- `protected-mutation-block-rows.json`
- `frontend-operation-closeout-rows.json`
- `frontend-operation-gate-rows.json`
- `operator-shell.html`
- `operator-shell.css`
- `validation-report.json`
- `summary.md`

## Design Boundary

- The attached design resources are treated as source inspiration, not a brand
  dependency.
- Duplicate light/dark token names are split into explicit Hermes themes.
- Undefined and negative letter spacing are normalized to `0px`.
- The UI is a dense operator surface, not a marketing landing page.
- PASS/BLOCK, missing evidence, missing receipt, owner, rollback, and next
  action states remain data-driven.
