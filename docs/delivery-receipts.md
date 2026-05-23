# Delivery Receipts

`Delivery Receipts`는 사람이 실제로 수행한 수동 전달, GitHub merge, 문서 export 결과를 receipt로 기록하고 audit event와 delivered 상태 patch를 만든다.

```bash
npm run delivery:receipts
```

기본 입력:

- `artifacts/delivery-execution/latest/delivery-execution-draft.json`
- `artifacts/delivery-receipts/latest/receipt-template.json`
- `artifacts/approval-inbox-decisions/latest/patched-delivery-queue.json`
- `artifacts/approval-inbox-decisions/latest/patched-output-catalog.json`

출력:

- `delivery-receipt-ledger.json`
- `receipt-template.json`
- `patched-delivery-queue.json`
- `patched-output-catalog.json`
- `audit-events.json`
- `summary.md`

receipt input이 없거나 `pending`이면 delivered patch를 만들지 않는다. 사람이 실제 작업을 마친 뒤 `receipt_status`, `executed_by`, `executed_at`, `delivery_reference`를 채운 경우에만 `delivery.executed` audit event와 delivered 상태 patch가 생성된다.
