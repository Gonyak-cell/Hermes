# Trading Promotion Receipt Approval Closeout Fixtures

P411 adds the read-only approval closeout layer for trading promotion receipt
fixtures. It consumes P410 approval plans in memory, declares future closeout
rows for each promotion stage, and keeps every receipt payload, validation,
approval application, enablement, command, artifact, broker, and exchange write
disabled.

## Scope

- Source: P410 `trading:promotion-receipt-approval-plan-fixtures`.
- Output: `artifacts/trading-promotion-receipt-approval-closeout-fixtures/latest`.
- Workflow: `workflow.trading.promotion_receipt_approval_closeout_fixtures.v1`.
- Capability: `trading.promotion_receipt_approval_closeout_fixtures`.

## Safety Boundary

- Actor workspace files are not read.
- Receipt input files and merged receipt inputs are not materialized.
- Receipt payloads are not received or validated.
- Approval closeout rows are declared for future human action only.
- Approvals are not applied and promotion enablement stays false.
- Shadow-live, limited-live, full-auto, live execution, broker writes, exchange
  writes, artifact writes, command execution, git operations, and protected
  actions remain false.

## Check

```sh
npm run trading:promotion-receipt-approval-closeout-fixtures -- --check
```
