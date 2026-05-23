# Control Plane Health

`Control Plane Health`는 Review Dashboard와 Control Plane Pipeline을 읽어 운영 건강도를 판정한다. 목적은 자동화 heartbeat가 다음 행동을 결정할 때 볼 수 있는 단일 health report를 만드는 것이다.

```bash
npm run control-plane:health
```

기본 입력:

- `artifacts/dashboard/latest/review-dashboard.json`
- `artifacts/control-plane-pipeline/latest/control-plane-pipeline.json`

출력:

- `control-plane-health.json`
- `summary.md`

주요 check:

- dashboard artifact availability
- pipeline artifact availability
- pipeline execution result
- dashboard overall status
- blocking gate count
- approval backlog
- dashboard action queue
- closeout receipt state

`overall_health`는 `healthy`, `attention`, `blocked`, `incomplete` 중 하나다. health 실행 후 `npm run dashboard:build`를 다시 실행하면 dashboard와 Review API에서 health check를 조회할 수 있다.
