# Policy Contract Freeze

Phase 101은 Policy Matrix, Policy Snapshot Ledger, Resource v2 contract, Matter Boundary v2 contract를 입력으로 삼아 데이터 등급과 policy reference 계약을 v2 projection으로 고정한다.

실행:

```sh
npm run contracts:policies
```

주요 산출물:

- `artifacts/policy-contract-freeze/latest/policy-contract-freeze.json`
- `artifacts/policy-contract-freeze/latest/data-classification-v2-fixture.json`
- `artifacts/policy-contract-freeze/latest/policy-reference-v2-fixture.json`
- `artifacts/policy-contract-freeze/latest/policy-decision-v2-fixture.json`
- `artifacts/policy-contract-freeze/latest/validation-report.json`
- `artifacts/policy-contract-freeze/latest/summary.md`

완료 기준:

- `P0_PUBLIC`부터 `P5_SECRET`까지 6개 데이터 등급이 모두 존재해야 한다.
- 각 데이터 등급은 runtime policy, model policy, required gate, redaction policy를 연결해야 한다.
- Resource, Client, Matter, Boundary, Workflow, Event, Run Ledger의 모든 policy reference는 알려진 policy snapshot으로 해소되어야 한다.
- P3-P5 등급은 외부 모델 전송 정책이 `forbidden`으로 고정되어야 한다.
