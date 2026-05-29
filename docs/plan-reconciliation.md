# Plan Reconciliation

P218 Plan Reconciliation은 P217 Plan Request Contract에서 나온 Claude Code와 Codex plan request를 같은 shared planning context 안에서 비교한다.

이 단계는 외부 agent를 실행하지 않고 plan을 수락하지 않는다. 산출물은 deterministic plan candidate, 공통점, 충돌과 resolution, human review용 selected scope, unresolved question, Desktop read-only boundary, validation checkpoint만 생성한다.

## Outputs

- `artifacts/plan-reconciliation/latest/plan-reconciliation.json`
- `artifacts/plan-reconciliation/latest/plan-candidates.json`
- `artifacts/plan-reconciliation/latest/plan-commonalities.json`
- `artifacts/plan-reconciliation/latest/plan-conflicts.json`
- `artifacts/plan-reconciliation/latest/selected-plan-scope.json`
- `artifacts/plan-reconciliation/latest/unresolved-plan-questions.json`
- `artifacts/plan-reconciliation/latest/plan-reconciliation-desktop-boundary.json`

## Human Review

Selected scope는 Phase 219 scope freeze gate의 입력 후보일 뿐이며 구현 권한, merge 권한, release 권한, 법률/클라이언트-facing 산출물 승인을 의미하지 않는다.
