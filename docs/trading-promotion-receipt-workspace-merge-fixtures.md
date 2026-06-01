# Trading Promotion Receipt Workspace Merge Fixtures

`trading:promotion-receipt-workspace-merge-fixtures` is the P407 regression
layer for the Trading Pack promotion receipt gate.

It consumes the P406 receipt workspace in memory and declares future merge rows.
This phase does not materialize merged receipt input, receive payloads, merge
workspace files, validate receipts, apply approvals, enable promotion, submit
orders, write broker or exchange state, mutate artifacts, run commands, or
execute protected actions.

Run:

```sh
npm run trading:promotion-receipt-workspace-merge-fixtures -- --check
```

Default output path:

`artifacts/trading-promotion-receipt-workspace-merge-fixtures/latest`
