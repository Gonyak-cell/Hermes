# Hermes Worktree Manager

작성일: 2026-05-23

## 목적

Worktree Manager는 Claude Code와 Codex가 같은 dirty checkout을 동시에 건드리지 않도록 작업공간을 준비하는 계층이다. Personal Dev slice에서는 이 매니저를 통해 `git_worktree`를 우선 요청하고, git repository가 아니거나 worktree 생성이 불가능하면 `isolated_workspace` fallback을 기록한다.

## 원칙

- 기본 요청 격리는 `git_worktree`다.
- source repository의 `HEAD`, dirty file 목록, branch/workspace path를 manifest에 남긴다.
- worktree 생성 실패는 조용히 성공 처리하지 않는다. `fallback_reason`과 git command log를 남긴다.
- fallback workspace는 git worktree가 아니므로 protected-file gate finding에 반영된다.
- worktree 생성은 명시적 CLI 또는 runner 실행 안에서만 일어난다.

## 실행

현재 repo 기준:

```bash
npm run worktree:prepare -- --task-id HD-002 --branch codex/hd-002-hermes-harness
```

계획만 보고 싶을 때:

```bash
npm run worktree:prepare -- --task-id HD-002 --plan-only
```

## Manifest 핵심 필드

| 필드 | 설명 |
|---|---|
| `requested_isolation` | 항상 우선 요청값은 `git_worktree` |
| `actual_isolation` | `git_worktree` 또는 `isolated_workspace` |
| `repo_root` | git repository root. git repo가 아니면 null |
| `base_sha` | worktree 기준 commit |
| `dirty_checkout` | source checkout에 uncommitted change가 있는지 |
| `dirty_files` | `git status --porcelain` 결과 |
| `workspace_path` | agent가 사용해야 할 작업공간 |
| `fallback_reason` | fallback 이유 |
| `command_log` | 실행한 git command와 결과 |

## Personal Dev Slice와의 관계

`npm run personal-dev:slice`는 이 매니저를 호출한다. 현재 `/Users/jws/Documents/Codex/Hermes`는 git repo가 아니므로 `isolated_workspace`가 기록된다. 나중에 이 폴더를 git repo로 만들면 같은 slice가 실제 `git worktree`를 만들 수 있다.
