# Ledger API/Dashboard

Phase 174 adds a read-only ledger surface over the event, run, audit, cost, and error planes. The artifact does not execute delivery, retry, retention, deletion, approval, or client-facing actions.

## 산출물

- `artifacts/ledger-api-dashboard/latest/ledger-api-dashboard.json`
- `artifacts/ledger-api-dashboard/latest/ledger-dashboard-panels.json`
- `artifacts/ledger-api-dashboard/latest/ledger-api-route-records.json`
- `artifacts/ledger-api-dashboard/latest/ledger-panel-metrics.json`
- `artifacts/ledger-api-dashboard/latest/ledger-cross-links.json`
- `artifacts/ledger-api-dashboard/latest/validation-report.json`
- `artifacts/ledger-api-dashboard/latest/summary.md`

## 조회 범위

- Run: workflow run ledger와 event binding 상태
- Audit: audit trail 분리와 source rollup 상태
- Cost: cost projection과 token usage projection 상태
- Error: error, retry, timeout, resume-state 상태
- Event: append-only event store와 replay harness 상태

## 검증

```bash
npm run ledgers:api-dashboard -- --check
npm run dashboard:build
npm run api:smoke
```

모든 panel은 Review API의 기존 `GET` route에만 연결된다. 누락 route, blocked panel, attention cross link, source validation error가 하나라도 있으면 `ledger_api_dashboard_status`는 `blocked`가 된다.
