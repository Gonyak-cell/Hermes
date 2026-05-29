# Scope Freeze Gate

Phase 219는 Phase 218 Plan Reconciliation에서 고른 selected scope와 Phase 209 Protected File Gate의 rule snapshot을 구현 전 기준선으로 고정한다.

이 gate는 구현 승인, patch 적용, merge, release를 뜻하지 않는다. Hermes Desktop은 frozen scope item, file boundary, protected file rule snapshot, freeze decision, validation item을 read-only로 조회한다.

## 운영 규칙

- `selected_plan_scope.selected_scope_items`를 `frozen_scope_items`로 고정한다.
- Claude Code/Codex plan candidate의 `touched_files`를 `scope_file_boundaries`로 고정한다.
- Protected File Gate rule과 selected scope의 protected path pattern을 `scope_protected_file_rules`로 고정한다.
- protected file write는 명시적 human approval 전까지 금지한다.
- worktree provisioning은 scope freeze 이후 단계에서만 허용하고, implementation patch는 worktree/diff review 전에는 허용하지 않는다.
- external agent invocation, command execution, protected mutation, task-state mutation, plan acceptance는 모두 0으로 유지한다.

## 검증

```bash
npm run personal-dev:scope-freeze -- --check
```

Human review note: scope freeze는 운영 경계만 고정한다. 법률 판단, 클라이언트-facing 산출물, protected file 변경, merge, release는 계속 human-gated 단계로 남는다.
