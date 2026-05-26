# Hermes Harness Final Completion Phase Ledger (P089-P312)

이 문서는 Phase 88 이후 Hermes Harness v1.0 최종 완성까지의 planned slot을 Phase 88 이전과 같은 세밀도로 운영하기 위한 장부다. 아직 완료된 구현 기록이 아니므로 `## Phase N` heading을 쓰지 않는다. 각 planned slot은 구현, 검증, commit이 끝난 뒤에만 `docs/implementation-roadmap.md`의 실제 phase로 승격한다.

운영 규칙:

- 현재 완료 기준점은 Phase 171이다.
- 남은 planned slot은 P172-P312, 총 141개다.
- 각 slot은 `검증 -> 보강 -> 구현 -> 검증 -> commit -> roadmap 승격` 순서로 처리한다.
- 모든 slot은 가능하면 `npm run validate`, `npm test`, 해당 slice command, `npm run control-plane:loop`, API/dashboard smoke 중 관련 검증을 통과해야 한다.
- 미래 planned slot은 구현 완료처럼 계산되지 않도록 `P089` 형식으로만 표기한다.

## P089-P096 Human Review Cycle Closure

| Slot | 목표 | 주요 산출물 | 완료 기준 |
| --- | --- | --- | --- |
| P089 | Phase 88 reconciliation 결과를 기준선으로 고정 | reconciliation baseline report, blocker inventory | Promoted to Phase 89; pending receipt, held command, protected hold count가 source artifact와 일치 |
| P090 | manual command receipt 입력 pack을 사람이 작성 가능한 형태로 정리 | per-actor receipt pack, editable receipt template | Promoted to Phase 90; actor별 target receipt path와 required field가 누락 없이 표시 |
| P091 | held command를 actor별 resolution plan으로 분해 | held command resolution ledger | Promoted to Phase 91; 각 held command가 required actor, unblock condition, follow-on action을 가짐 |
| P092 | protected approval request를 별도 승인 pack으로 분리 | protected approval request pack | Promoted to Phase 92; protected action이 command receipt와 섞이지 않고 explicit approval 상태로 추적 |
| P093 | 수동 receipt 재검증 루프를 닫음 | manual receipt revalidation stage | Promoted to Phase 93; 사람이 입력한 receipt만 ready/applied 후보가 되고 자동 실행은 0으로 유지 |
| P094 | command queue patch를 실행 전 projection으로 검증 | command queue patch projection | Promoted to Phase 94; patch 대상, 변경 전후 상태, audit event 후보가 schema 검증 통과 |
| P095 | Human Review Cycle closeout ledger 생성 | closeout ledger, actor closeout summary | Promoted to Phase 95; 모든 blocker가 pending, approved, rejected, superseded 중 하나로 정규화 |
| P096 | Human Review v1 regression freeze | regression fixture, freeze note | Promoted to Phase 96; closure artifact hash manifest, invariant checkpoint, no-execution freeze note, dashboard/API/checkpoint 노출이 통과 |

## P097-P112 Core Contracts, Schema, Migration Spine

| Slot | 목표 | 주요 산출물 | 완료 기준 |
| --- | --- | --- | --- |
| P097 | 현재 schema와 artifact contract 전체 inventory | contract inventory, owner map | Promoted to Phase 97; schema, script, loop artifact, dashboard source, API route, artifact contract, owner map이 목록화 |
| P098 | contract 간 dependency map 작성 | dependency graph, breaking-change risk list | Promoted to Phase 98; core/domain/runtime/dashboard 의존 방향, owner dependency, breaking-change risk가 목록화 |
| P099 | Resource/ResourceVersion contract 고정 | resource schema v2, version fixture | Promoted to Phase 99; content hash, source system, external id, classification, matter link, version link가 v2 fixture와 validation item으로 검증 |
| P100 | Matter/Client/Party contract 고정 | matter/client/counterparty schema | Promoted to Phase 100; client, party, counterparty, matter, team, boundary 필드가 v2 fixture와 validation item으로 검증 |
| P101 | DataClassification/Policy contract 고정 | classification schema, policy reference schema | Promoted to Phase 101; P0-P5 classification과 policy snapshot reference가 v2 fixture와 validation item으로 검증 |
| P102 | Evidence/Fact/Issue/Citation contract 고정 | evidence lineage schema family | Promoted to Phase 102; source span, evidence, fact, issue, citation, lineage edge가 v2 fixture와 validation item으로 검증 |
| P103 | Capability/Workflow contract 고정 | capability manifest v2, workflow schema | Promoted to Phase 103; input/output/gate/runtime/version 필드가 required/optional로 구분되고 dashboard/API/loop/checkpoint에 노출 |
| P104 | Runtime/AgentRun contract 고정 | runtime adapter schema, agent run schema | Promoted to Phase 104; runtime output, logs, artifacts, risk level, verification flag가 dashboard/API/loop/checkpoint에서 검증 |
| P105 | Gate/Approval contract 고정 | gate result schema, approval schema | Promoted to Phase 105; GateResult v2와 ApprovalRequest/Decision/Authority v2가 분리되고 human approval gate binding이 검증 |
| P106 | OutputArtifact/Delivery contract 고정 | output artifact schema, delivery schema | Promoted to Phase 106; OutputArtifact v2와 DeliveryAction/Receipt v2가 분리되고 artifact hash, approval link, delivery binding, state transition이 검증 |
| P107 | Event/Audit/Run Ledger contract 고정 | event/audit/run ledger schema | Promoted to Phase 107; EventRecord v2, AuditEvent v2, RunLedger v2, EventRunBinding v2가 correlation id, actor, policy snapshot, schema version으로 검증 |
| P108 | Error/Cost/Observability contract 고정 | error, cost, trace projection schema | Promoted to Phase 108; ErrorRecord v2, CostObservation v2, TraceProjection v2가 실패, retry, token, cost, latency를 독립 projection으로 검증 |
| P109 | schema versioning rule 확정 | schema versioning guideline | Promoted to Phase 109; optional addition, deprecation, migration manifest rule이 schema-versioning validator와 dashboard/API/checkpoint에 반영 |
| P110 | migration manifest 구조 확정 | migration manifest schema | Promoted to Phase 110; core/pack/index migration manifest, migration record, validation, dashboard/API/checkpoint/loop가 분리 추적 |
| P111 | contract golden fixtures 구성 | golden fixture set | Promoted to Phase 111; 대표 contract artifact 14개가 schema validation과 regression hash manifest에 사용; Phase 113에서 identity_model fixture, Phase 114에서 client_counterparty_registry fixture, Phase 115에서 matter_profile_team_ledger fixture, Phase 116에서 wall_policy_contract fixture, Phase 117에서 matter_access_policy_evaluator fixture, Phase 118에서 data_classification_rule_engine fixture, Phase 119에서 model_policy_enforcement fixture, Phase 120에서 tool_runtime_policy_enforcement fixture, Phase 121에서 output_destination_policy_enforcement fixture, Phase 122에서 approval_authority_ledger fixture, Phase 123에서 policy_snapshot_binding_ledger fixture, Phase 124에서 matter_tagging_decision_ledger fixture, Phase 125에서 access_audit_projection fixture, Phase 126에서 store_policy_adapter fixture, Phase 127에서 conflict_check_interface fixture, Phase 128에서 personal_workspace_boundary fixture, Phase 129에서 policy_golden_fixtures fixture, Phase 130에서 policy_operations_surface fixture, Phase 131에서 matter_boundary_slice fixture, Phase 132에서 identity_policy_matter_freeze fixture, Phase 133에서 resource_store_interface fixture, Phase 134에서 immutable_object_store_layout fixture, Phase 135에서 resource_version_ledger fixture, Phase 136에서 normalized_text_contract fixture, Phase 137에서 extractor_adapter_contract fixture, Phase 138에서 source_span_store fixture, Phase 139에서 evidence_item_store fixture, Phase 140에서 fact_claim_store fixture, Phase 141에서 issue_graph_store fixture, Phase 142에서 citation_object_store fixture, Phase 143에서 lineage_graph_builder fixture, Phase 144에서 evidence_coverage_score fixture, Phase 145에서 evidence_flags fixture, Phase 146에서 exhibit_map fixture, Phase 147에서 chain_of_custody_events fixture, Phase 148에서 search_index_contract fixture, Phase 149에서 vector_index_policy_boundary fixture, Phase 150에서 retrieval_filter_compiler fixture, Phase 151에서 evidence_golden_fixtures fixture, Phase 152에서 resource_dedup_hash_ledger fixture, Phase 153에서 resource_quarantine_model fixture, Phase 154에서 evidence_viewer_data_api fixture, Phase 155에서 evidence_export_bundle fixture, Phase 156에서 evidence_regression_tests fixture, Phase 157에서 resource_evidence_dashboard_summary fixture, Phase 158에서 evidence_plane_freeze fixture, Phase 159에서 event_envelope_ledger fixture, Phase 160에서 event_type_registry fixture, Phase 161에서 append_only_event_store fixture, Phase 162에서 event_correlation_ledger fixture, Phase 163에서 workflow_run_ledger fixture, Phase 164에서 agent_run_ledger fixture, Phase 165에서 tool_invocation_ledger fixture, Phase 166에서 audit_event_ledger fixture, Phase 167에서 policy_snapshot_event_binding fixture, Phase 168에서 cost_record_projection fixture, Phase 169에서 token_usage_projection fixture, Phase 170에서 observability_trace_projection fixture, Phase 171에서 error_retry_ledger fixture가 추가되어 현재 73개 |
| P112 | contract validation CLI 통합 | contract validation command | Promoted to Phase 112; 전체 contract fixture가 `npm run contracts:validate -- --check` 한 명령으로 검증되고 dashboard/API/checkpoint/loop에 반영 |

## P113-P132 Identity, Policy, Matter Boundary

| Slot | 목표 | 주요 산출물 | 완료 기준 |
| --- | --- | --- | --- |
| P113 | tenant/user/role model 구현 | identity schema, identity fixture | Promoted to Phase 113; actor와 human user가 tenant/role/role assignment/binding으로 구분되고 dashboard/API/golden fixture에 반영 |
| P114 | client/counterparty registry 구현 | client registry, counterparty registry | Promoted to Phase 114; stable party id, client registry, counterparty registry, matter-party links, conflict reference index가 dashboard/API/golden/checkpoint/loop에 반영 |
| P115 | matter profile/team model 구현 | matter team ledger | Promoted to Phase 115; matter profile, team roster, membership, access subject가 materialize되고 matter access가 active team membership 기준으로 판단되며 dashboard/API/golden/checkpoint/loop에 반영 |
| P116 | ethical wall/conflict wall contract 구현 | wall policy schema | Promoted to Phase 116; ethical wall/conflict wall rule이 pre-retrieval wall policy, retrieval filter, subject binding, conflict binding으로 materialize되고 dashboard/API/golden/checkpoint/loop에 반영 |
| P117 | Matter Access Policy evaluator 구현 | access decision artifact | Promoted to Phase 117; user/runtime/resource/matter 조합이 allow/deny/review로 판정되고 dashboard/API/golden/checkpoint/loop에 반영 |
| P118 | Data Classification rule engine 구현 | classifier rule catalog | Promoted to Phase 118; resource classification이 PolicyReference/PolicyDecision/Matter Access decision에 연결되고 dashboard/API/golden/checkpoint/loop에 반영 |
| P119 | Model Policy Matrix enforcement 구현 | model routing policy gate | Promoted to Phase 119; P2-P5 외부 모델 전송 제한이 classification/resource/route model gate로 강제되고 dashboard/API/golden/checkpoint/loop에 반영 |
| P120 | Tool/Runtime Policy enforcement 구현 | tool permission gate | Promoted to Phase 120; runtime별 허용/금지 tool, protected action, AgentRun tool gate가 policy matrix와 runtime contract 기준으로 검증되고 dashboard/API/golden/checkpoint/loop에 반영 |
| P121 | Output Destination Policy 구현 | destination policy gate | Promoted to Phase 121; email/ERP/GitHub/manual delivery가 draft generation과 final action으로 분리되고 output_destination_gate, Tool/Runtime protected tool gate, approval/receipt controls가 dashboard/API/golden/checkpoint/loop에 반영 |
| P122 | Approval Authority model 구현 | approval authority ledger | Promoted to Phase 122; OutputArtifact/ApprovalRequest/DeliveryAction별 승인권자가 Identity/Matter Team/Output Destination/Gate Approval contract 기준으로 판정되고 role assignment가 없으면 auto-approval 없이 assignment_required로 보존 |
| P123 | Policy Snapshot binding 구현 | policy snapshot binder | Promoted to Phase 123; workflow/agent/event/audit/run/gate/approval/output/delivery binding이 실행 당시 policy snapshot으로 해소되고 unresolved placeholder는 fallback_resolved reference로 추적 |
| P124 | Matter tagging decision ledger 구현 | matter tagging ledger | Promoted to Phase 124; 자동 후보, 사람 확인 대기열, correction history가 분리되고 unassigned resource는 자동 적용 없이 pending human confirmation으로 유지 |
| P125 | access audit projection 구현 | access audit view | Promoted to Phase 125; Matter Access Policy decision이 user/runtime/matter/resource/policy snapshot별 audit record와 actor/resource rollup으로 조회 가능 |
| P126 | store-level policy/RLS 설계 반영 | RLS design doc, store policy adapter | Promoted to Phase 126; access audit row가 store query plan으로 컴파일되고 tenant/matter/classification/policy snapshot/access audit filter와 negative RLS probe가 query layer에서 검증 |
| P127 | conflict check interface 구현 | conflict check request/result artifact | Promoted to Phase 127; 수임/자료접근 전 conflict check request/result/signal이 생성되고 counterparty signal은 review-held 상태로 dashboard/API/golden/checkpoint/loop에 반영 |
| P128 | personal workspace boundary 구현 | personal tenant policy | Promoted to Phase 128; 개인 프로젝트와 로펌 matter가 별도 tenant, policy snapshot, domain pack, search namespace로 분리되고 cross-workspace probe가 모두 blocked로 검증 |
| P129 | policy golden fixtures 구축 | policy fixture set | Promoted to Phase 129; 허용/검토/차단 대표 case 15개와 regression hash 15개가 잠기고 review case는 human gate, deny case는 blocked 상태로 검증 |
| P130 | policy dashboard/API 노출 | policy API routes, dashboard panel | Promoted to Phase 130; policy operations surface가 decision, violation, pending approval row를 정규화하고 dashboard/API/checkpoint/golden fixture에서 validation error 없이 조회 가능 |
| P131 | matter boundary vertical slice | boundary slice command | Promoted to Phase 131; resource ingest -> Resource v2 -> Matter Access -> Access Audit -> Store Query/RLS Probe -> Policy Surface path가 validation error 없이 통과하고 unassigned resource는 executable retrieval 없이 matter tagging/human gate에 held |
| P132 | Identity/Policy/Matter freeze | policy freeze report | Promoted to Phase 132; P113-P131 source artifact, policy fixture, policy operations surface, matter boundary slice, personal workspace boundary checkpoint가 validation error 없이 freeze report에 고정되고 protected action/external delivery/auto approval count는 0으로 유지 |

## P133-P158 Resource, Data, Evidence, Lineage Plane

| Slot | 목표 | 주요 산출물 | 완료 기준 |
| --- | --- | --- | --- |
| P133 | resource store interface 구현 | resource store adapter contract | Promoted to Phase 133; Resource v2/ResourceVersion v2가 resource_store/resource_version_store record로 projection되고 registry, ingestion, dashboard adapter binding이 동일 `resource-store-interface.v1` 계약을 사용하며 resource query는 tenant/matter/classification/resource filter와 store policy gate 아래에서 non-executable 상태로 검증 |
| P134 | immutable object store layout 구현 | object store layout doc, path resolver | Promoted to Phase 134; ResourceVersion store record가 `raw-source` namespace object key로, OutputArtifact v2가 `generated-output` namespace object key로 projection되고 tenant/matter/stable id/content hash를 포함하며 절대 source path leakage와 object key collision 없이 검증 |
| P135 | resource versioning 구현 | resource version ledger | Promoted to Phase 135; ResourceVersion store record가 `source_system + external_id` family로 묶이고 content hash 변경, duplicate content, skipped duplicate candidate가 별도 event/transition으로 구분되며 모든 version이 P134 raw-source object path에 binding됨 |
| P136 | normalized text contract 구현 | normalized text artifact | Promoted to Phase 136; Resource Ingest의 normalized text가 ResourceVersion, Resource Version Ledger family, raw-source object key에 binding되고 `utf16_code_unit` char range, page/paragraph/line location map, ready source span seed를 보존 |
| P137 | parser/OCR adapter contract 구현 | extractor adapter interface | Promoted to Phase 137; extractor adapter catalog, I/O contract, document type binding, OCR fallback policy, normalized text binding이 생성되고 모든 P136 normalized text artifact가 local-only extractor adapter에 bound |
| P138 | source span model 구현 | source span store | Promoted to Phase 138; P136 normalized text와 P137 extractor adapter binding에서 whole document/page/paragraph/line/char range source span이 materialize되고 file resource timestamp는 `not_applicable`로 명시되며 dashboard/API/golden/checkpoint/loop에 반영 |
| P139 | evidence item store 구현 | evidence store schema | Promoted to Phase 139; P138 source span에서 review-pending evidence item이 생성되고 source span binding, review queue, matter/classification/policy snapshot preservation이 dashboard/API/golden/checkpoint/loop에 반영 |
| P140 | fact claim store 구현 | fact claim schema | Promoted to Phase 140; P139 evidence item에서 review-pending fact claim이 생성되고 evidence id, reliability, matter/classification/policy snapshot/source span preservation이 dashboard/API/golden/checkpoint/loop에 반영 |
| P141 | issue graph store 구현 | issue graph schema | Promoted to Phase 141; fact claim에서 review-pending issue 후보가 생성되고 fact binding, legal rule placeholder, risk severity assessment, review queue, matter/classification/policy/evidence preservation이 dashboard/API/golden/checkpoint/loop에 반영 |
| P142 | citation object store 구현 | citation schema | Promoted to Phase 142; review-pending output paragraph와 source span 연결이 citation object, paragraph-source binding, citation review queue로 객체화되고 dashboard/API/golden/checkpoint/loop에 반영 |
| P143 | lineage graph builder 구현 | lineage graph artifact | Promoted to Phase 143; citation object마다 source -> evidence -> fact -> issue -> output 경로와 direct citation edge가 lineage node/edge/path graph로 재현되고 dashboard/API/golden/checkpoint/loop에 반영 |
| P144 | evidence coverage scoring 구현 | coverage score artifact | Promoted to Phase 144; 핵심 주장/날짜/당사자/금액/법률근거 coverage가 계산되고 dashboard/API/golden/checkpoint/loop에 반영 |
| P145 | reliability/privilege/redaction flags 구현 | evidence flags | Promoted to Phase 145; 자동추출, 사람확인, privilege, redaction, external transfer 상태가 별도 decision으로 분리되고 dashboard/API/golden/checkpoint/loop에 반영 |
| P146 | exhibit mapping 구현 | exhibit map artifact | Promoted to Phase 146; 보고서/소송서면의 `별첨 n`이 evidence, citation, output paragraph, lineage path에 bound되고 dashboard/API/golden/checkpoint/loop에 반영 |
| P147 | chain of custody events 구현 | custody event ledger | Promoted to Phase 147; upload, normalize, extract, review, approve가 append-only custody event로 기록되고 actor/hash/matter/classification/policy snapshot/human approval hold가 dashboard/API/golden/checkpoint/loop에 반영 |
| P148 | search index contract 구현 | search index manifest | Promoted to Phase 148; resource/evidence/citation/lineage/exhibit/custody 검색 manifest와 held query plan이 생성되고 tenant/matter/classification/policy snapshot 필터가 필수로 강제되며 dashboard/API/golden/checkpoint/loop에 반영 |
| P149 | vector index policy boundary 구현 | vector policy gate | Promoted to Phase 149; P148 held query plan이 vector policy gate로 감싸지고 classification별 embedding route policy가 matter wall, classification, external model policy, policy snapshot boundary 아래에서 held/non-executable 상태로 검증 |
| P150 | retrieval filters 구현 | retrieval filter compiler | Promoted to Phase 150; P148 held query plan과 P149 vector/embedding policy route가 tenant/matter/classification/policy snapshot/wall/access audit compiled filter와 blocked probe 아래에 묶이고 query adapter가 없으면 non-executable 상태로 유지 |
| P151 | evidence extraction golden cases 구축 | evidence golden fixtures | Promoted to Phase 151; LDD/회의록/계약서/고객 이메일 대표 문서에서 기대 evidence term, source span, EvidenceItem store match, human review requirement, regression hash가 validation error 없이 locked |
| P152 | resource dedup/hash 구현 | dedup ledger | Promoted to Phase 152; ResourceVersion이 content hash group, external id group, classification-only dedup decision, duplicate candidate link, hash integrity check로 분류되고 destructive mutation은 금지됨 |
| P153 | quarantine model 구현 | quarantine schema/dashboard | Promoted to Phase 153; 민감/오류/암호화 또는 materialization/대용량/불명확 matter-type/duplicate-hash 자료가 non-mutating quarantine overlay와 pending human review queue로 자동 보류되고 retrieval/external transfer/output delivery는 차단됨 |
| P154 | evidence viewer data API 구현 | evidence/source-span API routes | Promoted to Phase 154; Evidence Viewer Data API가 evidence card, source span panel, lineage path panel을 read-only contract로 묶고 Review API에서 viewer/source-span/lineage 조회 route를 제공 |
| P155 | evidence export bundle 구현 | evidence bundle artifact | Promoted to Phase 155; 산출물 검토용 source/citation/coverage/lineage/exhibit 묶음이 read-only internal review bundle로 생성되고 delivery/external transfer/client-facing 상태가 차단됨 |
| P156 | evidence regression tests 구축 | evidence test suite | Promoted to Phase 156; extractor golden fixture, lineage path, coverage score가 local deterministic regression suite와 sha256 hash로 회귀 검증되고 외부서비스/고객전달은 차단됨 |
| P157 | resource/evidence dashboard summary 구현 | resource evidence dashboard panel | Promoted to Phase 157; ingest, store, quarantine, evidence, viewer, coverage, export, regression 현황이 read-only dashboard panel과 matter/classification rollup/API route로 조회 가능하며 client-facing/delivery mutation은 차단됨 |
| P158 | Evidence Plane freeze | evidence plane freeze report | Promoted to Phase 158; 대표 confidential resource가 source span/evidence/citation/output/event/run/custody/export bundle까지 bound되고 attorney review, delivery block, external transfer block, client-facing ready 0 guard가 freeze report로 검증됨 |

## P159-P176 Event, Run Ledger, Audit, Observability

| Slot | 목표 | 주요 산출물 | 완료 기준 |
| --- | --- | --- | --- |
| P159 | CloudEvents-style envelope 구현 | event envelope schema | Promoted to Phase 159; EventRecord v2/AuditEvent v2가 id, specversion, type, source, time, dataschema, datacontenttype, data를 가진 envelope로 projection되고 source binding round-trip, schema version, JSON data, protected action audit flag preservation이 검증됨 |
| P160 | event type registry 구현 | event registry | Promoted to Phase 160; event envelope type이 resource/workflow/agent/gate/approval/output required family와 extra family로 catalog화되고 envelope별 type binding, schema/dataschema preservation, dashboard/API/checkpoint/golden fixture가 검증됨 |
| P161 | append-only event store 구현 | event store adapter | Promoted to Phase 161; 모든 event envelope가 immutable/hash-chained stored event로 projection되고 correction은 in-place mutation 없이 `event.correction.recorded` append event 정책으로만 허용되며 dashboard/API/checkpoint/golden fixture가 검증됨 |
| P162 | correlation/causation id 구현 | correlation model | Promoted to Phase 162; append-only stored event가 correlation trace, causation edge, trace/run binding으로 projection되고 run-bound matter/workflow/run/event trace와 audit-only external control trace가 dashboard/API/checkpoint/golden fixture로 검증됨 |
| P163 | workflow run ledger 구현 | workflow run ledger | Promoted to Phase 163; run-bound correlation trace가 event-backed workflow run record, workflow state transition, workflow event binding으로 projection되고 terminal state가 RunLedger status와 정렬되며 dashboard/API/checkpoint/golden fixture로 검증됨 |
| P164 | agent run ledger 구현 | agent run ledger | Promoted to Phase 164; runtime AgentRun이 workflow run ledger, IO/log/artifact reference, append-only agent state event binding으로 projection되고 dashboard/API/checkpoint/golden fixture로 검증됨 |
| P165 | tool invocation ledger 구현 | tool call ledger | Promoted to Phase 165; runtime 내부 tool usage 가능성, permission decision, protected action blocker, AgentRun event context가 tool invocation ledger로 추적되고 dashboard/API/checkpoint/golden fixture로 검증됨 |
| P166 | audit trail separation 구현 | audit event ledger | Promoted to Phase 166; AuditEvent v2와 Access Audit Projection이 audit trail record, separation binding, source rollup으로 정규화되고 observability log와 분리된 audit plane으로 dashboard/API/checkpoint/golden fixture에서 검증됨 |
| P167 | policy snapshot event binding 구현 | event policy binding | Promoted to Phase 167; EventRecord v2, AuditEvent v2, RunLedger v2, EventRunBinding v2, GateResult v2가 execution-time policy snapshot id, P123 resolved binding, append-only stored event snapshot preservation으로 검증됨 |
| P168 | cost record projection 구현 | cost ledger | Promoted to Phase 168; provider/token, runtime seconds, storage/output artifact, API/tool invocation 비용 신호가 projected cost record와 run/category rollup으로 정규화되어 workflow run과 run ledger에 귀속됨 |
| P169 | token usage projection 구현 | token ledger | Promoted to Phase 169; Token Usage Ledger의 input/output/cache token이 projected token usage record로 정규화되고 capability/runtime/capability-runtime/domain/matter/tracking status rollup으로 집계되며 P168 provider cost record와 binding됨 |
| P170 | observability trace model 구현 | trace projection | Promoted to Phase 170; workflow, agent, gate, output record가 `observability_trace_id`와 `correlation_trace_id`에 binding되고 external-control trace는 별도 보존 |
| P171 | error/retry ledger 구현 | error ledger | Promoted to Phase 171; ErrorRecord v2가 projected error, retry, timeout, resume-state row로 분리되고 auto retry 0, trace binding 100%, dashboard/API/golden/checkpoint/loop 검증 통과 |
| P172 | event replay harness 구현 | replay command | 이벤트로 run summary와 dashboard projection을 재구성 |
| P173 | retention/archive ledger 구현 | retention ledger | audit/event/output retention policy가 기록 |
| P174 | ledger API/dashboard 구현 | ledger API routes, dashboard panels | run, audit, cost, error, event를 조회 |
| P175 | ledger golden fixtures 구축 | ledger fixture suite | replay, projection, cost, audit fixture가 검증 |
| P176 | Observability freeze | observability freeze report | trace/cost/audit/run ledger가 control-plane loop에 통합 |

## P177-P194 Capability, Workflow, Context, Gate Engine

| Slot | 목표 | 주요 산출물 | 완료 기준 |
| --- | --- | --- | --- |
| P177 | capability manifest v2 구현 | capability manifest schema | input/output/gates/runtime/policy/version 필드 검증 |
| P178 | pack manifest compatibility 구현 | pack compatibility checker | pack이 core version과 dependency를 선언 |
| P179 | workflow DSL state model 구현 | workflow state schema | started, waiting, gated, approved, failed, completed 상태가 명확 |
| P180 | workflow state machine runner 구현 | workflow runner | transition guard와 audit event가 함께 생성 |
| P181 | queue/retry/backoff contract 구현 | queue contract | retry 가능/불가 오류와 backoff 정책이 분리 |
| P182 | idempotency key manager 구현 | idempotency ledger | 중복 실행이 동일 run 또는 skipped duplicate로 처리 |
| P183 | resume/cancel semantics 구현 | resume/cancel contract | 장기 작업이 안전하게 중단/재개됨 |
| P184 | context builder contract 구현 | context packet v2 | accessible resource, excluded resource, token budget, citation hint가 명시 |
| P185 | retrieval compiler 구현 | retrieval compiler artifact | matter wall, classification, relevance, source span 우선순위가 적용 |
| P186 | prompt injection boundary 구현 | untrusted content wrapper | 외부 문서 내 지시문이 evidence content로만 취급 |
| P187 | pre-run gate framework 구현 | pre-run gate runner | access, model, tool, budget, conflict gate가 실행 전 판단 |
| P188 | in-run gate framework 구현 | in-run gate runner | dangerous command, sensitive access, timeout이 실행 중 차단 |
| P189 | post-run gate framework 구현 | post-run gate runner | evidence, citation, test, approval, delivery gate가 실행 후 판단 |
| P190 | gate result aggregator 구현 | gate aggregate artifact | gate별 pass/fail/warn/manual state가 workflow status로 합쳐짐 |
| P191 | capability registry API 구현 | capability API routes | pack/capability/version/gate requirement 조회 가능 |
| P192 | workflow run dashboard 구현 | workflow dashboard panel | queue, state, retry, gate, output 상태 조회 가능 |
| P193 | workflow golden cases 구축 | workflow fixture suite | law/dev/document 대표 workflow가 state machine을 통과 |
| P194 | Workflow/Gate freeze | workflow gate freeze report | capability->workflow->gate->audit vertical slice 통과 |

## P195-P212 Runtime Adapter, Sandbox, Worktree, Secrets

| Slot | 목표 | 주요 산출물 | 완료 기준 |
| --- | --- | --- | --- |
| P195 | runtime adapter interface v2 구현 | runtime adapter contract | input, output, artifact, log, risk, verification 필드 고정 |
| P196 | Hermes runtime adapter 구현 | hermes adapter | Hermes 호출 결과가 agent run ledger로 수집 |
| P197 | Claude Code adapter contract 구현 | claude-code adapter stub/contract | Claude Code lane이 직접 신뢰되지 않고 diff/gate 대상으로 처리 |
| P198 | Codex adapter contract 구현 | codex adapter | Codex output이 untrusted patch로 저장되고 검증 대기 |
| P199 | local script adapter 구현 | local script adapter | deterministic extractor/renderer가 runtime contract로 실행 |
| P200 | document renderer adapter 구현 | renderer adapter | DOCX/PPTX/PDF 생성 로그와 artifacts가 수집 |
| P201 | worktree manager v2 구현 | worktree manager | agent별 branch/worktree 생성, status, cleanup이 추적 |
| P202 | sandbox policy model 구현 | sandbox policy schema | local/docker/ssh/cloud 실행 가능 범위가 policy로 결정 |
| P203 | Docker/local backend selector 구현 | backend selector | 위험도와 data classification에 따라 backend가 선택 |
| P204 | secrets broker contract 구현 | secrets access interface | agent가 secret 원문에 직접 접근하지 않음 |
| P205 | runtime artifact capture 구현 | artifact capture ledger | 생성 파일, diff, stdout/stderr, metadata가 output artifact와 연결 |
| P206 | runtime log normalization 구현 | runtime log schema | runtime별 log가 공통 형태로 검색 가능 |
| P207 | runtime timeout/heartbeat 구현 | runtime heartbeat ledger | 장기 실행 상태와 timeout이 run ledger에 남음 |
| P208 | runtime cancel/resume 구현 | runtime control commands | 취소/재개 요청과 결과가 audit에 기록 |
| P209 | protected file gate 구현 | protected file gate | secrets/config/migration/prod 파일 변경이 승인 전 차단 |
| P210 | canonical test runner 구현 | canonical test artifact | agent self-report와 별도로 harness가 test를 재실행 |
| P211 | runtime API/dashboard 구현 | runtime API routes, dashboard panel | adapter, worktree, logs, artifacts, test result 조회 가능 |
| P212 | Runtime freeze | runtime freeze report | Hermes/Codex/local script slice가 adapter/gate/ledger 통과 |

## P213-P230 Personal Dev Domain Pack

| Slot | 목표 | 주요 산출물 | 완료 기준 |
| --- | --- | --- | --- |
| P213 | personal-dev pack manifest 구현 | personal-dev pack manifest | core 수정 없이 pack이 capability 등록 |
| P214 | repo profile detector 구현 | repo profile artifact | language, framework, test/build/lint command가 감지 또는 설정 |
| P215 | agent instruction registry 구현 | AGENTS/CLAUDE/Codex instruction ledger | instruction version과 적용 runtime이 추적 |
| P216 | issue intake adapter 구현 | issue intake artifact | GitHub/Plane/local issue가 동일 task contract로 변환 |
| P217 | Claude/Codex plan request contract 구현 | plan request schema | 두 agent가 동일 context와 제한조건으로 plan 제출 |
| P218 | plan reconciliation 구현 | reconciled plan artifact | 충돌, 공통점, 선택된 scope, unresolved question이 정리 |
| P219 | scope freeze gate 구현 | scope freeze gate result | 구현 전 변경 범위와 protected file rule이 고정 |
| P220 | worktree lane provisioning 구현 | dev lane ledger | agent별 독립 worktree/branch가 생성 |
| P221 | implementation patch capture 구현 | patch artifact | diff, touched files, generated artifacts가 run ledger로 수집 |
| P222 | diff review gate 구현 | diff review result | self-report가 아니라 실제 diff 기준으로 검토 |
| P223 | canonical test matrix 구현 | test matrix artifact | unit/typecheck/lint/e2e 중 repo별 명령이 실행 |
| P224 | protected file/secrets scan 구현 | dev secrets scan result | credential/prod config 변경이 승인 전 차단 |
| P225 | PR draft artifact 구현 | PR draft output | summary, tests, risks, rollback이 output artifact로 저장 |
| P226 | release note generator 구현 | release note artifact | merged change 기준 release note 초안 생성 |
| P227 | rollback plan artifact 구현 | rollback plan | 되돌릴 commit/file/command가 명시 |
| P228 | technical debt ledger 구현 | tech debt ledger | agent가 발견한 미해결 이슈가 task로 보존 |
| P229 | personal-dev dashboard/API 구현 | personal dev API/panel | repo, worktree, plan, diff, test, PR 상태 조회 |
| P230 | Personal Dev E2E freeze | personal dev freeze report | issue->plan->worktree->diff->test->PR draft 전체 통과 |

## P231-P252 Law Firm Domain Pack

| Slot | 목표 | 주요 산출물 | 완료 기준 |
| --- | --- | --- | --- |
| P231 | law-firm pack manifest 구현 | law-firm pack manifest | law capability가 core 수정 없이 등록 |
| P232 | Matter OS profile 구현 | matter cockpit profile | 고객, 상대방, 사건번호, 보안등급, 담당자가 표시 |
| P233 | matter timeline 구현 | matter timeline artifact | 회의, 수신, 제출, 기한이 날짜순으로 연결 |
| P234 | matter document index 구현 | matter document index | 원본, 초안, 제출본, 최신본, 상대방안이 구분 |
| P235 | matter task board 구현 | matter task board | task, 담당자, 기한, status가 workflow와 연결 |
| P236 | matter knowledge graph 구현 | matter knowledge graph | fact, issue, legal theory, evidence가 matter별로 축적 |
| P237 | privilege classifier 구현 | privilege classification result | privileged/work product/confidential flag가 evidence에 반영 |
| P238 | personal data detector 구현 | personal data detection result | 개인정보 포함 자료가 policy/quarantine과 연결 |
| P239 | legal citation verifier 구현 | legal citation verification artifact | 법령/판례/문헌 인용이 source와 최신성 확인을 거침 |
| P240 | LDD VDR inventory 구현 | VDR inventory artifact | 폴더, 파일, 버전, 누락자료가 batch 단위로 집계 |
| P241 | LDD document classification 구현 | LDD document class ledger | 계약/등기/인허가/소송/노동/세무 등 유형 분류 |
| P242 | LDD extractor selection 구현 | extractor selection ledger | 문서 유형별 extractor가 선택되고 근거가 남음 |
| P243 | LDD fact extraction 구현 | LDD fact ledger | parties, dates, obligations, termination, change-of-control 등 추출 |
| P244 | LDD issue detection 구현 | LDD issue ledger | red/yellow flag, follow-up item, severity가 생성 |
| P245 | LDD RFI generator 구현 | RFI draft artifact | 누락자료와 질문이 evidence/issue에 연결 |
| P246 | LDD report draft 구현 | LDD report draft | section별 draft paragraph와 citation placeholder가 생성 |
| P247 | litigation brief draft 구현 | brief draft workflow | 주장, 사실, 증거, 법률근거가 citation gate를 통과 |
| P248 | meeting minutes workflow 구현 | meeting minutes artifact | 녹취/메모에서 안건, 결정, action item, evidence가 생성 |
| P249 | contract draft workflow 구현 | contract draft artifact | clause consistency, client position, attorney review gate 포함 |
| P250 | provided materials full review 구현 | provided-material review ledger | 제공자료 전수검토와 파일 인덱싱 상태가 조회 |
| P251 | attorney approval matrix 구현 | legal approval matrix | 산출물별 attorney/partner approval requirement가 강제 |
| P252 | Law Firm E2E freeze | law firm freeze report | LDD 또는 brief 대표 workflow가 matter/evidence/citation/approval 통과 |

## P253-P266 Creative and Document Domain Pack

| Slot | 목표 | 주요 산출물 | 완료 기준 |
| --- | --- | --- | --- |
| P253 | creative-document pack manifest 구현 | creative-document pack manifest | document/content capability가 core 수정 없이 등록 |
| P254 | template registry 구현 | template registry | DOCX/PPTX/HTML/email template metadata와 version 추적 |
| P255 | style registry 구현 | style registry | 문체, 톤, 브랜드, 폰트, 레이아웃 규칙 등록 |
| P256 | asset registry 구현 | asset registry | 이미지, 로고, 그래프, 표, 영상 asset이 artifact로 관리 |
| P257 | DOCX renderer 구현 | DOCX renderer workflow | template data -> docx output artifact 생성 |
| P258 | PPTX renderer 구현 | PPTX renderer workflow | slide template, overflow check, output artifact 생성 |
| P259 | PDF/HTML renderer 구현 | PDF/HTML renderer workflow | preview/export artifact와 validation 결과 생성 |
| P260 | layout validator 구현 | layout validation result | PPTX/DOCX overflow, page count, broken table 검증 |
| P261 | citation renderer 구현 | citation renderer | footnote, exhibit reference, source span link 렌더 |
| P262 | version comparator 구현 | document comparison artifact | draft version 간 변경사항이 검토 가능 |
| P263 | design system profile 구현 | design system profile | PPTX/보고자료 디자인 규칙이 template/style과 연결 |
| P264 | web novel generator workflow 구현 | web novel workflow | synopsis, chapter, style, revision, output artifact 생성 |
| P265 | video/PPT production workflow 구현 | video/PPT content workflow | script, storyboard, slide deck, approval artifact 생성 |
| P266 | Creative Document freeze | creative document freeze report | document/content 대표 workflow가 render/layout/approval 통과 |

## P267-P276 Connector and Ingestion Layer

| Slot | 목표 | 주요 산출물 | 완료 기준 |
| --- | --- | --- | --- |
| P267 | connector contract v2 구현 | connector interface schema | source id, cursor, external id, auth boundary가 공통화 |
| P268 | local folder connector 구현 | local folder connector | 로컬 폴더 파일 discovery/ingest가 resumable |
| P269 | OneDrive connector boundary 구현 | OneDrive connector plan/adapter | timeout, placeholder, cloud-only 파일 처리가 명시 |
| P270 | Outlook EML/email connector 구현 | Outlook email connector | EML/email metadata, attachments, thread id가 resource화 |
| P271 | KakaoTalk import boundary 구현 | KakaoTalk import adapter | export/import 방식으로 대화/첨부를 resource화 |
| P272 | GitHub connector 구현 | GitHub source adapter | issue, PR, commit, review가 resource/workflow input으로 변환 |
| P273 | VDR connector 구현 | VDR source adapter | VDR inventory와 permission boundary가 resource expansion에 연결 |
| P274 | Plaud transcript connector 구현 | transcript connector | 회의 녹취, speaker, timestamp가 normalized text로 저장 |
| P275 | ERP draft connector 구현 | ERP draft connector | 견적/청구/세금계산서가 draft-only output으로 생성 |
| P276 | Connector freeze | connector freeze report | connector contract fixture와 대표 source ingest가 통과 |

## P277-P286 Resource Expansion and Extractor Library

| Slot | 목표 | 주요 산출물 | 완료 기준 |
| --- | --- | --- | --- |
| P277 | backfill job contract 구현 | backfill job schema | job id, source, cursor, batch, counts, policy snapshot 필드 검증 |
| P278 | cursor/batch state 구현 | expansion cursor ledger | 중단 후 재개가 동일 batch 상태에서 가능 |
| P279 | idempotency/dedup backfill 구현 | expansion dedup ledger | 중복 파일이 skipped_duplicate로 안정 처리 |
| P280 | failure quarantine 구현 | expansion quarantine ledger | 실패/민감/불명확/대용량 파일이 quarantine으로 분류 |
| P281 | classification backfill 구현 | batch classification result | 대량 resource에 classification과 confidence가 붙음 |
| P282 | matter tagging backfill 구현 | batch matter tagging result | 자동 tagging과 human confirmation 대기 상태가 분리 |
| P283 | extractor registry 구현 | extractor registry | 문서 유형별 extractor와 compatibility가 catalog화 |
| P284 | document-type coverage 구현 | extractor coverage report | 파일 유형별 처리율, 실패율, 미지원 유형이 집계 |
| P285 | expansion status dashboard/API 구현 | expansion API/panel | discovered, queued, ingested, failed, quarantined 조회 가능 |
| P286 | Resource Expansion freeze | expansion freeze report | 2,713개급 backfill dry run이 resumable/idempotent로 검증 |

## P287-P296 API, Dashboard, Evidence Viewer, Matter Cockpit

| Slot | 목표 | 주요 산출물 | 완료 기준 |
| --- | --- | --- | --- |
| P287 | API route inventory 정리 | API inventory | core, review, evidence, policy, runtime route가 목록화 |
| P288 | review dashboard information architecture 정리 | dashboard IA doc | dashboard navigation이 stage/actor/matter 기준으로 정리 |
| P289 | approval queue UI 구현 | approval queue panel | pending approval, required actor, target artifact 조회 가능 |
| P290 | evidence viewer UI 구현 | evidence viewer | evidence item, source span, citation, coverage 확인 |
| P291 | source span inspector 구현 | source span inspector | 원문 위치, normalized text, extracted fact를 비교 |
| P292 | run ledger viewer 구현 | run ledger panel | workflow/agent/tool run과 logs/artifacts 조회 |
| P293 | matter cockpit UI 구현 | matter cockpit | profile, timeline, tasks, docs, evidence, approvals 통합 |
| P294 | policy violation queue 구현 | policy violation panel | model/tool/access/output violation이 actor action으로 표시 |
| P295 | cost/observability dashboard 구현 | cost observability panel | token, cost, latency, error, retry trend 표시 |
| P296 | Dashboard/API freeze | dashboard API freeze report | dashboard build, API smoke, route fixture가 통과 |

## P297-P304 Security, Compliance, Performance Hardening

| Slot | 목표 | 주요 산출물 | 완료 기준 |
| --- | --- | --- | --- |
| P297 | threat model refresh | threat model doc | prompt injection, data leak, over-agency, insecure tool 위험이 추적 |
| P298 | prompt injection test suite 구현 | injection test fixtures | 외부 문서 지시문이 instruction으로 승격되지 않음 |
| P299 | external model policy audit 구현 | external model audit report | classification별 provider 전송 여부가 감사 가능 |
| P300 | secrets scan gate 구현 | secrets scan result | credential/token/env leakage가 gate fail로 처리 |
| P301 | retention/deletion policy 구현 | retention policy ledger | artifact/resource/audit 보존기간과 삭제 보류가 기록 |
| P302 | access review report 구현 | access review report | tenant/matter/user별 접근권한 검토가 가능 |
| P303 | performance/cost budget 구현 | performance budget report | batch, workflow, runtime별 시간/비용 상한이 검증 |
| P304 | backup/restore drill 구현 | backup restore report | DB/object/artifact 복구 절차가 dry run으로 검증 |

## P305-P312 End-to-End Acceptance, Deployment, v1.0 Freeze

| Slot | 목표 | 주요 산출물 | 완료 기준 |
| --- | --- | --- | --- |
| P305 | law-firm E2E scenario 실행 | law-firm E2E report | matter->resource->evidence->draft->citation->approval->audit 통과 |
| P306 | personal-dev E2E scenario 실행 | personal-dev E2E report | issue->plan->worktree->diff->test->PR draft->audit 통과 |
| P307 | creative-document E2E scenario 실행 | creative-document E2E report | template->render->layout->approval->output artifact 통과 |
| P308 | connector/resource expansion E2E 실행 | ingestion E2E report | connector->backfill->quarantine->evidence/dashboard 통과 |
| P309 | deployment runbook 작성 | deployment runbook | local/dev/prod-like 실행과 rollback 절차 문서화 |
| P310 | operator handbook 작성 | operator handbook | 사람이 approval, receipt, policy violation, recovery를 처리 가능 |
| P311 | v1.0 release candidate 검증 | release candidate report | validate/test/control-plane/API/dashboard/E2E matrix 통과 |
| P312 | Hermes Harness v1.0 freeze | v1.0 freeze note, tag checklist | 모든 planned slot이 실제 phase로 승격되고 release gate 통과 |
