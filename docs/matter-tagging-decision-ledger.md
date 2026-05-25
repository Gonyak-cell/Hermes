# Matter Tagging Decision Ledger

Phase 124는 Resource Expansion과 Matter Access Policy Evaluator 사이에서 발견된 unassigned resource를 실제 matter에 자동 배정하지 않고, 자동 후보와 사람 확인 대기열로 분리한다.

## 원칙

- `matter_id`가 `matter.unassigned.*`인 resource는 자동으로 matter에 적용하지 않는다.
- Matter Access Policy Evaluator가 제안한 `target_matter_id`는 후보일 뿐이며, `matter_tagging_gate`와 `human_approval_gate`를 통과해야 한다.
- 자동 tagging 후보, human confirmation request, correction history는 서로 다른 컬렉션으로 남긴다.
- tenant가 다른 resource와 proposed matter는 `tenant_boundary_mismatch` reason code로 표시한다.
- correction history는 아직 비어 있더라도 별도 collection으로 유지해, 추후 사람이 수정한 matter tag 이력을 원본 결정과 섞지 않는다.

## 산출물

- `artifacts/matter-tagging/latest/matter-tagging-ledger.json`
- `artifacts/matter-tagging/latest/matter-tagging-decisions.json`
- `artifacts/matter-tagging/latest/matter-tagging-candidates.json`
- `artifacts/matter-tagging/latest/matter-tagging-confirmations.json`
- `artifacts/matter-tagging/latest/matter-tagging-corrections.json`
- `artifacts/matter-tagging/latest/validation-report.json`

## 실행

```bash
npm run contracts:matter-tagging
npm run contracts:matter-tagging -- --check
```
