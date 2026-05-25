# Policy Operations Surface

Policy Operations Surface는 identity/policy 계층의 여러 결정 artifact를 dashboard와 API에서 바로 조회할 수 있는 하나의 운영 표면으로 합친다.

## 목적

- Matter access, data classification, model policy, tool/runtime policy, output destination, matter tagging, conflict check, store policy, workspace boundary, policy golden fixture 결과를 같은 행 구조로 정규화한다.
- 정책 판단은 `policy_decision_rows`, 차단/위반 후보는 `policy_violation_rows`, 사람 검토 또는 승인 대기는 `policy_pending_approval_rows`로 분리한다.
- 로펌용 작업에서 차단된 접근, 외부 모델 전송 제한, protected action, conflict review, matter tagging confirmation을 한 화면과 API에서 확인할 수 있게 한다.

## 산출물

`npm run policy:surface`는 `artifacts/policy-operations-surface/latest/` 아래에 다음 파일을 쓴다.

- `policy-operations-surface.json`
- `policy-decision-rows.json`
- `policy-violation-rows.json`
- `policy-pending-approval-rows.json`
- `validation-report.json`
- `summary.md`

## 검증 기준

- 모든 입력 source가 `complete` 또는 `valid` 상태다.
- allow, review, deny 판단이 모두 존재한다.
- 위반 row는 deny 또는 blocked 결과에서만 파생된다.
- 승인대기 row는 적어도 하나의 통제 gate 또는 approval authority 결정을 가진다.
- validation error가 0이어야 dashboard stage와 goal checkpoint가 통과한다.

## API

Review API는 다음 read-only route를 제공한다.

- `GET /api/policy-operation-surfaces`
- `GET /api/policy-decision-rows`
- `GET /api/policy-violation-rows`
- `GET /api/policy-pending-approvals`
- `GET /api/policy-surface-validations`
