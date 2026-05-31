# Trading Promotion Receipt Validation Rules Fixtures

`trading:promotion-receipt-validation-rules-fixtures` is the P405 regression
layer for the Trading Pack promotion receipt gate.

It consumes the P404 receipt intake queue in memory and declares the
deterministic fields and allowed decisions that future human receipt validation
must use. This phase does not receive receipt payloads, validate receipts, apply
approvals, enable promotion, submit orders, write broker or exchange state,
mutate artifacts, run commands, or execute protected actions.

Run:

```sh
npm run trading:promotion-receipt-validation-rules-fixtures -- --check
```

Default output path:

`artifacts/trading-promotion-receipt-validation-rules-fixtures/latest`
