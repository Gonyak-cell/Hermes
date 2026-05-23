# Control Plane Action Plan

`Control Plane Action Plan`은 `control-plane-health.json`과 `review-dashboard.json`을 읽어 현재 막힌 일을 사람이 처리할 수 있는 순서로 정리한다. 이 단계는 protected delivery, merge, ERP 반영 같은 외부 행위를 실행하지 않고, 우선순위와 다음 명령만 기록한다.

## 실행

```bash
npm run control-plane:plan
```

옵션:

```bash
npm run control-plane:plan -- \
  --dashboard artifacts/dashboard/latest/review-dashboard.json \
  --health artifacts/control-plane-health/latest/control-plane-health.json \
  --out-dir artifacts/control-plane-action-plan/latest
```

출력:

- `control-plane-action-plan.json`: action plan 계약
- `summary.md`: 사람이 읽는 ordered action plan

## 계약

각 plan item은 다음을 가진다.

- `source_type`: `health_check`, `dashboard_action`, `source_availability`
- `source_stage`: 원인이 된 Control Plane stage
- `priority`: `critical`, `high`, `medium`, `low`
- `status`: `blocked`, `waiting_for_human`, `ready_to_run`, `open`
- `recommended_actions`: dashboard/health가 제안한 조치
- `next_commands`: 안전하게 다시 실행할 수 있는 로컬 명령
- `requires_human`: 승인, 검토, receipt 입력처럼 사람이 필요한 항목
- `protected_action`: 실제 발송, merge, 수동 delivery 같은 protected action 여부

Evidence decision 계열은 항상 human gate로 분류한다. `approve_evidence`, `reject_evidence`, `request_reextract`, `assign_matter`, `approve_or_request_changes` 같은 action은 로컬 명령 후보가 아니라 사람 판단이 필요한 승인/반려/수정 지시다. 따라서 dashboard가 evidence review를 `pending`으로 내보내면 Action Plan은 이를 `ready_to_run`이 아니라 `waiting_for_human`으로 기록한다.

## Dashboard/API

Dashboard는 `control_plane_action_plan` stage를 표시하고 summary에 action plan count를 포함한다. Review API는 다음 route를 제공한다.

- `GET /api/action-plans`
- `GET /api/action-plan-items`

예:

```bash
node scripts/review-api.mjs --once "/api/action-plan-items?requires_human=true"
node scripts/review-api.mjs --once "/api/action-plan-items?status=ready_to_run"
```

## Goal 내 위치

이 단계는 Health Report 이후의 운영 loop다. Health가 “어디가 막혔는지”를 말하면, Action Plan은 “무엇부터 처리하고 어떤 command를 다시 돌릴지”를 기록한다. 자동 실행 대신 계획만 남기므로 `/goal`의 Gate/Approval, Event/Audit, protected action 분리 원칙을 유지한다.
