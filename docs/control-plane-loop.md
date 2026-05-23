# Control Plane Loop

`Control Plane Loop`은 heartbeat에서 반복하던 운영 명령 묶음을 하나의 재현 가능한 ledger로 실행한다. protected delivery, merge, ERP 반영 같은 외부 행위는 실행하지 않고, 이미 draft-only로 구현된 검증/계획/receipt 단계만 순서대로 돌린다.

## 실행

```bash
npm run control-plane:loop
```

기본 실행 순서:

- `npm run control-plane:pipeline`
- `npm run dashboard:build`
- `npm run control-plane:health`
- `npm run control-plane:plan`
- `npm run control-plane:work-packets`
- `npm run control-plane:work-receipts`
- `npm run control-plane:work-receipts:validate`
- `npm run control-plane:work-receipts:apply`
- `npm run evidence:review:draft`
- `node scripts/review-dashboard.mjs --no-control-plane-goal-checkpoint`
- `npm run control-plane:goal-checkpoint`
- `npm run dashboard:build`
- `npm run api:smoke`

출력:

- `control-plane-loop.json`: loop step별 command, exit code, artifact check ledger
- `summary.md`: 사람이 읽는 loop 요약

## 계약

- `loop_status`: `passed`, `partial`, `failed`, `artifact_missing`
- `step_results`: 각 명령의 stdout/stderr, duration, expected artifact 결과
- `continue_on_error`: 실패 후 다음 단계까지 계속 확인했는지 여부

## Dashboard/API

Dashboard는 `control_plane_loop` stage를 표시한다. Review API는 다음 route를 제공한다.

- `GET /api/control-plane-loops`
- `GET /api/control-plane-loop-steps`

예:

```bash
node scripts/review-api.mjs --once "/api/control-plane-loops?loop_status=passed"
node scripts/review-api.mjs --once "/api/control-plane-loop-steps?status=passed"
```

## Goal 내 위치

이 단계는 `/goal`의 “각 단계마다 계획 대비 100% 구현 여부를 검증한 뒤 다음 단계로 넘어간다”는 원칙을 자동화한다. 이후 heartbeat는 여러 명령을 기억으로 이어 붙이지 않고, `control-plane:loop` artifact를 기준으로 현재 상태와 다음 작업을 판단할 수 있다.
