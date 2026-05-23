# Matter Cockpit

`Matter Cockpit`은 Resource/Evidence, Output Artifact Catalog, Observability Catalog, Protected Delivery Queue를 matter/project 단위로 묶는 읽기 전용 운영 표면이다.

```bash
npm run matter:cockpit
```

기본 입력:

- `artifacts/resource-ingest/latest/resource-evidence.json`
- `artifacts/output-catalog/latest/output-catalog.json`
- `artifacts/observability/latest/observability-catalog.json`
- `artifacts/delivery-queue/latest/protected-delivery-queue.json`

출력:

- `matter-cockpit.json`
- `summary.md`

각 matter record는 resource/evidence count, output count, workflow run count, delivery action count, approval/gate blocker, runtime seconds, delivery channel을 함께 보여준다.

이 단계는 `/goal`의 Matter Boundary와 dashboard/API 완성 기준을 연결한다. 기능별 카탈로그가 늘어나도 실제 사용자는 matter/project 기준으로 현재 상태와 막힌 지점을 볼 수 있다.
