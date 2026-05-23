# Delivery Closeout Receipt Application

`Delivery Closeout Receipt Application`은 closeout receipt validation에서 `ready_to_apply`로 분리된 receipt만 Delivery Receipt Ledger에 적용한다. validation error가 있으면 아무 patch도 만들지 않고, ready receipt가 없으면 no-op artifact만 남긴다.

```bash
npm run delivery:closeout:apply
```

기본 입력:

- `artifacts/delivery-closeout-validation/latest/closeout-receipt-validation.json`
- `artifacts/delivery-execution/latest/delivery-execution-draft.json`
- `artifacts/approval-inbox-decisions/latest/patched-delivery-queue.json`
- `artifacts/approval-inbox-decisions/latest/patched-output-catalog.json`

출력:

- `closeout-receipt-application.json`
- `validated-receipts-to-apply.json`
- `delivery-receipt-ledger.json` if receipts were applied
- `patched-delivery-queue.json` if receipts were applied
- `patched-output-catalog.json` if receipts were applied
- `audit-events.json`
- `summary.md`

적용 규칙:

- validation artifact가 없으면 `blocked_missing_validation`
- validation error가 있으면 `blocked_validation_errors`
- ready receipt가 없으면 `nothing_to_apply`
- ready receipt가 있으면 `applied`

이 단계는 기존 `delivery:receipts -- --receipts <validated file>` 호출을 보호된 Control Plane 단계로 감싼 것이다. dashboard/API는 검증된 receipt와 실제 적용된 receipt를 분리해서 보여준다.
