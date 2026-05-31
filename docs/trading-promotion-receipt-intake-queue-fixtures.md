# Trading Promotion Receipt Intake Queue Fixtures

`trading:promotion-receipt-intake-queue-fixtures` is the P404 regression layer
for the Trading Pack promotion receipt gate.

It consumes the P403 promotion governance read-only fixtures in memory and
projects one pending human receipt intake row for each promotion hop. The rows
are queue evidence only: they do not read receipt payloads, materialize receipt
inputs, validate receipts, apply approvals, enable promotion, submit orders,
write broker or exchange state, mutate artifacts, run commands, or execute
protected actions.

Run:

```sh
npm run trading:promotion-receipt-intake-queue-fixtures -- --check
```

Default output path:

`artifacts/trading-promotion-receipt-intake-queue-fixtures/latest`
