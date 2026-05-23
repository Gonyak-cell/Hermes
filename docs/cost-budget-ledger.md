# Cost Budget Ledger

`Cost Budget Ledger`는 Model Routing Ledger가 만든 route decision을 capability별 `cost_policy`와 Observability Catalog의 cost records에 대조한다. 여기서는 어떤 외부 runtime도 호출하지 않고, `cost_budget_gate`가 실행 전 통과 가능한지 원장으로 남긴다.

```bash
npm run cost:budgets
```

## 입력

- `artifacts/model-routing/latest/model-routing-ledger.json`
- `artifacts/domain-packs/latest/domain-pack-registry.json`
- `artifacts/observability/latest/observability-catalog.json`
- `artifacts/policy-matrix/latest/policy-matrix-catalog.json`

## 출력

- `cost-budget-ledger.json`
- `budget-decisions.json`
- `summary.md`

## 계약

- `budget_decisions`: routing decision별 budget gate 결과
- `max_usd`: capability manifest의 비용 상한
- `observed_usd`: Observability cost records 중 USD 비용 합계
- `observed_runtime_seconds`: runtime seconds cost records 합계
- `token_tracking_status`: token tracking 요구가 있는데 token records가 아직 없는지 표시
- `blocker_reasons`: missing cost policy, budget exceeded, missing cost gate 등

Token records가 아직 없는 것은 `pending_records`로 남기되 blocked error로 보지 않는다. 현재 slice들은 runtime seconds 중심으로 비용을 기록하고 있으므로, token tracking 요구는 운영상 남은 계측 과제로 표시한다.

## Dashboard/API

Dashboard는 `cost_budget_ledger` stage를 표시한다. Review API는 다음 route를 제공한다.

- `GET /api/cost-budget-ledgers`
- `GET /api/cost-budget-decisions`

예:

```bash
node scripts/review-api.mjs --once "/api/cost-budget-decisions?budget_status=passed"
node scripts/review-api.mjs --once "/api/cost-budget-decisions?token_tracking_status=pending_records"
```

## Goal 내 위치

이 단계는 `/goal`의 Gate/Approval, Observability/Cost, Runtime Adapter 사이를 잇는다. Model Routing Ledger가 “어디로 보낼 수 있는가”를 판단한다면, Cost Budget Ledger는 “그 route를 예산과 cost tracking 조건 아래 실행해도 되는가”를 별도 계약으로 고정한다.
