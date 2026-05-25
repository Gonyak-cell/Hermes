# Access Audit Projection

Phase 125는 Matter Access Policy Evaluator가 만든 matter/resource 접근 판단을 조회 가능한 access audit view로 투영한다.

## 원칙

- 이 projection은 실제 자료 열람을 자동 실행하지 않는다.
- `allow`, `review`, `deny` 판단을 `view_allowed`, `view_requires_human_confirmation`, `view_denied` 조회 상태로 분리한다.
- 모든 row는 `user_id`, `runtime_id`, `target_matter_id`, `policy_snapshot_id`를 보존한다.
- resource-level row는 `target_resource_id`와, matter tagging이 필요한 경우 `matter_tagging_decision_id`를 함께 가진다.
- actor rollup과 resource rollup은 원본 access decision row와 분리해 API/dashboard 조회용으로만 쓴다.

## 산출물

- `artifacts/access-audit/latest/access-audit-projection.json`
- `artifacts/access-audit/latest/access-audit-records.json`
- `artifacts/access-audit/latest/actor-access-rollups.json`
- `artifacts/access-audit/latest/resource-access-rollups.json`
- `artifacts/access-audit/latest/validation-report.json`

## 실행

```bash
npm run contracts:access-audit
npm run contracts:access-audit -- --check
```
