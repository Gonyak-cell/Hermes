# Budget Alert Ledger

`Budget Alert Ledger`는 Cost Attribution Ledger의 projected cost를 budget threshold와 비교해 즉시 검토해야 하는 비용 경보를 정규화한다.

```bash
npm run budget:alerts
```

기본 입력:

- `artifacts/cost-attribution/latest/cost-attribution-ledger.json`

출력:

- `artifacts/budget-alerts/latest/budget-alert-ledger.json`
- `artifacts/budget-alerts/latest/budget-alert-records.json`
- `artifacts/budget-alerts/latest/summary.md`

## 계약

- `alert_records`: cost attribution record별 budget usage ratio, alert status, recommended action
- `alert_status`: `clear`, `warning`, `critical`, `unbudgeted`
- `warning_threshold`: 기본 0.8
- `critical_threshold`: 기본 1.0
- `validation`: critical 또는 unbudgeted alert가 있으면 blocked 상태로 기록

## Dashboard/API

Dashboard는 `budget_alert_ledger` stage와 active/critical alert summary를 표시한다. Review API는 다음 route를 제공한다.

- `GET /api/budget-alert-ledgers`
- `GET /api/budget-alert-records`

예:

```bash
node scripts/review-api.mjs --once "/api/budget-alert-records?alert_status=clear"
node scripts/review-api.mjs --once "/api/budget-alert-records?runtime_id=codex"
```

## Goal 내 위치

이 단계는 `/goal`의 Observability/Cost Ledger를 한 단계 더 닫는다. Cost Attribution Ledger가 비용을 matter/runtime/capability에 귀속한다면, Budget Alert Ledger는 그 귀속 비용이 예산 경계에 닿았는지 gate와 action queue가 볼 수 있는 형태로 고정한다.
