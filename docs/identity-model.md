# Identity Model

Phase 113 adds the first deterministic identity model for the harness.

```bash
npm run contracts:identity -- --check
```

이 명령은 vertical slice의 `identity_policy`를 읽고 tenant, human user, role, role assignment, actor principal, actor-user binding을 별도 객체로 투영한다.

## Outputs

- `artifacts/identity-model/latest/identity-model.json`
- `artifacts/identity-model/latest/identity-users.json`
- `artifacts/identity-model/latest/actor-principals.json`
- `artifacts/identity-model/latest/role-assignments.json`
- `artifacts/identity-model/latest/actor-user-bindings.json`
- `artifacts/identity-model/latest/validation-report.json`
- `artifacts/identity-model/latest/summary.md`

## Pass Criteria

- 모든 user는 tenant에 속한다.
- 모든 human user는 별도의 `human_actor` principal에 연결된다.
- non-human actor는 human user로 오인되지 않는다.
- tenant role, matter role, system actor role이 role assignment로 남는다.
- approval `requested_from` 값은 human user와 human actor principal로 역추적된다.
- dashboard, API, checkpoint, contract golden fixture, contract validation suite에서 P113 identity artifact가 조회된다.

이 모델은 이후 matter team, ethical wall, model/tool/runtime policy evaluator가 같은 identity boundary를 재사용하도록 만드는 바닥 계약이다.
