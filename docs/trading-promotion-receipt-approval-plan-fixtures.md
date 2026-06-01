# Trading Promotion Receipt Approval Plan Fixtures

`trading:promotion-receipt-approval-plan-fixtures` is the P410 regression layer
for the Trading Pack promotion receipt gate.

It consumes the P409 validation packet in memory and declares future approval
plan rows. This phase does not read actor workspace files, materialize receipt
input, receive payloads, validate receipts, apply approvals, enable promotion,
submit orders, write broker or exchange state, mutate artifacts, run commands,
or execute protected actions.

Run:

```sh
npm run trading:promotion-receipt-approval-plan-fixtures -- --check
```

Default output path:

`artifacts/trading-promotion-receipt-approval-plan-fixtures/latest`
