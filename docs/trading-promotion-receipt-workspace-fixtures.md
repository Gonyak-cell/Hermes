# Trading Promotion Receipt Workspace Fixtures

`trading:promotion-receipt-workspace-fixtures` is the P406 regression layer for
the Trading Pack promotion receipt gate.

It consumes the P405 validation-rule fixture chain in memory and projects one
human-editable receipt workspace row for each promotion stage. This command does
not materialize receipt input files, receive payloads, validate receipts, apply
approvals, enable promotion, submit orders, write broker or exchange state,
mutate artifacts, run commands, or execute protected actions.

Run:

```sh
npm run trading:promotion-receipt-workspace-fixtures -- --check
```

Default output path:

`artifacts/trading-promotion-receipt-workspace-fixtures/latest`
