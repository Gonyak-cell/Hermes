# Tool/Runtime Policy Enforcement

`Tool/Runtime Policy Enforcement`는 RuntimeAdapter v2, AgentRun runtime contract, Policy Matrix의 runtime/tool rule을 합쳐 pre-run/in-run tool permission gate로 고정한다.

## Inputs

- `runtime-agentrun-contract-freeze.json`
- `policy-matrix-catalog.json`
- `capability-workflow-contract-freeze.json`
- `model-policy-enforcement.json`

## Outputs

- `tool-runtime-policy-enforcement.json`
- `tool-runtime-policy-catalog.json`
- `runtime-policy-gates.json`
- `tool-permission-gates.json`
- `agent-run-tool-gates.json`
- `validation-report.json`
- `summary.md`

## Enforcement

- Runtime별 `allowed_tools`와 `forbidden_tools`가 겹치면 실패한다.
- Runtime이 금지한 tool은 항상 `deny`로 고정한다.
- `email.send`, `erp.billing.issue`, `github.merge` 같은 protected action은 approval-required tool gate로 남긴다.
- Non-manual runtime이 tool을 갖는 경우 `tool_permission_gate`를 요구한다.
- Runtime/classification 조합이 policy matrix에서 forbidden이면 runtime policy gate가 blocked가 된다.
- AgentRun은 capability가 요구한 tool gate와 runtime tool gate를 모두 통과해야 한다.

## Role In The Harness

이 단계는 `/goal`의 Runtime Adapter와 Gate Plane 사이에 놓이는 deterministic enforcement layer다. Claude Code, Codex, Hermes, local script, renderer가 어떤 tool/action을 사용할 수 있는지는 이 artifact에서 먼저 검증되고, protected action은 사람 승인 전 실행되지 않는다.
