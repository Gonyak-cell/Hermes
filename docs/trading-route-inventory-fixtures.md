# Trading Route Inventory Fixtures

Status: P382 command specification.

`trading:route-inventory-fixtures` consumes the P381 safety regression fixture
source plus the Trading dashboard/API stubs and builds read-only route inventory
fixtures. The command fails if an unsafe Trading route family is active:
mutating Trading routes, broker/credential routes, live broker write routes, or
generic order submission routes.

The command also keeps the blocked-route evidence explicit. Unsafe route
families may appear only in `disabled_routes`, with human-review reasons that
explain why live trading, credentials, broker writes, exchange writes, or order
submission remain unavailable.

## Command

```sh
npm run trading:route-inventory-fixtures -- --check
```

`--check` validates the route inventory without overwriting existing artifacts.
Without `--check`, generated reports are written under
`artifacts/trading-route-inventory-fixtures/latest/`.

## Safety Boundary

- Active Trading routes must remain read-only `GET` routes.
- `dashboard_api_stub.mutating_routes_enabled` must remain `false`.
- Broker credentials, live broker writes, exchange writes, live order
  submission, generic order submission, command execution, artifact mutation,
  release publication, git operations, and protected actions stay disabled.
- Human approval remains required before any future route promotion can become
  executable.
