# Plan Request Contract

P217 Plan Request Contract는 Personal Dev Domain Pack에서 Claude Code와 Codex가 같은 task context와 같은 제한조건으로 plan을 제출할 수 있도록 요청 레코드를 고정한다.

이 단계는 agent를 실행하지 않는다. 산출물은 shared planning context, Claude Code plan request, Codex plan request, request binding, Desktop read-only boundary, validation checkpoint만 생성한다.

## Outputs

- `artifacts/plan-request-contract/latest/plan-request-contract.json`
- `artifacts/plan-request-contract/latest/shared-planning-context.json`
- `artifacts/plan-request-contract/latest/plan-requests.json`
- `artifacts/plan-request-contract/latest/plan-request-bindings.json`
- `artifacts/plan-request-contract/latest/plan-request-desktop-boundary.json`
- `artifacts/plan-request-contract/latest/validation-report.json`
- `artifacts/plan-request-contract/latest/summary.md`

## Command

```bash
npm run personal-dev:plan-request
npm run personal-dev:plan-request -- --check
```

## Human Review

Plan request output is draft operational coordination. Implementation, merge, release, task-state mutation, and any legal or client-facing output remain human-gated.
