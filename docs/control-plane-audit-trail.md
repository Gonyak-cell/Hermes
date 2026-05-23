# Control Plane Audit Trail

`Control Plane Audit Trail`은 approval, delivery receipt, closeout application, human gate receipt application, work packet receipt application에 흩어진 `audit_events`를 하나의 읽기 전용 audit view로 정규화한다. 이 단계는 protected action을 실행하지 않고, 이미 기록된 event의 출처, actor, subject, correlation, protected-action 여부를 추적 가능하게 묶는다.

## 실행

```bash
npm run control-plane:audit-trail
```

옵션:

```bash
npm run control-plane:audit-trail -- \
  --approval-decisions artifacts/approval-decisions/latest/approval-decision-result.json \
  --approval-inbox-decisions artifacts/approval-inbox-decisions/latest/approval-inbox-decision-result.json \
  --delivery-receipts artifacts/delivery-receipts/latest/delivery-receipt-ledger.json \
  --closeout-application artifacts/delivery-closeout-application/latest/closeout-receipt-application.json \
  --human-gate-application artifacts/control-plane-human-gate-receipt-application/latest/control-plane-human-gate-receipt-application.json \
  --work-packet-application artifacts/control-plane-work-packet-receipt-application/latest/control-plane-work-packet-receipt-application.json \
  --out-dir artifacts/control-plane-audit-trail/latest
```

출력:

- `control-plane-audit-trail.json`: audit trail 계약
- `audit-events.json`: 정규화된 audit event 목록
- `summary.md`: 사람이 읽는 요약

## 정규화 규칙

- 원본 event에 `id`가 있으면 `raw_event_id`로 보존하고 중복 제거 key로 사용한다.
- actor가 object이면 `actor_type`, `actor_id`, `display_name`을 유지한다.
- actor가 문자열이면 human/agent로 보수적으로 분류한다.
- subject가 표준 `{ subject_type, subject_id }`가 아니어도 gate item, work packet, packet, receipt id를 subject로 추론한다.
- `delivery.executed`는 protected action executed event로 표시한다.
- human gate/work packet application event의 `protected_action_executed: false`는 그대로 유지한다.

## Dashboard/API

Dashboard는 `control_plane_audit_trail` stage를 표시한다. Review API는 다음 route를 제공한다.

- `GET /api/audit-trails`
- `GET /api/audit-events`
- `GET /api/audit-sources`

예:

```bash
node scripts/review-api.mjs --once "/api/audit-trails?audit_status=complete"
node scripts/review-api.mjs --once "/api/audit-events?event_type=delivery.executed"
node scripts/review-api.mjs --once "/api/audit-sources?available=true"
```

## Goal 내 위치

이 단계는 `/goal`의 Event/Audit/Run Ledger 중 Audit Trail 축을 독립된 운영 artifact로 올린다. Run/Event 관측은 Observability Catalog가 맡고, 사람 승인과 protected action의 추적성은 Audit Trail이 맡는다.
