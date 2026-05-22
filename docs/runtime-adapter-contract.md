# Hermes Runtime Adapter Contract

작성일: 2026-05-22

## 목적

Runtime Adapter Contract는 Hermes Harness가 Hermes, Claude Code, Codex, local script, document renderer, MCP tool, browser, manual step을 직접 호출하지 않고 같은 실행 계약 아래에서 다루기 위한 표준이다.

핵심 원칙:

- Runtime은 capability의 구현체가 아니라 격리된 실행 주체다.
- Capability는 `allowed_runtimes`만 선언하고, 실제 권한과 격리는 runtime adapter registry가 결정한다.
- Agent self-report는 완료 조건이 아니다. 검증, gate, approval이 완료 조건이다.
- 로펌 데이터는 runtime 선택 전에 classification, matter wall, external model policy를 통과해야 한다.
- Codex와 Claude Code output은 검증 전까지 untrusted patch 또는 untrusted artifact로 취급한다.

## Adapter 필수 필드

| 필드 | 설명 |
|---|---|
| `adapter_id` | adapter 인스턴스 ID. 예: `runtime.codex.default` |
| `runtime_id` | 표준 runtime ID. 예: `codex`, `local_script` |
| `version` | adapter 계약 버전 |
| `risk_level` | `low`, `medium`, `high`, `critical` |
| `execution_environment` | local, docker, ssh, browser, manual 등 실행 환경 |
| `input_contract` | 입력 schema, 허용 context type, redaction 정책 |
| `output_contract` | 출력 schema, artifact type, trust level |
| `workspace_policy` | worktree, temp dir, Docker 등 격리 방식 |
| `tool_policy` | 허용 tool, 금지 tool, 필수 gate |
| `lifecycle` | timeout, heartbeat, cancel, resume, retry |
| `observability` | log, trace, prompt/output hash, cost 기록 |
| `verification` | 검증 필요 여부, 검증 runtime, acceptance authority |
| `data_access` | 허용 classification, raw/redacted context, retrieval filter |

## Runtime ID

초기 표준 runtime은 다음이다.

- `harness`
- `hermes`
- `claude_code`
- `codex`
- `local_script`
- `document_renderer`
- `mcp_tool`
- `browser`
- `manual`

Harness Orchestrator가 최상위 조정자이며, Hermes도 장기적으로는 중요한 runtime adapter 중 하나로 둔다. 이렇게 해야 Claude Code, Codex, local script, renderer를 같은 gate와 audit 아래에 넣을 수 있다.

## 데이터 접근 원칙

Runtime adapter는 데이터 등급별로 raw context와 redacted context를 분리한다.

| 등급 | 기본 원칙 |
|---|---|
| `P0_PUBLIC` | 외부/agent runtime 허용 가능, audit 필요 |
| `P1_INTERNAL` | agent runtime 허용 가능, secrets 제외 |
| `P2_CLIENT_CONFIDENTIAL` | raw context는 local/script/renderer/manual 중심, agent runtime은 redacted context와 승인 필요 |
| `P3_PRIVILEGED` | 외부 agent runtime 금지, attorney-controlled review |
| `P4_HIGHLY_RESTRICTED` | local-only 또는 manual 중심 |
| `P5_SECRET` | model/runtime context 입력 금지, manual 또는 secrets adapter만 |

## Codex / Claude Code 원칙

개발 runtime은 다음 원칙을 따른다.

- 독립 worktree 또는 sandbox에서 실행한다.
- 기존 dirty checkout을 직접 수정하지 않는다.
- protected file 변경을 gate에서 잡는다.
- diff와 test는 adapter self-report가 아니라 Harness가 다시 검증한다.
- Codex/Claude Code output은 `untrusted_until_verified`로 기록한다.

## 로펌용 Runtime 원칙

로펌용 runtime 기본값:

- `P2_CLIENT_CONFIDENTIAL` 이상 raw 자료는 `local_script`, `document_renderer`, `manual` 중심이다.
- agent runtime이 필요하면 redacted context, approval, policy snapshot이 필요하다.
- output은 draft-only로 생성하고 delivery는 별도 gate를 거친다.
- renderer도 산출물 생성 주체이므로 citation/format/human approval gate를 통과해야 한다.

## 완료 기준

5단계는 다음이 충족되면 완료다.

- `docs/runtime-adapter-contract.md`가 존재한다.
- `schemas/core/runtime-adapter.schema.json`이 존재한다.
- `examples/core/runtime-adapters.json`이 존재한다.
- runtime adapter registry가 schema 검증을 통과한다.
- registry가 policy matrix의 runtime/tool/output/gate와 의미 검증을 통과한다.
- capability manifest의 모든 `allowed_runtimes`가 registry에 존재한다.
- `npm run validate:core`와 `npm test`가 runtime adapter 검증까지 포함한다.
