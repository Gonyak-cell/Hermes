# Canonical Test Matrix

P223 Canonical Test Matrix는 repo profile, canonical test runner, diff review gate를 묶어 Windows 기준의 테스트 명령 행렬을 고정한다. 이 단계는 에이전트 self-report를 완료 근거로 쓰지 않고, harness가 직접 실행한 unit/typecheck/lint 결과와 diff-review gate binding만을 Phase 승격 근거로 사용한다.

## 산출물

- `artifacts/canonical-test-matrix/latest/canonical-test-matrix.json`
- `artifacts/canonical-test-matrix/latest/canonical-test-matrix-repos.json`
- `artifacts/canonical-test-matrix/latest/canonical-test-matrix-commands.json`
- `artifacts/canonical-test-matrix/latest/canonical-test-matrix-executions.json`
- `artifacts/canonical-test-matrix/latest/canonical-test-matrix-results.json`
- `artifacts/canonical-test-matrix/latest/canonical-test-matrix-bindings.json`
- `artifacts/canonical-test-matrix/latest/canonical-test-matrix-desktop-boundary.json`
- `artifacts/canonical-test-matrix/latest/validation-report.json`
- `artifacts/canonical-test-matrix/latest/summary.md`

## 불변식

- `npm test`, typecheck, lint 계열의 required dimension은 harness control plane이 직접 실행한다.
- e2e 명령이 repo에 없으면 optional `not_configured`로 기록하고 required gate에는 포함하지 않는다.
- diff-review gate 결과 2개는 passing required matrix result에 binding되어야 한다.
- patch application, direct apply, direct merge, protected write, filesystem mutation, git command는 이 단계에서 수행하지 않는다.
- Hermes Desktop은 read-only rerun surface이며 command execution source of truth가 아니다.

## Human Review

이 산출물은 운영 판단 보조용이며 법률 분석, filing 판단, 클라이언트 조언, 최종 work product가 아니다. 법률 또는 client-facing 산출물로 전환하려면 별도 human review note와 승인 기록이 필요하다.
