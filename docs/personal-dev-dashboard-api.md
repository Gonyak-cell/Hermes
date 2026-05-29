# Personal Dev Dashboard API

P229 Personal Dev Dashboard API는 repo, worktree, plan, diff, test, PR review 상태를 한 화면에서 조회할 수 있도록 기존 P213-P228 artifact를 read-only panel row와 API route binding으로 투영한다.

## 생성 명령

```bash
npm run personal-dev:dashboard-api -- --check
```

## 산출물

- `artifacts/personal-dev-dashboard-api/latest/personal-dev-dashboard-api.json`
- `artifacts/personal-dev-dashboard-api/latest/personal-dev-panel.md`
- `artifacts/personal-dev-dashboard-api/latest/personal-dev-panel-rows.json`
- `artifacts/personal-dev-dashboard-api/latest/personal-dev-status-rollups.json`
- `artifacts/personal-dev-dashboard-api/latest/personal-dev-api-route-bindings.json`
- `artifacts/personal-dev-dashboard-api/latest/personal-dev-output-artifacts.json`
- `artifacts/personal-dev-dashboard-api/latest/personal-dev-dashboard-desktop-boundary.json`
- `artifacts/personal-dev-dashboard-api/latest/validation-report.json`

## 조회 축

- `repo`: repo profile, language, framework, command status
- `worktree`: lane, branch record, worktree record status
- `plan`: plan reconciliation, selected scope, unresolved question status
- `diff`: patch capture, touched file, diff review status
- `test`: canonical test matrix status
- `pr`: PR draft, release note, rollback plan, technical debt status

## 운영 규칙

- 이 artifact는 API route binding과 panel row만 생성한다.
- task state write, issue mutation, command execution, PR creation, branch push, merge, release, protected write는 실행하지 않는다.
- Desktop은 panel row, status rollup, route binding, validation row를 읽기 전용으로 조회한다.
- rerun, PR 생성, merge, release, client-facing output은 명시 human review 이후에만 가능하다.
