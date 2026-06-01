# Trading Promotion Receipt Chain Regression Fixtures

P413 indexes the P401-P412 promotion receipt chain after the closeout layer. It
verifies every chain command is registered in `package.json`, present in
`npm run validate`, and recorded in the platform operations ledger while keeping
the chain read-only.

## Scope

- Source: P412 `trading:promotion-receipt-closeout-fixtures`.
- Output: `artifacts/trading-promotion-receipt-chain-regression-fixtures/latest`.
- Workflow: `workflow.trading.promotion_receipt_chain_regression_fixtures.v1`.
- Capability: `trading.promotion_receipt_chain_regression_fixtures`.

## Safety Boundary

- P401-P412 readiness is consumed in memory.
- Actor workspace files, receipt payloads, and approval artifacts are not read.
- Receipts are not received, validated, applied, or converted into enablement.
- Shadow-live, limited-live, full-auto, live execution, broker writes, exchange
  writes, artifact writes, command execution, git operations, and protected
  actions remain false.

## Check

```sh
npm run trading:promotion-receipt-chain-regression-fixtures -- --check
```
