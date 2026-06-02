# Zendd Boundary

`project:zendd-boundary` is the P526-P540 verifier for registering Zendd as a
read-only Hermes subproject under the `law-firm` domain pack without moving the
Zendd code directory.

## Command

```bash
npm run project:zendd-boundary -- --check
```

Optional:

```bash
npm run project:zendd-boundary -- --zendd-root <path>
```

## Outputs

- `artifacts/zendd-boundary/latest/zendd-boundary.json`
- `artifacts/zendd-boundary/latest/project-zendd-registration.json`
- `artifacts/zendd-boundary/latest/observation-policy-rows.json`
- `artifacts/zendd-boundary/latest/zendd-command-catalog-rows.json`
- `artifacts/zendd-boundary/latest/prohibited-operation-rows.json`
- `artifacts/zendd-boundary/latest/blocked-capability-ledger-rows.json`
- `artifacts/zendd-boundary/latest/validation-report.json`
- `artifacts/zendd-boundary/latest/summary.md`

## Boundary Rules

- Zendd remains an external execution engine. Hermes registers `project.zendd`
  as a read-only, reference-only subproject.
- The command catalogs Zendd package scripts but does not run Zendd commands.
- Raw VDR files, raw client documents, `.env` files, and secret values are not
  valid Hermes inputs.
- Dirty Zendd rows block mutation until a human-reviewed receipt is recorded.
- Protected Zendd claims cannot PASS from `complete`, `ready`, `done`, or
  `accepted` status alone. They need evidence, reviewer or hard gate, and
  human receipt when protected.
- Physical code movement remains deferred until P741-P760.
