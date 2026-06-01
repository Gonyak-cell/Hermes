# Trading Promotion Receipt Chain Signoff Validation Rules Fixtures

P418 consumes P417 promotion receipt chain signoff intake rows in memory and
declares validation rules for future external signoff receipts. It does not
receive a receipt, validate a receipt, complete signoff, apply approval, enable
promotion, execute a command, mutate artifacts, or perform any protected action.

## Scope

- Source: P417 `trading:promotion-receipt-chain-signoff-intake-fixtures`.
- Output: `artifacts/trading-promotion-receipt-chain-signoff-validation-rules-fixtures/latest`.
- Workflow: `workflow.trading.promotion_receipt_chain_signoff_validation_rules_fixtures.v1`.
- Capability: `trading.promotion_receipt_chain_signoff_validation_rules_fixtures`.

## Safety Boundary

- P417 signoff intake rows are consumed in memory.
- Validation rules are declared for future signoff receipts.
- Receipts are not received, validated, applied, or converted into enablement.
- Shadow-live, limited-live, full-auto, live execution, broker writes, exchange
  writes, artifact writes, command execution, git operations, and protected
  actions remain false.

## Check

```sh
npm run trading:promotion-receipt-chain-signoff-validation-rules-fixtures -- --check
```
