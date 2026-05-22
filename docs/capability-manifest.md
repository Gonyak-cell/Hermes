# Hermes Capability Manifest Standard

작성일: 2026-05-22

## 목적

Capability Manifest는 Hermes Harness에서 “무엇을 할 수 있는가”를 실행 가능한 계약으로 선언하는 표준이다. 기능 이름이나 prompt 파일만으로는 부족하다. capability는 입력, 출력, runtime, tool, gate, policy, 비용, 재시도, 관측성, 승인 조건까지 선언해야 한다.

핵심 원칙:

- Capability는 목록이 아니라 계약이다.
- Domain pack은 capability manifest를 통해 core에 등록된다.
- Core는 domain pack 내부 구현을 몰라도 capability를 실행하고 검증할 수 있어야 한다.
- Agent self-report는 완료 조건이 아니다. 완료 여부는 gate가 판단한다.
- 로펌용 capability는 evidence, citation, approval 정책을 명시해야 한다.

## Manifest 필수 필드

| 필드 | 설명 |
|---|---|
| `capability_id` | 전역 고유 ID. 예: `law_firm.ldd.vdr_inventory` |
| `version` | capability 계약 버전 |
| `domain_pack` | `law-firm`, `personal-dev`, `creative-document`, `common`, `platform` |
| `display_name` | 사람이 읽는 이름 |
| `description` | 목적과 범위 |
| `input_contract` | 입력 schema ID |
| `output_contract` | 출력 schema ID |
| `required_resources` | 필요한 resource/evidence/fact 유형 |
| `allowed_runtimes` | 실행 가능한 runtime adapter |
| `required_tools` | 사용할 수 있는 tool |
| `required_gates` | pre-run, in-run, post-run gate |
| `data_policy` | 허용 classification, 외부 model, redaction 정책 |
| `approval_policy` | 사람 승인 요구사항 |
| `idempotency_policy` | 중복 실행 방지 기준 |
| `retry_policy` | 실패 시 재시도 규칙 |
| `timeout_policy` | 시간 제한 |
| `cost_policy` | 비용/토큰 제한 |
| `observability_policy` | trace, prompt hash, output hash, cost 기록 수준 |
| `entrypoints` | skill, script, plugin, adapter, manual 등 실행 진입점 |

## ID 규칙

권장 형식:

```text
<domain_pack>.<area>.<verb_or_workflow>
```

예시:

- `law_firm.ldd.vdr_inventory`
- `law_firm.ldd.issue_detection`
- `law_firm.contract.review`
- `personal_dev.issue_to_worktree`
- `personal_dev.codex.diff_review`
- `document.pptx.render`
- `common.evidence.citation_gate`

## Runtime 원칙

Capability는 runtime을 직접 호출하지 않는다. Harness Orchestrator가 manifest를 읽고 runtime adapter를 선택한다.

허용 runtime:

- `harness`
- `hermes`
- `claude_code`
- `codex`
- `local_script`
- `document_renderer`
- `mcp_tool`
- `browser`
- `manual`

로펌용 기본값:

- `P2_CLIENT_CONFIDENTIAL`: raw 자료는 local/script/document renderer 중심
- `P3_PRIVILEGED` 이상: Claude Code/Codex/Hermes 외부 agent runtime 기본 금지
- 고객 전달 output: human approval 필수

## Gate 선언

모든 capability는 gate를 단계별로 선언한다.

```yaml
required_gates:
  pre_run:
    - matter_access_gate
    - classification_gate
  in_run:
    - prompt_injection_gate
  post_run:
    - evidence_coverage_gate
    - human_approval_gate
```

로펌용 권장 gate:

- `matter_access_gate`
- `classification_gate`
- `external_model_gate`
- `evidence_coverage_gate`
- `citation_gate`
- `human_approval_gate`
- `output_destination_gate`

개발용 권장 gate:

- `protected_file_gate`
- `diff_review_gate`
- `test_gate`
- `cost_budget_gate`

## Data Policy

Capability는 데이터 등급별 행동을 선언해야 한다.

필수 항목:

- `max_input_classification`
- `external_model_policy`
- `redaction_required`
- `allowed_context_types`
- `retrieval_filters_required`

예시:

```yaml
data_policy:
  max_input_classification: P2_CLIENT_CONFIDENTIAL
  external_model_policy: approval_required
  redaction_required: true
  allowed_context_types:
    - resource_metadata
    - normalized_text
    - source_span
    - evidence_item
  retrieval_filters_required:
    - tenant_id
    - matter_id
    - wall_id
    - classification
```

## Output Contract

Output은 생성과 전달을 분리해야 한다.

예시:

```yaml
output_artifacts:
  - artifact_type: markdown
    default_status: pending_review
    delivery_policy: internal_only
  - artifact_type: docx
    default_status: pending_review
    delivery_policy: partner_approval_required
```

## 3단계 완료 기준

3단계는 다음이 충족되면 완료다.

- `docs/capability-manifest.md`가 존재한다.
- `schemas/core/capability-manifest.schema.json`이 존재한다.
- 예시 capability manifest가 최소 2개 존재한다.
- 예시 manifest가 schema와 policy matrix 의미 검증을 통과한다.
- `npm run validate:core`가 capability manifest 검증까지 포함한다.
