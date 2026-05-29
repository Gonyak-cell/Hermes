# Technical Debt Ledger

P228 Technical Debt Ledger는 plan reconciliation의 unresolved question과 PR draft risk를 읽어, 후속 처리해야 할 engineering debt를 read-only backlog task draft로 보존한다.

## 생성 명령

```bash
npm run personal-dev:technical-debt -- --check
```

## 산출물

- `artifacts/technical-debt-ledger/latest/technical-debt-ledger.json`
- `artifacts/technical-debt-ledger/latest/technical-debt-ledger.md`
- `artifacts/technical-debt-ledger/latest/debt-source-findings.json`
- `artifacts/technical-debt-ledger/latest/technical-debt-tasks.json`
- `artifacts/technical-debt-ledger/latest/debt-task-bindings.json`
- `artifacts/technical-debt-ledger/latest/technical-debt-output-artifacts.json`
- `artifacts/technical-debt-ledger/latest/technical-debt-desktop-boundary.json`
- `artifacts/technical-debt-ledger/latest/validation-report.json`

## 운영 규칙

- issue tracker write, task state write, command execution, protected mutation, branch push, merge, release는 실행하지 않는다.
- 각 debt source finding은 하나의 `technical_debt_task`로 보존된다.
- task update OutputArtifact v2는 `draft`, `blocked_pending_approval`, `pending` 상태로만 저장된다.
- Desktop surface는 debt finding, task, binding, validation row를 읽기 전용으로만 보여준다.
- 후속 task 생성, issue tracker 반영, protected remediation은 명시 human review 이후에만 가능하다.
