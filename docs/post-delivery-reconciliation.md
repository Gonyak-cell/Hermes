# Post-Delivery Reconciliation

`Post-Delivery Reconciliation`은 delivery receipt가 반영된 delivery queue와 output catalog를 다시 읽어 matter/project별 최종 전달 상태를 합산한다. 이 단계는 실제 발송이나 merge를 수행하지 않고, receipt 이후의 운영 view만 만든다.

```bash
npm run delivery:reconcile
```

기본 입력:

- `artifacts/delivery-receipts/latest/delivery-receipt-ledger.json`
- `artifacts/delivery-receipts/latest/patched-delivery-queue.json`
- `artifacts/delivery-receipts/latest/patched-output-catalog.json`

출력:

- `post-delivery-reconciliation.json`
- `summary.md`

핵심 계약:

- `reconciled_matters`: matter/project별 delivered, ready, awaiting receipt, blocked 상태
- `delivered_artifacts`: receipt가 반영되어 delivered가 된 output artifact 목록
- `outstanding_receipts`: 아직 receipt가 없어 delivered로 닫히지 않은 packet 목록

이 산출물은 Review Dashboard의 `post_delivery_reconciliation` stage와 Review API의 `/api/post-delivery-matters`, `/api/delivered-artifacts`, `/api/outstanding-receipts`에서 읽는다.
