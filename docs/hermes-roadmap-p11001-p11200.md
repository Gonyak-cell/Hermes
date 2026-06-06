# Hermes Roadmap P11001-P11200 Global UI Contract

P11001-P11200은 P10801-P11000 Global UI Reference Intake 다음 단계다. 목표는 reference evidence를 실제 Hermes UI가 소비할 전역 계약으로 고정하는 것이다. 이 단계는 component/token 구현이나 제품 화면 구현이 아니라, 모든 UI surface가 따라야 하는 object model, navigation IA, inspector panel, review/gate boundary, conversation source detail, domain context, read-only API projection, accessibility/density, negative invariant를 fail-closed로 정의한다.

이 단계의 결과가 준비되어도 write UI, protected action, Codex/Claude final approval, production PASS, enterprise PASS는 열리지 않는다.

## Phase Plan

| Range | Name | Goal | Output |
|---|---|---|---|
| P11001-P11020 | Global Object Model | source, claim, requirement, evidence, gate, review, verdict, action object를 정의한다. | `global_object_model_rows` |
| P11021-P11040 | Global Navigation IA | Queue, Projects, Requirements, Evidence, Reviews, Gates, Conversations, Actions, Domain Packs, Governance, Audit IA를 정의한다. | `global_navigation_ia_rows` |
| P11041-P11060 | Inspector Panel Contract | selected object summary, source refs, requirement trace, evidence chain, gate state, reviewer authority, blocked reason, next action, forbidden action을 우측 패널로 고정한다. | `object_inspector_contract_rows` |
| P11061-P11080 | Review/Gate Boundary Contract | approve button 없이 reviewer authority, missing evidence, policy check, rollback, timeout, lower-trust boundary를 표시한다. | `review_gate_boundary_rows` |
| P11081-P11100 | Conversation Source Detail Contract | raw/full transcript body를 숨기고 redacted summary, citation, extracted claim, decision, blocker, validation event만 표시한다. | `conversation_source_detail_rows` |
| P11101-P11120 | Domain Pack Context Contract | personal-dev, law-firm, creative-document, connector/resource, trading-readonly, HR/CRM/ERP context를 product identity가 아닌 context로 표시한다. | `domain_pack_context_rows` |
| P11121-P11140 | UI Negative Invariants | no raw body, no secret key, no write, no final approval, no production/enterprise PASS, no domain-as-product를 hard invariant로 정의한다. | `ui_negative_invariant_rows` |
| P11141-P11160 | Read-Only API Projection Contract | global-ui object, nav, inspector, review gate, conversation, domain, invariant, accessibility, summary API를 GET/HEAD-only로 정의한다. | `global_ui_api_route_rows` |
| P11161-P11180 | Accessibility And Density Contract | keyboard focus, ARIA, contrast, no viewport font scaling, table density, text fit, stable dimensions를 정의한다. | `accessibility_density_rows` |
| P11181-P11200 | Global UI Contract Freeze | P11201-P11400 token/component foundation이 소비할 전역 UI 계약을 freeze한다. | `p11200_freeze_rows` |

## Object Model

| Object | Required Role |
|---|---|
| `source` | source material, transcript ref, artifact ref, external evidence ref |
| `claim` | source에서 추출된 검토 가능한 주장 |
| `requirement` | PRD/spec/issue/test/evidence와 연결되는 요구사항 |
| `evidence` | artifact, receipt, command output, citation |
| `gate` | validation, authority, trust, release, policy gate |
| `review` | Codex/Claude/GitHub/owner review evidence와 authority boundary |
| `verdict` | PASS/BLOCK/PENDING류 상태와 hard gate 결과 |
| `action` | allowed, blocked, receipt-required, rollback-bound next action |

## UI Contract Rules

- Home은 `Global Operator Queue`다.
- phase/tranche id는 top navigation이 아니라 metadata다.
- object detail은 항상 trace spine을 노출하거나 link해야 한다.
- review/gate detail은 승인 버튼이 아니라 gate record다.
- conversation detail은 raw/full body viewer가 아니다.
- domain pack은 context-only다.
- API는 GET/HEAD-only다.
- UI copy는 Codex/Claude/AI를 final approver로 만들 수 없다.

## Exact Contract Rows

Object Inspector Panel sections:

- Selected Object Summary
- Trace Spine
- Source Refs
- Requirement Trace
- Evidence Chain
- Gate State
- Reviewer Authority
- Blocked Reason
- Next Action
- Forbidden Actions

Conversation Source Detail sections:

- Redacted summary
- Citation refs
- Extracted claims
- Plan candidates
- Decisions
- Blockers
- Validation events
- Review events
- Raw body hidden
- Full body hidden

Accessibility and density rows:

- Keyboard focus order is defined
- ARIA labels and roles are required
- Semantic contrast state is required
- Font size does not scale with viewport width
- Text must fit within parent controls
- Dense table layout stays scan-friendly
- Inspector scroll area is stable
- Status changes are screen-reader visible
- Responsive constraints prevent overlap
- Stable dimensions prevent hover/layout shift

## Completion Criteria

```text
P10801 source intake 없음 = P11200 계약 없음
source/claim/requirement/evidence/gate/review/verdict/action object model 없음 = BLOCK
Global navigation IA 없음 = BLOCK
Object Inspector Panel contract 없음 = BLOCK
Review/Gate approval button 금지
Conversation raw/full body 비노출
Domain pack product identity 금지
GET/HEAD-only projection
Accessibility/density contract 있음
Codex/Claude final approval UI 없음
production PASS 없음
enterprise PASS 없음
P11201 token/component foundation handoff 가능
P11800 design-system freeze는 아직 false
```
