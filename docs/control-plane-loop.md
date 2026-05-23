# Control Plane Loop

`Control Plane Loop`은 heartbeat에서 반복하던 운영 명령 묶음을 하나의 재현 가능한 ledger로 실행한다. protected delivery, merge, ERP 반영 같은 외부 행위는 실행하지 않고, 이미 draft-only로 구현된 검증/계획/receipt 단계만 순서대로 돌린다.

## 실행

```bash
npm run control-plane:loop
```

기본 실행 순서:

- `npm run policy:catalog`
- `npm run policy:snapshots`
- `npm run control-plane:pipeline`
- `npm run context:packets`
- `npm run model:routing`
- `npm run cost:budgets`
- `npm run token:usage`
- `npm run cost:attribution`
- `npm run budget:alerts`
- `node scripts/review-dashboard.mjs --no-human-review-agenda --no-human-review-agenda-intake --no-human-review-receipt-workspace --no-human-review-receipt-workspace-merge --no-human-review-context-bundle --no-human-review-decision-register --no-human-review-decision-register-merge --no-human-review-validation-feedback --no-human-review-correction-workspace --no-human-review-correction-workspace-merge --no-human-review-correction-validation --no-human-review-correction-feedback --no-human-review-cycle-ledger --no-human-review-cycle-work-orders --no-human-review-cycle-target-audit --no-human-review-cycle-triage --no-human-review-cycle-console --no-human-review-cycle-field-audit --no-human-review-cycle-completion-pack --no-human-review-cycle-completion-verification --no-human-review-cycle-completion-workbench`
- `npm run control-plane:health`
- `npm run control-plane:plan`
- `npm run control-plane:human-gates`
- `npm run control-plane:human-gate-receipts`
- `npm run control-plane:review-packets`
- `npm run control-plane:review-agenda`
- `npm run control-plane:review-agenda:intake`
- `npm run control-plane:review-workspace`
- `npm run control-plane:review-workspace:merge`
- `npm run control-plane:review-context`
- `npm run control-plane:review-decisions`
- `npm run control-plane:review-decisions:merge`
- `node scripts/control-plane-human-gate-receipt-validation.mjs --receipt-input artifacts/human-review-decision-register-merge/latest/receipt-input.json`
- `npm run control-plane:review-feedback`
- `npm run control-plane:review-corrections`
- `npm run control-plane:review-corrections:merge`
- `npm run control-plane:review-corrections:validate`
- `npm run control-plane:review-corrections:feedback`
- `npm run control-plane:review-cycle`
- `npm run control-plane:review-cycle:work-orders`
- `npm run control-plane:review-cycle:target-audit`
- `npm run control-plane:review-cycle:triage`
- `npm run control-plane:review-cycle:console`
- `npm run control-plane:review-cycle:field-audit`
- `npm run control-plane:review-cycle:completion-pack`
- `npm run control-plane:review-cycle:completion-verify`
- `npm run control-plane:review-cycle:completion-workbench`
- `npm run control-plane:review-cycle:completion-runbook`
- `npm run control-plane:review-cycle:completion-readiness`
- `npm run control-plane:review-cycle:completion-command-queue`
- `npm run control-plane:review-cycle:completion-command-receipts`
- `npm run control-plane:human-gate-receipts:apply`
- `npm run control-plane:work-packets`
- `npm run control-plane:work-receipts`
- `npm run control-plane:work-receipts:validate`
- `npm run control-plane:work-receipts:apply`
- `npm run control-plane:audit-trail`
- `npm run evidence:review:draft`
- `node scripts/review-dashboard.mjs --no-control-plane-goal-checkpoint`
- `npm run control-plane:goal-checkpoint`
- `npm run dashboard:build`
- `npm run api:smoke`

기본 CLI는 loop ledger를 최종 저장한 뒤 post-loop finalization도 실행한다.

- `npm run control-plane:goal-checkpoint`
- `npm run dashboard:build`
- `npm run api:smoke`

이 finalization은 dashboard와 goal checkpoint가 방금 완료된 `control-plane-loop.json`을 읽도록 맞추는 동기화 단계다. 필요하면 `node scripts/control-plane-loop.mjs --no-finalize`로 끌 수 있다.

출력:

- `control-plane-loop.json`: loop step별 command, exit code, artifact check ledger
- `control-plane-loop-finalization.json`: 최종 loop artifact 저장 후 checkpoint/dashboard/API 재검증 결과
- `summary.md`: 사람이 읽는 loop 요약
- `finalization-summary.md`: finalization 요약

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
