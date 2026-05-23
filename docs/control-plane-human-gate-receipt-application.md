# Control Plane Human Gate Receipt Application

`Control Plane Human Gate Receipt Application`은 validation gate를 통과한 human gate receipt만 gate ledger에 반영한다. 이 단계는 evidence 승인, output 발송, merge, ERP 반영 같은 protected action을 실행하지 않고, 적용된 receipt와 patched gate item, audit event만 생성한다.

## 실행

```bash
npm run control-plane:human-gate-receipts:apply
```

옵션:

```bash
npm run control-plane:human-gate-receipts:apply -- \
  --validation artifacts/control-plane-human-gate-receipt-validation/latest/control-plane-human-gate-receipt-validation.json \
  --human-gates artifacts/control-plane-human-gates/latest/control-plane-human-gates.json \
  --out-dir artifacts/control-plane-human-gate-receipt-application/latest
```

출력:

- `control-plane-human-gate-receipt-application.json`: application 결과 계약
- `validated-human-gate-receipts.json`: 입력으로 받은 검증 완료 receipt
- `applied-human-gate-receipts.json`: 실제 적용된 receipt 목록
- `audit-events.json`: `human_gate.receipt.applied` audit event
- `patched-human-gate-items.json`: 적용 receipt가 있을 때만 생성되는 gate 상태 patch
- `summary.md`: 사람이 읽는 적용 요약

## 적용 규칙

- validation artifact가 없으면 `blocked_missing_validation`
- human gates artifact가 없으면 `blocked_missing_human_gates`
- validation error가 있으면 `blocked_validation_errors`
- 검증 완료 receipt가 없으면 `nothing_to_apply`
- 검증 완료 receipt가 있으면 gate item patch와 audit event를 생성
- `protected_actions_executed`는 항상 `false`
- patched gate item에도 `protected_action_executed: false`를 남긴다

이 단계는 pending receipt를 자동 완료 처리하지 않는다. 또한 receipt가 evidence 승인이나 protected delivery를 지시하더라도 실제 외부 action은 별도 사람이 수행하고, 그 사실만 다음 receipt로 기록해야 한다.

## Dashboard/API

Dashboard는 `control_plane_human_gate_receipt_application` stage를 표시한다. Review API는 다음 route를 제공한다.

- `GET /api/human-gate-receipt-applications`
- `GET /api/applied-human-gate-receipts`
- `GET /api/patched-human-gate-items`

예:

```bash
node scripts/review-api.mjs --once "/api/human-gate-receipt-applications?application_status=nothing_to_apply"
node scripts/review-api.mjs --once "/api/applied-human-gate-receipts"
node scripts/review-api.mjs --once "/api/patched-human-gate-items"
```

## Goal 내 위치

이 단계는 Human Approval과 Audit Trail 사이의 application 경계다. 사람이 검토한 receipt만 gate 상태를 닫게 하되, protected action 실행은 계속 분리하여 matter boundary, evidence lineage, audit trail을 보존한다.
