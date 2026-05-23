# Control Plane Work Packet Receipt Application

`Control Plane Work Packet Receipt Application`은 validation gate를 통과한 work packet receipt만 적용한다. 현재 pending receipt는 아무 상태도 바꾸지 않고 `nothing_to_apply`로 기록한다.

## 실행

```bash
npm run control-plane:work-receipts:apply
```

옵션:

```bash
npm run control-plane:work-receipts:apply -- \
  --validation artifacts/control-plane-work-packet-receipt-validation/latest/control-plane-work-packet-receipt-validation.json \
  --work-packets artifacts/control-plane-work-packets/latest/control-plane-work-packets.json \
  --out-dir artifacts/control-plane-work-packet-receipt-application/latest
```

출력:

- `control-plane-work-packet-receipt-application.json`: application 결과 계약
- `validated-work-packet-receipts.json`: 입력으로 받은 검증 완료 receipt
- `applied-work-packet-receipts.json`: 실제 적용된 receipt 목록
- `audit-events.json`: 적용 audit event

## 적용 규칙

- validation artifact가 없으면 `blocked_missing_validation`
- work packet artifact가 없으면 `blocked_missing_work_packets`
- validation error가 있으면 `blocked_validation_errors`
- 검증 완료 receipt가 없으면 `nothing_to_apply`
- 검증 완료 receipt가 있으면 packet/work item patch와 audit event를 생성

이 단계는 pending receipt를 자동 완료 처리하지 않는다.

## Dashboard/API

Dashboard는 `control_plane_work_packet_receipt_application` stage를 표시한다. Review API는 다음 route를 제공한다.

- `GET /api/work-packet-receipt-applications`
- `GET /api/applied-work-packet-receipts`

예:

```bash
node scripts/review-api.mjs --once "/api/work-packet-receipt-applications?application_status=nothing_to_apply"
node scripts/review-api.mjs --once "/api/applied-work-packet-receipts"
```

## Goal 내 위치

이 단계는 work packet closeout loop의 application 경계다. validation을 통과한 receipt만 상태 변경과 audit event를 만들게 하여, 사람 승인과 protected action의 추적성을 유지한다.
