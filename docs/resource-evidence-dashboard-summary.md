# Resource/Evidence Dashboard Summary

Resource/Evidence Dashboard Summary는 Resource/Evidence Plane의 운영 상태를 한 번에 보기 위한 read-only projection이다.

이 산출물은 다음 소스를 다시 계산하지 않고 요약한다.

- Resource Ingest
- Resource Store Interface
- Resource Quarantine Model
- Evidence Item Store
- Evidence Viewer Data API
- Evidence Coverage Score
- Evidence Export Bundle
- Evidence Regression Tests

## Command

```bash
npm run resource:evidence-dashboard -- --check
```

생성 위치:

- `artifacts/resource-evidence-dashboard/latest/resource-evidence-dashboard-summary.json`
- `artifacts/resource-evidence-dashboard/latest/panel-rows.json`
- `artifacts/resource-evidence-dashboard/latest/matter-rollups.json`
- `artifacts/resource-evidence-dashboard/latest/classification-rollups.json`

## Guardrails

- 이 단계는 조회 전용이다.
- quarantine, evidence review, coverage review, export review 상태를 승인하지 않는다.
- client-facing ready count는 반드시 0이어야 한다.
- 외부 서비스 호출 없이 기존 artifact만 읽는다.
- matter/classification rollup은 원본 matter_id와 classification을 유지한다.

## API

- `/api/resource-evidence-dashboard-summaries`
- `/api/resource-evidence-panel-rows`
- `/api/resource-evidence-matter-rollups`
- `/api/resource-evidence-classification-rollups`
- `/api/resource-evidence-dashboard-validations`
