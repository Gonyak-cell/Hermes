# Trading Secret Handle Boundary Fixtures

P423 consumes P422 live adapter import-boundary readiness and records the
Trading plus Desktop companion secret-handle boundary. It proves live
credentials remain external-handle/reference-only, plaintext secrets and provider
keys are absent from repo fixtures, and Desktop companion configuration stays
read-only without secret material exposure.

## Scope

- Source: P422 `trading:live-adapter-import-boundary-fixtures`.
- Output: `artifacts/trading-secret-handle-boundary-fixtures/latest`.
- Workflow: `workflow.trading.secret_handle_boundary_fixtures.v1`.
- Capability: `trading.secret_handle_boundary_fixtures`.

## Safety Boundary

- Trading credential contracts keep lookup, plaintext, and model-context secret
  exposure disabled.
- Trading secret logging forbids API key, secret, token, and credential-value
  fields.
- Desktop companion docs and Hermes example config are checked for
  read-only/no-secret posture.
- Config placeholders such as `${DMS_MCP_TOKEN}` are treated as external secret
  handles; raw provider keys, plaintext secrets, environment dumps, broker
  writes, exchange writes, artifact writes, command execution, git operations,
  and protected actions remain false.

## Check

```sh
npm run trading:secret-handle-boundary-fixtures -- --check
```
