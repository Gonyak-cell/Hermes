# Hermes Runtime Command Bindings

작성일: 2026-05-23

## 목적

Runtime Command Binding은 runtime adapter와 실제 로컬 command 사이의 얇은 연결 계층이다. adapter registry가 “이 runtime은 어떤 정책과 격리 아래 실행되는가”를 말한다면, command binding은 “이 runtime을 실제로 어떤 CLI command로 호출할 수 있는가”를 말한다.

## 원칙

- binding은 runtime adapter를 대체하지 않는다.
- `dry-run`에서는 command 설치 여부만 기록하고 외부 agent를 호출하지 않는다.
- `execute`는 command가 명시되었거나 binding에서 발견되어야 한다.
- `claude_code`와 `codex`는 command가 발견되어도 `git_worktree` 격리 없이는 실행되지 않는다.
- command가 없으면 실패가 아니라 `unavailable` 상태로 남긴다.
- 모든 command 선택은 invocation ledger에 `binding` metadata로 남긴다.

## Binding Registry

기본 파일:

```text
examples/core/runtime-command-bindings.json
```

초기 binding:

| Runtime | Candidate Commands | Execute 조건 |
|---|---|---|
| `claude_code` | `claude`, `claude-code` | git worktree 필요 |
| `codex` | `codex` | git worktree 필요 |
| `hermes` | `hermes` | adapter policy 필요 |
| `local_script` | `node` | 명시 command 실행 가능 |

## 실행 예시

Dry-run with auto binding:

```bash
npm run runtime:invoke -- --runtime codex --prompt "Prepare a bounded patch"
```

Command discovery:

```bash
npm run runtime:bindings
```

Explicit execute:

```bash
npm run runtime:invoke -- \
  --runtime local_script \
  --mode execute \
  --prompt "Run local command" \
  -- node -e "console.log('ok')"
```

## 다음 단계

실제 Claude Code/Codex CLI를 연결하려면 먼저 이 repository를 git repository로 만들고, Worktree Manager가 `git_worktree`를 만들 수 있어야 한다. 그 뒤 command binding에서 runtime command가 available이어야 `execute`로 넘어갈 수 있다.
