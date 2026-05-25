# Data Classification Rule Engine

P118 Data Classification Rule Engine은 Resource v2의 `classification`을 PolicyReference v2, PolicyDecision v2, Matter Access Policy Evaluator의 resource access decision과 연결한다.

## 목적

- 각 resource가 어떤 DataClassification rule을 탔는지 명시한다.
- resource별 외부 모델 전송 결정, redaction 필요 여부, human review 필요 여부를 결정한다.
- unassigned matter 자료는 자동 허용하지 않고 `matter_tagging_gate`와 `human_approval_gate`가 필요한 review 상태로 둔다.
- PolicyReference가 없는 resource, PolicyDecision이 없는 classification, Matter Access 연결이 없는 resource를 validation 실패로 표시한다.

## 입력

- `artifacts/resource-contract-freeze/latest/resource-contract-freeze.json`
- `artifacts/policy-contract-freeze/latest/policy-contract-freeze.json`
- `artifacts/matter-access-policy/latest/matter-access-policy-evaluator.json`

## 출력

- `data-classification-rule-engine.json`
- `classification-rule-catalog.json`
- `classification-rules.json`
- `resource-classification-decisions.json`
- `classification-policy-bindings.json`
- `validation-report.json`
- `summary.md`

## 결정 원칙

- `allowed_with_audit`는 외부 모델 `allow`로 매핑한다.
- `approval_required`는 외부 모델 `review`로 매핑한다.
- `forbidden`은 외부 모델 `deny`로 매핑한다.
- P2 이상처럼 approval이나 redaction이 필요한 classification은 required gate와 함께 resource decision에 남긴다.
- matter가 미배정된 resource는 classification 자체가 낮아도 retrieval/사용 전 review가 필요하다.

이 단계는 법률 판단을 자동화하지 않는다. 로펌 자료가 어떤 정책 경로로 처리되어야 하는지 결정 가능한 구조화 데이터로 만든 뒤, 후속 gate와 human approval이 검증할 수 있게 한다.
