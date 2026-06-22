# Hermes MCP Client Setup Runbook

Status: H-MCP-06 client setup

## Stdio Command

Use this command for npm-backed MCP clients:

```sh
npm --silent run mcp:serve
```

Direct launch is also valid:

```sh
node scripts/hermes-mcp-readonly-server.mjs --stdio
```

## Smoke Flow

1. Send `initialize` and expect protocol `2025-06-18`.
2. Send `resources/list` and expect the Hermes read-model resources.
3. Send `resources/read` for `hermes://status` and verify authority flags remain false.
4. Send `tools/call` for `hermes.validate.core` with `{"check_only": true}` and expect a check-only result.
5. Send `tools/call` with `{"check_only": false}` and expect JSON-RPC error `-32602`.

No client setup may enable write, deploy, receipt application, protected approval, production PASS, enterprise trust, raw secret, or raw restricted payload authority.
