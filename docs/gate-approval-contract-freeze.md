# Gate/Approval Contract Freeze

P105는 gate 판단과 사람 승인 객체를 분리해 고정한다. GateResult는 `passed`, `failed`, `pending` 같은 실행 판단과 findings만 기록하고, 사람이 승인하거나 반려하는 행위는 `ApprovalRequest v2`와 `ApprovalDecision v2`가 담당한다.

## Contract Objects

- `gate-result.v2`: workflow run, gate id, gate stage, outcome, blocking 여부, findings, event/policy link를 보존한다.
- `approval-request.v2`: governance approval, approval queue, approval inbox, protected approval request를 공통 요청 객체로 정규화한다.
- `approval-decision.v2`: approval queue/inbox의 실제 결정 기록을 보존하고, 원 요청이 현재 queue에 없으면 `orphan_source_decision`으로 추적한다.
- `human-gate-contract.v2`: control plane human gate item을 사람이 처리해야 하는 안전한 gate briefing 객체로 고정한다.
- `approval-authority-contract.v2`: approval request별 요구 승인 주체를 분리해 둔다.
- `gate-approval-binding.v2`: `human_approval_gate`와 별도 approval request 사이의 연결을 명시한다.

## Safety Rule

`human_approval_gate`는 gate failure나 pending state를 표현할 뿐, 승인 자체가 아니다. 고객 제출, PR merge, 문서 delivery, protected command 실행은 별도 approval request와 approval decision 없이는 완료로 간주하지 않는다.

## Commands

```bash
npm run contracts:gates -- --check
npm run dashboard:build
npm run api:smoke
```
