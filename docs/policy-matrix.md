# Hermes Harness Policy Matrix

작성일: 2026-05-22

## 목적

Policy Matrix는 데이터 등급별로 어떤 runtime, model, tool, output destination이 허용되는지 고정하는 계약이다. 이 문서는 로펌용, 개인 개발용, 문서/콘텐츠용 domain pack이 공통으로 따라야 하는 기본 정책이다.

핵심 원칙:

- Policy는 prompt보다 강하다.
- 외부 model 전송은 항상 policy decision으로 기록한다.
- 검색과 context 구성은 matter wall과 classification을 먼저 적용한다.
- 로펌용 output은 기본적으로 draft-only다.
- 고객 발송, 법원 제출, ERP 반영, merge는 별도 approval gate를 통과해야 한다.

## 데이터 등급

| 등급 | 이름 | 의미 | 기본 외부 LLM 정책 |
|---|---|---|---|
| `P0_PUBLIC` | Public | 공개자료, 공개 레포, 공개 법령/판례, 공개 문서 | 허용 가능, audit 필요 |
| `P1_INTERNAL` | Internal | 개인/내부 작업자료, 비공개이나 고객비밀은 아닌 자료 | 제한적 허용, audit 필요 |
| `P2_CLIENT_CONFIDENTIAL` | Client Confidential | 고객 비밀자료, 사건자료, VDR, 이메일, 회의록 | 원칙적 제한, 승인 또는 redaction 필요 |
| `P3_PRIVILEGED` | Privileged | 변호사-의뢰인 비밀, 내부 법률검토, 소송전략 | 외부 전송 금지 |
| `P4_HIGHLY_RESTRICTED` | Highly Restricted | 민감 개인정보, 영업비밀, 핵심 소송전략, 수사/규제 리스크 | 격리 실행, 외부 전송 금지 |
| `P5_SECRET` | Secret / Credential | API key, password, token, credential | agent/LLM 입력 금지 |

## Runtime 정책

| 등급 | Harness | Hermes | Claude Code | Codex | Local Script | Document Renderer | MCP/Connector |
|---|---|---|---|---|---|---|---|
| `P0_PUBLIC` | 허용 | 허용 | 허용 | 허용 | 허용 | 허용 | 허용 |
| `P1_INTERNAL` | 허용 | 허용 | 허용 | 허용 | 허용 | 허용 | 제한적 허용 |
| `P2_CLIENT_CONFIDENTIAL` | 허용 | 정책 스냅샷 필요 | redacted context만 | redacted context만 | 허용 | 허용 | matter-scoped adapter만 |
| `P3_PRIVILEGED` | 허용 | local-only 또는 금지 | 금지 | 금지 | 허용 | 허용 | 금지 또는 전용 adapter |
| `P4_HIGHLY_RESTRICTED` | 허용 | 금지 | 금지 | 금지 | sandbox/local-only | sandbox/local-only | 금지 |
| `P5_SECRET` | secrets adapter만 | 금지 | 금지 | 금지 | 직접 노출 금지 | 금지 | secrets adapter만 |

## Model 전송 정책

| 등급 | 외부 LLM | 로컬/전용 모델 | redaction | 사람 승인 |
|---|---|---|---|---|
| `P0_PUBLIC` | 허용 | 허용 | 선택 | 불필요 |
| `P1_INTERNAL` | 허용 가능 | 허용 | 권장 | 불필요 또는 사후 audit |
| `P2_CLIENT_CONFIDENTIAL` | 승인 필요 | 허용 가능 | 필수 또는 강력 권장 | 필요 |
| `P3_PRIVILEGED` | 금지 | 허용 가능 | 내부 정책 필요 | 필요 |
| `P4_HIGHLY_RESTRICTED` | 금지 | 제한적 허용 | 필수 | 필요 |
| `P5_SECRET` | 금지 | 금지 | 해당 없음 | 해당 없음 |

## Tool 정책

| Tool | 기본 정책 |
|---|---|
| filesystem read | matter/team 권한과 classification gate 통과 시 허용 |
| filesystem write | workflow workspace 또는 output store 안에서만 허용 |
| terminal | 개인 개발은 worktree/sandbox 권장, 로펌 자료는 local script allowlist 우선 |
| web browsing | `P0_PUBLIC`, `P1_INTERNAL` 중심. 로펌 비밀자료를 query로 보내지 않음 |
| external API | adapter별 최소권한, policy snapshot 기록 |
| email send | draft 생성만 기본 허용, 실제 발송은 approval 필요 |
| ERP/billing | draft-only, 실제 발행은 approval 필요 |
| GitHub merge | PR draft까지 기본, merge는 protected gate 필요 |
| document renderer | output artifact 생성 가능, delivery는 별도 approval |
| vector retrieval | retrieval 전 matter/client/wall/classification filter 강제 |

## Output 정책

| Output | 기본 상태 | 필수 Gate |
|---|---|---|
| internal markdown note | draft | evidence gate |
| DOCX legal memo | pending_review | evidence gate, citation gate, attorney review |
| LDD report | pending_review | VDR coverage gate, evidence gate, citation gate, attorney review |
| litigation brief | pending_review | evidence gate, procedural deadline gate, attorney approval |
| contract draft | pending_review | clause consistency gate, attorney review |
| email draft | draft | destination gate, human approval |
| GitHub PR draft | draft | diff review gate, test gate |
| ERP billing draft | draft | billing approval gate |
| public content | pending_review | redaction gate, confidentiality gate |

## 기본 Gate 요구사항

| Gate | 적용 시점 | 설명 |
|---|---|---|
| `matter_access_gate` | pre-run | 사용자/agent가 matter 자료에 접근 가능한지 확인 |
| `classification_gate` | pre-run | 데이터 등급별 runtime/model/tool 허용 여부 확인 |
| `external_model_gate` | pre-run | 외부 LLM 전송 가능 여부 확인 |
| `tool_permission_gate` | pre-run/in-run | tool 사용 권한 확인 |
| `prompt_injection_gate` | in-run | 외부 문서 내 지시문을 instruction으로 취급하지 않도록 방어 |
| `protected_file_gate` | pre-run/post-run | secrets, production config, 중요 파일 변경 제한 |
| `evidence_coverage_gate` | post-run | 핵심 주장과 source span 연결 확인 |
| `citation_gate` | post-run | citation의 source span/evidence 연결 확인 |
| `test_gate` | post-run | 개발 pack의 canonical test 실행 |
| `human_approval_gate` | post-run | 사람 승인 대기/완료 확인 |
| `output_destination_gate` | post-run | 이메일, ERP, PR merge, 고객전달 전 승인 확인 |
| `cost_budget_gate` | pre-run/in-run | 비용과 토큰 budget 확인 |

## PolicySnapshot 반영 규칙

workflow 실행 시점에는 Policy Matrix 전체를 그대로 참조하지 않고 `PolicySnapshot`을 남긴다.

필수 기록:

- 적용된 matrix id와 version
- classification decision
- 허용된 runtime과 tool
- 외부 model 전송 허용/금지 판단
- 필요한 redaction 여부
- 필요한 approval 종류
- gate 목록

이렇게 해야 나중에 정책이 바뀌어도 과거 산출물이 어떤 정책 아래 생성되었는지 재현할 수 있다.

## 2단계 완료 기준

2단계는 다음이 충족되면 완료다.

- `docs/policy-matrix.md`가 존재한다.
- `schemas/core/policy-matrix.schema.json`이 존재한다.
- `examples/core/policy-matrix.json`이 schema와 의미 검증을 통과한다.
- core vertical slice 검증과 policy matrix 검증이 모두 `npm run validate:core`에 포함된다.
