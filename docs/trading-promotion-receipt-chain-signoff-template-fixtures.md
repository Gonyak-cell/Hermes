# Trading Promotion Receipt Chain Signoff Template Fixtures

P416 turns P415 promotion receipt chain signoff ledger rows into human-fillable
signoff templates. It keeps template materialization and signoff pending and
proves that no receipt payload, validation, approval application, promotion
enablement, live execution, broker write, exchange write, command execution,
artifact mutation, or protected action occurs.

## Scope

- Source: P415 `trading:promotion-receipt-chain-signoff-ledger-fixtures`.
- Output: `artifacts/trading-promotion-receipt-chain-signoff-template-fixtures/latest`.
- Workflow: `workflow.trading.promotion_receipt_chain_signoff_template_fixtures.v1`.
- Capability: `trading.promotion_receipt_chain_signoff_template_fixtures`.

## Safety Boundary

- P415 signoff ledger rows are consumed in memory.
- Signoff template rows are declared but not materialized or completed.
- Receipts are not received, validated, applied, or converted into enablement.
- Shadow-live, limited-live, full-auto, live execution, broker writes, exchange
  writes, artifact writes, command execution, git operations, and protected
  actions remain false.

## Check

```sh
npm run trading:promotion-receipt-chain-signoff-template-fixtures -- --check
```
