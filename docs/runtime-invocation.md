# Hermes Runtime Invocation Adapter

작성일: 2026-05-23

## 목적

Runtime Invocation Adapter는 Claude Code, Codex, Hermes, local script 같은 runtime을 직접 신뢰 실행하지 않고, adapter registry와 workspace policy를 확인한 뒤 호출 기록을 남기는 계층이다.

## 원칙

- 기본 모드는 `dry-run`이다.
- `dry-run`은 외부 runtime을 호출하지 않고 prompt hash, workspace, adapter policy, required gates를 기록한다.
- `execute`는 명시적 command가 있어야 한다.
- `claude_code`와 `codex`의 `execute`는 `git_worktree` 격리에서만 허용한다.
- 모든 invocation은 stdout/stderr hash, prompt hash, output trust, verification requirement를 남긴다.
- runtime output은 gate 전까지 `untrusted_until_verified`로 취급한다.

## 실행

Dry-run:

```bash
npm run runtime:invoke -- --runtime codex --prompt "Prepare a bounded patch plan"
```

Workspace manifest를 붙인 dry-run:

```bash
npm run runtime:invoke -- \
  --runtime codex \
  --workspace-manifest artifacts/personal-dev-slice/latest/workspace-manifest.json \
  --prompt "Prepare a bounded patch plan"
```

Execute 모드 예시:

```bash
npm run runtime:invoke -- \
  --runtime local_script \
  --mode execute \
  --prompt "Run local check" \
  -- node -e "console.log('ok')"
```

## Personal Dev Slice와의 관계

`npm run personal-dev:slice`는 Claude Code와 Codex runtime을 아직 실제 호출하지 않는다. 대신 두 runtime invocation을 `dry-run`으로 남기고, 그 산출물을 `runtime-invocations.json`에 기록한다. 이 다음 단계에서 실제 Claude Code/Codex command를 연결하면 같은 ledger 구조를 유지한 채 `execute`로 전환할 수 있다.

## Command Binding

실제 command 연결은 `examples/core/runtime-command-bindings.json`에서 관리한다. `runtime:invoke`는 명시 command가 없으면 이 registry를 보고 runtime별 command를 탐지한다.

```bash
npm run runtime:bindings
```

`codex`와 `claude_code`는 command가 설치되어 있어도 `git_worktree` 격리가 아니면 `execute`가 차단된다. command가 없으면 `unavailable` 상태와 install hint가 기록된다.

## 산출물

기본 산출 위치는 `artifacts/runtime-invocation/latest/runtime-invocations.json`이다.

Personal Dev slice에서는 `artifacts/personal-dev-slice/latest/runtime-invocations.json`에 포함된다.
