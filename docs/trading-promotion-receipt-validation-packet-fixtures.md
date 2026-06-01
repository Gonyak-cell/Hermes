# Trading Promotion Receipt Validation Packet Fixtures

`trading:promotion-receipt-validation-packet-fixtures` is the P409 regression
layer for the Trading Pack promotion receipt gate.

It consumes the P408 merge preflight in memory and declares future validation
packet rows. This phase does not read actor workspace files, materialize receipt
input, receive payloads, validate receipts, apply approvals, enable promotion,
submit orders, write broker or exchange state, mutate artifacts, run commands,
or execute protected actions.

Run:

```sh
npm run trading:promotion-receipt-validation-packet-fixtures -- --check
```

Default output path:

`artifacts/trading-promotion-receipt-validation-packet-fixtures/latest`
