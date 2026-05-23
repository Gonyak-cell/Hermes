# Token Usage Ledger

`Token Usage Ledger`는 Cost Budget Ledger의 budget decision을 context packet과 observability cost record에 연결해 token usage를 별도 계약으로 고정한다.

기본 실행:

```bash
npm run token:usage
```

검증 실행:

```bash
npm run token:usage -- --check
```

입력:

- `artifacts/cost-budget/latest/cost-budget-ledger.json`
- `artifacts/context-packets/latest/context-packet-ledger.json`
- `artifacts/observability/latest/observability-catalog.json`

출력:

- `artifacts/token-usage/latest/token-usage-ledger.json`
- `artifacts/token-usage/latest/token-usage-records.json`
- `artifacts/token-usage/latest/summary.md`

각 token usage record는 다음을 기록한다.

- budget/routing/context/workflow/agent/runtime/capability 식별자
- token tracking required 여부
- 실제 token cost record가 있으면 `recorded`
- token cost record가 없고 tracking required이면 context packet preview 기반 `estimated`
- token tracking이 필요 없으면 `not_required`
- budget 또는 route가 막힌 경우 `blocked`
- input/output/total token count
- estimation method, context item count, redaction 상태
- cost record id와 audit gate

추정 방식은 의도적으로 보수적인 deterministic heuristic이다. context item preview 문자 수, item overhead, runtime별 output baseline을 사용한다. 이 값은 청구 기준값이 아니라 예산/운영 관측을 위한 선행 estimate이며, 실제 provider token record가 들어오면 `recorded`가 우선한다.

이 단계는 `/goal`의 Observability/Cost, Runtime Adapter, Gate/Approval 계층을 잇는다. Cost Budget Ledger가 “예산상 실행 가능한가”를 판단한다면, Token Usage Ledger는 “그 실행의 token 사용량을 기록 또는 추정해 추적 가능한가”를 고정한다.
