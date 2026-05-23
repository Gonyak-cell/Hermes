# Delivery Closeout Queue

`Delivery Closeout Queue`는 post-delivery reconciliation에서 아직 닫히지 않은 receipt를 사람이 처리할 수 있는 closeout item으로 바꾼다. 이 단계도 protected action을 실행하지 않고, 수동 실행 checklist와 receipt input draft만 생성한다.

```bash
npm run delivery:closeout
```

기본 입력:

- `artifacts/post-delivery-reconciliation/latest/post-delivery-reconciliation.json`
- `artifacts/delivery-execution/latest/delivery-execution-draft.json`
- `artifacts/delivery-receipts/latest/receipt-template.json`
- `artifacts/delivery-receipts/latest/patched-output-catalog.json`

출력:

- `delivery-closeout-queue.json`
- `receipt-input-draft.json`
- `summary.md`

핵심 계약:

- `closeout_items`: packet별 수동 실행 대상, checklist, artifact context, receipt form draft
- `receipt_input_draft`: `npm run delivery:receipts -- --receipts <path>`에 넣을 수 있는 pending receipt 초안

사람이 실제 전달, export, merge를 수행한 뒤 `receipt_input_draft.receipts`의 `receipt_status`, `executed_by`, `executed_at`, `delivery_reference`, `notes`를 채우고 `npm run delivery:receipts`, `npm run delivery:reconcile`, `npm run dashboard:build`를 다시 실행한다.
