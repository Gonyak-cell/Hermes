# Trading Promotion Receipt Closeout Fixtures

P412 closes the read-only promotion receipt fixture chain. It consumes P411
approval closeout rows in memory, marks the P401-P412 chain ready for the next
regression slice, and keeps human receipts pending rather than materializing,
validating, or applying them.

## Scope

- Source: P411 `trading:promotion-receipt-approval-closeout-fixtures`.
- Output: `artifacts/trading-promotion-receipt-closeout-fixtures/latest`.
- Workflow: `workflow.trading.promotion_receipt_closeout_fixtures.v1`.
- Capability: `trading.promotion_receipt_closeout_fixtures`.

## Safety Boundary

- Actor workspace files are not read.
- Receipt input files and merged receipt inputs are not materialized.
- Receipt payloads are not received or validated.
- Human receipts remain pending and are not converted into approvals.
- Promotion enablement stays false.
- Shadow-live, limited-live, full-auto, live execution, broker writes, exchange
  writes, artifact writes, command execution, git operations, and protected
  actions remain false.

## Check

```sh
npm run trading:promotion-receipt-closeout-fixtures -- --check
```
