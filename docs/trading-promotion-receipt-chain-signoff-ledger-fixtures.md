# Trading Promotion Receipt Chain Signoff Ledger Fixtures

P415 turns P414 promotion receipt chain review packets into required signoff
ledger rows. It keeps signoff pending and proves that no receipt payload,
validation, approval application, promotion enablement, live execution, broker
write, exchange write, command execution, artifact mutation, or protected action
occurs.

## Scope

- Source: P414 `trading:promotion-receipt-chain-review-fixtures`.
- Output: `artifacts/trading-promotion-receipt-chain-signoff-ledger-fixtures/latest`.
- Workflow: `workflow.trading.promotion_receipt_chain_signoff_ledger_fixtures.v1`.
- Capability: `trading.promotion_receipt_chain_signoff_ledger_fixtures`.

## Safety Boundary

- P414 review rows are consumed in memory.
- Signoff ledger rows are declared but signoff is not completed.
- Receipts are not received, validated, applied, or converted into enablement.
- Shadow-live, limited-live, full-auto, live execution, broker writes, exchange
  writes, artifact writes, command execution, git operations, and protected
  actions remain false.

## Check

```sh
npm run trading:promotion-receipt-chain-signoff-ledger-fixtures -- --check
```
