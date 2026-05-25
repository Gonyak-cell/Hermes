# Model Policy Enforcement

`Model Policy Enforcement`는 Model Routing Ledger가 만든 runtime/model route를 실제 외부 모델 전송 gate로 다시 판정한다. 이 단계는 외부 provider 호출을 실행하지 않고, Data Classification Rule Engine과 PolicyDecision v2에 근거해 P2-P5 자료가 `allow` 상태로 외부 경계를 통과하지 못하게 막는다.

## Inputs

- `data-classification-rule-engine.json`
- `model-routing-ledger.json`
- `policy-contract-freeze.json`

## Outputs

- `model-policy-enforcement.json`
- `model-policy-gates.json`
- `classification-model-gates.json`
- `resource-model-gates.json`
- `route-model-gates.json`
- `validation-report.json`
- `summary.md`

## Enforcement

- P0/P1은 외부 모델 전송이 `allowed_with_audit`일 때만 `allow`가 가능하다.
- P2는 외부 모델 전송이 `review`이며 `external_model_gate`, `redaction_gate`, `human_approval_gate`를 요구한다.
- P3-P5는 외부 모델 전송이 `deny`여야 한다.
- 외부 전송 route에서 redaction required 자료가 redacted 상태가 아니면 route gate는 `deny`가 된다.
- 모든 route gate는 Model Routing Ledger의 `route_status`보다 느슨한 결정을 내리지 않는다.

## Role In The Harness

이 단계는 `/goal`의 Identity/Policy plane 중 model policy gate다. Context Builder와 Runtime Adapter가 만든 route가 있어도, 최종 외부 모델 경계는 이 artifact의 `route_model_gates`를 통과해야 한다.
