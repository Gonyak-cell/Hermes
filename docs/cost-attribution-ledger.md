# Cost Attribution Ledger

`Cost Attribution Ledger`는 Cost Budget Ledger, Token Usage Ledger, Observability Catalog를 연결해 실행 비용을 matter, runtime, capability, domain pack 기준으로 귀속한다.

기본 실행:

```bash
npm run cost:attribution
```

검증 실행:

```bash
npm run cost:attribution -- --check
```

입력:

- `artifacts/cost-budget/latest/cost-budget-ledger.json`
- `artifacts/token-usage/latest/token-usage-ledger.json`
- `artifacts/observability/latest/observability-catalog.json`

출력:

- `artifacts/cost-attribution/latest/cost-attribution-ledger.json`
- `artifacts/cost-attribution/latest/cost-attribution-records.json`
- `artifacts/cost-attribution/latest/summary.md`

각 attribution record는 다음을 기록한다.

- budget, routing, context, workflow, agent, runtime, capability 식별자
- matter, tenant, classification, domain pack
- max USD, observed USD, estimated token USD, projected USD
- budget remaining, over-budget 여부
- token count와 runtime seconds
- cost record id, required gate, audit flag

`projected_usd`는 현재 deterministic 운영 지표다. 실제 provider USD가 있으면 observed USD가 우선하고, 없으면 Token Usage Ledger의 token count와 `estimated_token_usd_per_1k`를 사용한다. 이 값은 청구용 원장이 아니라 예산·프로젝트 원가·운영 감시용 귀속 원장이다.

rollup은 다음 축으로 제공한다.

- `by_domain_pack`
- `by_runtime_id`
- `by_capability_id`
- `by_matter_id`

이 단계는 `/goal`의 Observability/Cost Ledger 완성도를 높인다. Cost Budget Ledger가 실행 전 예산 gate라면, Cost Attribution Ledger는 실행 후 또는 추정 실행 비용을 어떤 matter와 runtime에 귀속할지를 고정한다.
