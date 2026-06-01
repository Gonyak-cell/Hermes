# Trading Promotion Receipt Merge Preflight Fixtures

`trading:promotion-receipt-merge-preflight-fixtures` is the P408 regression
layer for the Trading Pack promotion receipt gate.

It consumes the P407 workspace merge in memory and declares future merge
validation preflight rows. This phase does not read actor workspace files,
materialize receipt input, receive payloads, validate receipts, apply approvals,
enable promotion, submit orders, write broker or exchange state, mutate
artifacts, run commands, or execute protected actions.

Run:

```sh
npm run trading:promotion-receipt-merge-preflight-fixtures -- --check
```

Default output path:

`artifacts/trading-promotion-receipt-merge-preflight-fixtures/latest`
