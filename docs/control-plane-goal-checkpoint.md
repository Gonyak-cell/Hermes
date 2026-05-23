# Control Plane Goal Checkpoint

`Control Plane Goal Checkpoint`은 `/goal`의 완성 기준을 현재 artifact와 대조해 어떤 축이 통과했고 어떤 축이 아직 막혀 있는지 기록한다. 다음 heartbeat는 이 checkpoint를 기준으로 다음 작업을 고를 수 있다.

## 실행

```bash
npm run control-plane:goal-checkpoint
```

옵션:

```bash
npm run control-plane:goal-checkpoint -- \
  --dashboard artifacts/dashboard/latest/review-dashboard.json \
  --loop artifacts/control-plane-loop/latest/control-plane-loop.json \
  --health artifacts/control-plane-health/latest/control-plane-health.json \
  --roadmap docs/implementation-roadmap.md \
  --out-dir artifacts/control-plane-goal-checkpoint/latest
```

출력:

- `control-plane-goal-checkpoint.json`: `/goal` coverage checkpoint 계약
- `checkpoint-items.json`: checkpoint item 목록
- `summary.md`: 사람이 읽는 요약

## 체크 항목

- Core contracts
- Plugin-style domain packs
- Resource Expansion / Resource Ingest / Evidence Viewer
- Gate and approval workflow
- Law Firm, Personal Dev, Creative Document slices
- Output, Observability, Delivery, Matter Cockpit
- Control Plane Loop
- Dashboard/API surface

## Dashboard/API

Dashboard는 `control_plane_goal_checkpoint` stage를 표시한다. Review API는 다음 route를 제공한다.

- `GET /api/goal-checkpoints`
- `GET /api/goal-checkpoint-items`

예:

```bash
node scripts/review-api.mjs --once "/api/goal-checkpoints"
node scripts/review-api.mjs --once "/api/goal-checkpoint-items?status=attention"
```

## Goal 내 위치

이 단계는 `/goal`의 “각 단계마다 계획 대비 100% 구현 여부를 검증한 뒤 다음 단계로 넘어간다”는 원칙을 상태 artifact로 고정한다. 단순히 테스트 통과 여부가 아니라, core plane과 domain pack, runtime/approval/dashboard 계층이 목표 축별로 살아 있는지 확인한다.
