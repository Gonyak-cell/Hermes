# Control Plane Work Packets

`Control Plane Work Packets`는 `control-plane-action-plan.json`의 plan item을 운영자가 처리할 수 있는 묶음으로 재구성한다. Action Plan이 “무엇이 막혔는지”를 말한다면, Work Packets는 “어떤 묶음부터 처리할지”를 말한다.

## 실행

```bash
npm run control-plane:work-packets
```

옵션:

```bash
npm run control-plane:work-packets -- \
  --action-plan artifacts/control-plane-action-plan/latest/control-plane-action-plan.json \
  --out-dir artifacts/control-plane-work-packets/latest
```

출력:

- `control-plane-work-packets.json`: work packet 계약
- `summary.md`: 사람이 읽는 작업 묶음 요약

## Packet 유형

- `protected_action`: delivery, merge 등 harness가 직접 실행하지 않는 보호 작업
- `human_review`: 승인, gate review, receipt 입력처럼 사람이 결정해야 하는 작업
- `command_rerun`: 안전한 로컬 명령만 다시 실행하면 되는 작업
- `stage_recheck`: blocker가 해결된 뒤 관련 stage를 다시 확인해야 하는 작업
- `investigation`: 원인 artifact를 사람이 살펴봐야 하는 작업
- `source_recovery`: action plan 자체가 없거나 읽히지 않는 경우

각 packet은 `priority`, `status`, `requires_human`, `protected_action`, `checklist`, `next_commands`를 가진다. protected packet은 실행하지 않고 기록과 검증 루프만 안내한다.

## Dashboard/API

Dashboard는 `control_plane_work_packets` stage를 표시하고 summary에 packet/item count를 포함한다. Review API는 다음 route를 제공한다.

- `GET /api/action-work-packets`
- `GET /api/action-work-items`

예:

```bash
node scripts/review-api.mjs --once "/api/action-work-packets?protected_action=true"
node scripts/review-api.mjs --once "/api/action-work-items?source_stage=matter_cockpit"
```

## Goal 내 위치

이 단계는 Control Plane 운영 loop의 handoff 계층이다. 자동 실행과 사람 작업을 섞지 않고, protected action과 human review를 packet 단위로 분리해 Gate/Approval 원칙을 유지한다.
