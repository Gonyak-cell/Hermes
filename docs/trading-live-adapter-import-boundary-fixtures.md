# Trading Live Adapter Import Boundary Fixtures

P422 consumes P421 broker adapter separation readiness and records the future
live-adapter import boundary. It proves default package, validation, pack
manifest, capability entrypoint, and governance paths do not import or enable
future live adapter files while credentials remain reference-only.

## Scope

- Source: P421 `trading:broker-adapter-separation-fixtures`.
- Output: `artifacts/trading-live-adapter-import-boundary-fixtures/latest`.
- Workflow: `workflow.trading.live_adapter_import_boundary_fixtures.v1`.
- Capability: `trading.live_adapter_import_boundary_fixtures`.

## Safety Boundary

- P421 broker adapter separation is ready.
- Default command, validation, pack, and capability paths contain no future
  live-adapter import references.
- A future live adapter file path is reference-only and is not read, imported,
  or executed by this fixture.
- Credential references remain disabled/reference-only; plaintext secrets,
  provider keys, environment dumps, and model-context secrets stay absent.
- Live execution, order submission, broker writes, exchange writes, artifact
  reads/writes, command execution, git operations, and protected actions remain
  false.

## Check

```sh
npm run trading:live-adapter-import-boundary-fixtures -- --check
```
