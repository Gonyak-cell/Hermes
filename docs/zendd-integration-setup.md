# Zendd Integration Setup

`project:zendd-integration-setup` is the P521-P525 read-only setup command for
the Zendd-Hermes integration program.

## Command

```bash
npm run project:zendd-integration-setup -- --check
```

Optional:

```bash
npm run project:zendd-integration-setup -- --zendd-root <path>
```

## Outputs

- `artifacts/zendd-integration-setup/latest/zendd-integration-setup.json`
- `artifacts/zendd-integration-setup/latest/integration-adr.json`
- `artifacts/zendd-integration-setup/latest/zendd-baseline.json`
- `artifacts/zendd-integration-setup/latest/dirty-tree-safety-inventory-rows.json`
- `artifacts/zendd-integration-setup/latest/feature-parity-matrix-rows.json`
- `artifacts/zendd-integration-setup/latest/project-zendd-boundary-contract.json`
- `artifacts/zendd-integration-setup/latest/zendd-integration-gate-rows.json`
- `artifacts/zendd-integration-setup/latest/validation-report.json`
- `artifacts/zendd-integration-setup/latest/summary.md`

## Safety Boundary

- `--check` validates without writing artifacts.
- The command observes package metadata, `pyproject.toml`, feature marker files,
  `git rev-parse`, and `git status --short` only.
- It does not run Zendd application commands, tests, builds, migrations,
  packaging, server startup, database writes, or Electron startup.
- It does not open `.env`, secret files, credential values, or raw VDR material.
- All Zendd mutations remain blocked until later phases create explicit work
  orders and receipt-backed gates.
