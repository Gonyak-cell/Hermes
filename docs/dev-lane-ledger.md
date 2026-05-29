# Dev Lane Ledger

P220 Dev Lane Ledger는 P219 Scope Freeze Gate 이후 Claude Code와 Codex 작업 lane을 독립 branch/worktree record로 고정하는 운영 artifact다.

이 단계는 실제 `git worktree add`, 외부 agent 호출, plan acceptance, patch application을 수행하지 않는다. Windows 기준선에서는 branch/worktree 식별자, frozen scope binding, follow-on gate만 기록하고, 물리적 worktree 생성과 protected file write는 명시적 human gate 뒤로 남긴다.

## Outputs

- `artifacts/dev-lane-ledger/latest/dev-lane-ledger.json`
- `artifacts/dev-lane-ledger/latest/dev-lanes.json`
- `artifacts/dev-lane-ledger/latest/dev-lane-branch-records.json`
- `artifacts/dev-lane-ledger/latest/dev-lane-worktree-records.json`
- `artifacts/dev-lane-ledger/latest/dev-lane-desktop-boundary.json`
- `artifacts/dev-lane-ledger/latest/validation-report.json`
- `artifacts/dev-lane-ledger/latest/summary.md`

## Invariants

- Scope Freeze Gate, Plan Reconciliation, Worktree Manager v2가 모두 complete여야 한다.
- Claude Code lane과 Codex lane은 각각 하나씩 provisioned로 기록된다.
- branch name과 worktree path는 agent별로 고유해야 한다.
- git command, filesystem mutation, external agent invocation, plan acceptance, patch application은 모두 수행되지 않는다.
- Desktop surface는 read-only이며 worktree create/delete, branch delete, patch, protected write를 수행할 수 없다.

## Human Review Note

Dev lane provisioning은 운영 장부화 단계다. 실제 worktree 생성, protected file 변경, patch 적용, merge, release, client-facing/legal output은 모두 사람 검토와 승인 뒤에만 진행한다.
