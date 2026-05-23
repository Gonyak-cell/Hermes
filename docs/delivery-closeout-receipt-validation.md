# Delivery Closeout Receipt Validation

`Delivery Closeout Receipt Validation`은 사람이 채운 closeout receipt input을 `delivery:receipts`에 적용하기 전에 검증한다. closeout packet과 artifact id가 맞고, 감사 재현에 필요한 실행자, 실행시각, 전달 reference가 있는 receipt만 `validated-receipts-to-apply.json`으로 분리한다.

```bash
npm run delivery:closeout:validate
```

기본 입력:

- `artifacts/delivery-closeout/latest/delivery-closeout-queue.json`
- `artifacts/delivery-closeout/latest/receipt-input-draft.json`

출력:

- `closeout-receipt-validation.json`
- `validated-receipts-to-apply.json`
- `summary.md`

검증 규칙:

- closeout queue 밖의 packet receipt는 `unknown_packet`
- receipt가 없으면 `missing_receipt`
- `pending` receipt는 아직 적용하지 않음
- `delivered`, `failed`, `cancelled` receipt는 `executed_by`, `executed_at`이 필요
- `delivered` receipt는 `delivery_reference`가 필요
- `delivered_artifact_ids`는 closeout packet의 artifact ids와 일치해야 함

`ready_to_apply` receipt만 `validated-receipts-to-apply.json`에 들어간다. 이후 `npm run delivery:receipts -- --receipts artifacts/delivery-closeout-validation/latest/validated-receipts-to-apply.json`를 실행한다.
