# Hermes Personal Dev Slice Runner

작성일: 2026-05-23

## 목적

이 단계는 개인 개발 프로젝트 관리 pack의 첫 실행 경로다. GitHub/Plane 실연동 전에는 `examples/dev-projects.json`을 issue source로 사용하고, Claude Code와 Codex의 협업 구조를 계약과 산출물로 고정한다.

실행 경로:

```text
dev-projects.json
→ selected development task
→ Claude review plan
→ Codex implementation plan
→ reconciled plan
→ Worktree Manager
→ git worktree or isolated workspace manifest
→ runtime invocation dry-runs
→ canonical local checks
→ protected-file / diff-review / test gate
→ PR draft
→ merge approval pending
→ event ledger / run ledger
```

## 실행

```bash
npm run personal-dev:slice
```

특정 task로 실행:

```bash
node scripts/run-personal-dev-slice.mjs examples/dev-projects.json --task-id HD-003
```

## 산출물

기본 산출 위치는 `artifacts/personal-dev-slice/latest`다.

| 파일 | 설명 |
|---|---|
| `personal-dev-slice.json` | core contract 형태의 personal dev 실행 결과 |
| `event-ledger.json` | workflow/run/event/cost ledger |
| `plan.json` | Claude plan, Codex plan, reconciled plan |
| `runtime-invocations.json` | Claude Code와 Codex dry-run/execute 호출 기록 |
| `workspace-manifest.json` | Worktree Manager가 생성한 git worktree 또는 isolated workspace 기록 |
| `test-result.json` | canonical local check 결과 |
| `pr-draft.md` | merge 전 review용 PR draft |
| `summary.json` | 주요 ID와 상태 요약 |

## 주의

현재 `/Users/jws/Documents/Codex/Hermes`는 git repository가 아니면 실제 `git worktree`를 만들 수 없다. 이 경우 runner는 `isolated_workspace` fallback을 기록하고, protected-file gate의 finding에 그 사실을 남긴다. git repo에서 실행하면 같은 계약으로 `git_worktree` 모드가 가능하다.

## 완료 기준

이 단계는 다음이 충족되면 완료다.

- portfolio에서 개발 task 1개를 선택한다.
- Claude plan과 Codex plan을 별도 객체로 만든다.
- 두 plan을 reconciled plan으로 합친다.
- worktree 또는 isolated workspace manifest를 남긴다.
- canonical local checks를 실행하고 test gate에 반영한다.
- protected-file, diff-review, test gate를 통과시킨다.
- PR draft output artifact를 만든다.
- merge approval은 pending/blocking 상태로 남긴다.
- 생성된 slice와 event ledger가 core validator를 통과한다.
