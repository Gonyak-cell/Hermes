# Control Plane Work Packet Receipt Validation

`Control Plane Work Packet Receipt Validation`은 사람이 채운 work packet receipt input을 적용하기 전에 검사한다. 이 단계는 packet을 닫거나 상태를 변경하지 않고, 적용 가능한 receipt만 `validated-work-packet-receipts.json`으로 분리한다.

## 실행

```bash
npm run control-plane:work-receipts:validate
```

옵션:

```bash
npm run control-plane:work-receipts:validate -- \
  --receipt-drafts artifacts/control-plane-work-packet-receipts/latest/control-plane-work-packet-receipt-drafts.json \
  --receipt-input artifacts/control-plane-work-packet-receipts/latest/receipt-input-draft.json \
  --out-dir artifacts/control-plane-work-packet-receipt-validation/latest
```

출력:

- `control-plane-work-packet-receipt-validation.json`: validation item과 오류 계약
- `validated-work-packet-receipts.json`: 향후 application 단계에 넘길 검증 완료 receipt
- `summary.md`: 사람이 읽는 검증 요약

## Validation 규칙

- `pending` receipt는 오류가 아니라 대기 상태다.
- 적용 후보 status는 `resolved`, `deferred`, `cancelled`, `failed`다.
- non-pending receipt는 `resolved_by`, `resolved_at`, `resolution_reference`, `resolution_notes`를 가져야 한다.
- human packet은 `reviewer`가 필요하다.
- protected packet은 `protected_action_reference`가 필요하다.
- command packet은 `command_result`가 `passed`, `failed`, `skipped`, `not_applicable` 중 하나여야 한다.
- `resolved` receipt는 해당 packet의 모든 `work_item_id`를 `completed_work_item_ids`에 포함해야 한다.

## Dashboard/API

Dashboard는 `control_plane_work_packet_receipt_validation` stage를 표시한다. Review API는 다음 route를 제공한다.

- `GET /api/work-packet-receipt-validations`
- `GET /api/work-packet-receipt-errors`
- `GET /api/validated-work-packet-receipts`

예:

```bash
node scripts/review-api.mjs --once "/api/work-packet-receipt-validations?validation_status=pending_receipt"
node scripts/review-api.mjs --once "/api/validated-work-packet-receipts"
```

## Goal 내 위치

이 단계는 work packet closeout loop의 gate다. 앞으로 application 단계가 생기더라도, validated receipt만 적용하게 만들어 protected action과 human approval의 audit 경계를 유지한다.
