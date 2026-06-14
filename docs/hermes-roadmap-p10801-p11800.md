# Hermes Roadmap P10801-P11800 Global Operator Console Design System

P10801-P11800은 P10800 Context Recall And Drift Guard 다음 단계다. 목표는 `hermes-operator-console-2026-06-06` reference pack을 Hermes 전체 UI의 설계 증거로 승격하고, 이후 SaaS quality gate, execution, review, release 기능이 화면에서 잘못된 신뢰를 만들지 않도록 Global Operator Console design system을 먼저 고정하는 것이다.

이 단계는 UI를 write-enabled control panel로 여는 단계가 아니다. 모든 표면은 read-only이며, Codex와 Claude는 최종 승인자가 아니고, production PASS 또는 enterprise PASS를 표시할 수 없다.

## Program Structure

| Range | Name | Goal | Output |
|---|---|---|---|
| P10801-P10820 | Reference Pack Source Inventory | 첨부 operator-console reference pack과 sanitized reference doc을 source evidence로 묶는다. | `reference_pack_source_rows` |
| P10821-P10840 | P9000 Language Reclassification | P9000-only language를 Global Operator Console language로 재분류한다. | `reference_reclassification_rows` |
| P10841-P10860 | Comparative Pattern Evidence | Linear/Jira/GitHub/Harness/Port/Sentry/Datadog/LangSmith/Langfuse pattern을 Hermes UI role로 매핑한다. | `comparative_pattern_rows` |
| P10861-P10880 | Source/Evidence Intake Contract | 원본 body/binary를 노출하지 않고 path/hash/classification/evidence_ref만 남기는 intake 계약을 만든다. | `ui_source_contract_rows` |
| P10881-P10900 | Global UI Trace Spine | Source -> Claim -> Requirement -> Evidence -> Gate -> Review -> Verdict -> Next Action spine을 고정한다. | `trace_spine_rows` |
| P10901-P10920 | Navigation Contract Draft | Queue, Projects, Requirements, Evidence, Reviews, Gates, Conversations, Actions, Domain Packs, Governance, Audit nav를 정의한다. | `navigation_contract_rows` |
| P10921-P10940 | Status Vocabulary Draft | BLOCKED, NEEDS_REVIEW, MISSING_EVIDENCE, READY_FOR_HANDOFF, READ_ONLY, LOWER_TRUST, CANDIDATE, VALIDATED vocabulary를 정의한다. | `status_vocabulary_rows` |
| P10941-P10960 | Forbidden Copy And Authority Guard | AI approved, Claude approved, Codex approved, production ready, enterprise PASS 같은 문구를 금지한다. | `forbidden_language_rows` |
| P10961-P10980 | P11001 Handoff Contract | P11001-P11200 global UI contract가 소비할 object model, nav, status, invariant를 handoff한다. | `p11001_handoff_rows` |
| P10981-P11000 | Reference Intake Freeze | P10801-P11000 source contract, schema, tests, docs, package script를 freeze한다. | `reference_intake_gate_rows` |
| P11001-P11020 | Global Object Model | source, claim, requirement, evidence, gate, review, action, verdict object를 정의한다. | `global_object_model_rows` |
| P11021-P11040 | Global Navigation IA | UI 최상위 navigation과 saved views를 확정한다. | `global_navigation_rows` |
| P11041-P11060 | Inspector Panel Contract | 우측 Object Inspector Panel의 공통 섹션을 정의한다. | `object_inspector_contract_rows` |
| P11061-P11080 | Review/Gate Boundary Contract | approval button 없이 reviewer authority, missing evidence, policy check, rollback, timeout을 표시한다. | `review_gate_boundary_rows` |
| P11081-P11100 | Conversation Source Detail Contract | raw/full body를 숨기고 redacted summary, citation, extracted claim, blocker만 표시한다. | `conversation_source_detail_rows` |
| P11101-P11120 | Domain Pack Context Contract | domain pack이 Hermes product identity로 승격되지 않도록 context-only display를 정의한다. | `domain_context_rows` |
| P11121-P11140 | UI Negative Invariants | no raw body, no write button, no final approver, no production/enterprise PASS를 hard invariant로 만든다. | `ui_negative_invariant_rows` |
| P11141-P11160 | Read-Only API Projection Contract | UI가 소비할 GET/HEAD-only view-model 계약을 정의한다. | `ui_read_only_api_contract_rows` |
| P11161-P11180 | Accessibility And Density Contract | keyboard, focus, table density, inspector scroll, semantic color, text fit 기준을 정의한다. | `accessibility_density_rows` |
| P11181-P11200 | Global UI Contract Freeze | P11201 token/component foundation이 소비할 contract를 freeze한다. | `p11200_freeze_rows` |
| P11201-P11220 | Design Token Registry | neutral base, restrained blue, semantic amber/red/green, radius 4-8px, spacing/typography token을 정의한다. | `design_token_rows` |
| P11221-P11240 | Table/List Primitive | Operator Queue와 drilldown list의 column, sort, status, overflow behavior를 정의한다. | `table_list_primitive_rows` |
| P11241-P11260 | Detail/Inspector Primitive | object summary, source refs, requirement trace, evidence chain, gate state, reviewer authority 섹션을 정의한다. | `detail_inspector_primitive_rows` |
| P11261-P11280 | Timeline Primitive | typed evidence timeline의 event type, timestamp, actor, artifact ref, linked gate를 정의한다. | `timeline_primitive_rows` |
| P11281-P11300 | Boundary Notice And Receipt Rows | blocked reason, missing receipt, next allowed action, forbidden action notice를 정의한다. | `boundary_notice_rows` |
| P11301-P11320 | Readiness Rule Matrix Primitive | scorecard가 아니라 rule matrix로 PASS/BLOCK/degraded/missing evidence를 표시한다. | `readiness_rule_matrix_rows` |
| P11321-P11340 | Review Evidence Trace Primitive | AI Review Surface가 아니라 reviewer evidence trace로 model, prompt hash, receipt, finding을 표시한다. | `review_evidence_trace_rows` |
| P11341-P11360 | Component State Matrix | default, hover, focus, selected, disabled, loading, stale, blocked, missing evidence 상태를 정의한다. | `component_state_rows` |
| P11361-P11380 | UI Smoke Fixture Plan | no overlap, no raw body, no unsafe button, nonblank shell, responsive table/detail fixture를 정의한다. | `ui_smoke_fixture_rows` |
| P11381-P11400 | Token/Component Foundation Freeze | P11401 UI v0 구현이 소비할 design foundation을 freeze한다. | `p11400_freeze_rows` |
| P11401-P11420 | Global Operator Queue v0 | 첫 화면을 queue로 만들고 item/type/project/status/owner/source/evidence/gate/review/next action column을 표시한다. | `operator_queue_surface_rows` |
| P11421-P11440 | Object Inspector Panel v0 | 선택 row의 source refs, trace spine, gate state, review authority, blocked reason을 우측 패널에 표시한다. | `object_inspector_surface_rows` |
| P11441-P11460 | Requirement Trace Detail v0 | requirement, PRD, spec, issue, test, evidence, gate, closeout link를 표시한다. | `requirement_trace_surface_rows` |
| P11461-P11480 | Review Gate Detail v0 | approve 대신 authority, missing evidence, policy result, rollback, timeout, next action을 표시한다. | `review_gate_surface_rows` |
| P11481-P11500 | Evidence Timeline v0 | time, actor, source, event type, artifact ref, review status, linked gate를 보여준다. | `evidence_timeline_surface_rows` |
| P11501-P11520 | Conversation Source Detail v0 | redacted/cited conversation source, extracted decision/blocker/validation event만 표시한다. | `conversation_surface_rows` |
| P11521-P11540 | Domain Pack Detail v0 | personal-dev, law-firm, creative-document, connector/resource, trading-readonly를 context로 표시한다. | `domain_pack_surface_rows` |
| P11541-P11560 | Governance/Audit Surface v0 | trust tier, authority boundary, source lineage, state transition, timestamp를 표시한다. | `governance_audit_surface_rows` |
| P11561-P11580 | Browser/UI Smoke v0 | read-only browser shell, nonblank, no raw/secret/write/final approval checks를 만든다. | `browser_ui_smoke_rows` |
| P11581-P11600 | Operator Queue UI v0 Freeze | queue/detail/timeline/gate/review surface를 read-only v0로 freeze한다. | `p11600_freeze_rows` |
| P11601-P11620 | UI Negative Fixture Suite | unsafe copy, raw exposure, write affordance, final approval, production PASS, enterprise PASS fixtures를 만든다. | `ui_negative_fixture_rows` |
| P11621-P11640 | Visual Regression Contract | viewport, stable dimensions, table/detail layout, no overlap, no hero/card dashboard checks를 정의한다. | `visual_regression_rows` |
| P11641-P11660 | Accessibility Regression Contract | keyboard focus, ARIA, contrast, truncation, status announcement checks를 정의한다. | `accessibility_regression_rows` |
| P11661-P11680 | Claude UI Review Packet | UI authority boundary와 false trust risk에 대해 Claude Opus review packet을 준비한다. | `claude_ui_review_packet_rows` |
| P11681-P11700 | Finding Loop And Revalidation | UI review finding이 있으면 component/contract/negative fixture로 반영한다. | `ui_finding_loop_rows` |
| P11701-P11720 | UI Governance API Alignment | UI contract, docs, schema, package scripts, API projection이 같은 language를 쓰는지 확인한다. | `ui_governance_alignment_rows` |
| P11721-P11740 | Design System Migration Guide | 기존 Work OS UI surface가 Global Operator Console design system으로 이행하는 순서를 문서화한다. | `design_system_migration_rows` |
| P11741-P11760 | P11801 Quality Gate Handoff | SaaS Quality Gate Packs가 이 UI language를 사용하도록 handoff한다. | `p11801_handoff_rows` |
| P11761-P11780 | UI Freeze Evidence Packet | schema, artifacts, smoke evidence, review receipt, unresolved finding state를 묶는다. | `ui_freeze_evidence_rows` |
| P11781-P11800 | Global Operator Console Design System Freeze | design reference, contract, token, component, surface, negative fixture, review evidence를 freeze한다. | `p11800_freeze_rows` |

## Global UI Contract

모든 core surface는 아래 spine을 보여주거나 도달 가능해야 한다.

```text
Source -> Claim -> Requirement -> Evidence -> Gate -> Review -> Verdict -> Next Action
```

## Main Navigation

- `Queue`: 모든 review, blocker, missing evidence, next action
- `Projects`: Hermes가 관리하는 project/workflow
- `Requirements`: requirement, PRD, spec, issue, test, evidence 연결
- `Evidence`: artifact, receipt, command output, citation
- `Reviews`: Codex, Claude, GitHub, owner boundary
- `Gates`: validation gate, authority gate, trust gate
- `Conversations`: raw chat이 아니라 redacted/cited source
- `Actions`: allowed, blocked, receipt-required, rollback-bound action
- `Domain Packs`: personal-dev, law-firm, creative-document, resource/connectors
- `Governance`: trust tier, read-only boundary, no-final-approval boundary
- `Audit`: owner, timestamp, status transition, source lineage

## Required Components

- `GlobalShell`
- `SavedViewSidebar`
- `OperatorQueueTable`
- `ObjectRow`
- `ObjectInspectorPanel`
- `TraceSpine`
- `SourceRef`
- `RequirementTrace`
- `EvidenceChain`
- `GateRecord`
- `ReviewLane`
- `ReadinessRuleMatrix`
- `TypedTimelineCell`
- `NextActionRow`
- `BoundaryNotice`
- `ReceiptRequirement`
- `ReviewEvidenceTrace`

## Status Vocabulary

Allowed:

- `BLOCKED`
- `NEEDS_REVIEW`
- `MISSING_EVIDENCE`
- `READY_FOR_HANDOFF`
- `READ_ONLY`
- `LOWER_TRUST`
- `CANDIDATE`
- `VALIDATED`

Forbidden:

- `AI approved`
- `Claude approved`
- `Codex approved`
- `Production ready`
- `Enterprise PASS`
- `Smart insight`
- `Auto resolved`

## Completion Criteria

```text
Global Operator Queue가 첫 화면
모든 row가 source/claim/requirement/evidence/gate/review/verdict/next action 설명 가능
raw/full transcript body 비노출
secret-bearing key 비노출
write/protected action button 없음
Codex/Claude final approver UI 없음
production ready / enterprise PASS copy 없음
domain pack은 context-only
phase/tranche id는 metadata
scorecard가 아니라 Readiness Rule Matrix
AI Review Surface가 아니라 Review Evidence Trace
P11801 quality gate pack이 동일 UI language를 소비 가능
```
