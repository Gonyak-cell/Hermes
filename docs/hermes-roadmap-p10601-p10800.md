# Hermes Roadmap P10601-P10800 Context Recall And Drift Guard

P10601-P10800은 P10600 Local Session Capture And Memory Store 다음 단계다. 목표는 다음 세션에 복원할 context recall bundle을 만들 수 있도록 하되, 모든 recall 후보가 source citation, freshness, conflict, uncited-memory, cross-domain boundary를 통과했는지 fail-closed로 표시하는 것이다.

## Phase Plan

| Range | Name | Goal | Output |
|---|---|---|---|
| P10601-P10620 | P10600 Source Binding | P10600 local session capture artifact를 source로 묶고 raw/full transcript 비노출 경계를 보존한다. | `p10600_source_binding_rows` |
| P10621-P10640 | Next-Session Recall Candidate Rows | goal, decision, blocker, validation, review, phase-progress recall 후보를 만든다. | `next_session_recall_candidate_rows` |
| P10641-P10660 | Citation Enforcement Rows | 모든 recall 후보가 transcript/event/object citation ref를 요구하도록 한다. | `recall_citation_enforcement_rows` |
| P10661-P10680 | Freshness And Staleness Policy | current, recent, stale, expired, unknown freshness 상태와 required action을 분리한다. | `recall_freshness_policy_rows` |
| P10681-P10700 | Conflict Detection Rows | goal, phase, blocker, review finding 충돌을 visible conflict로 표시하고 auto-resolve를 막는다. | `recall_conflict_detection_rows` |
| P10701-P10720 | Uncited Memory Blocker Rows | uncited memory, uncited plan, uncited decision, uncited validation을 BLOCK한다. | `uncited_memory_blocker_rows` |
| P10721-P10740 | Cross-Domain Boundary Rows | project, domain, tenant, legal/HR/client, connector/resource boundary crossing을 BLOCK한다. | `cross_domain_boundary_rows` |
| P10741-P10760 | Read-Only Recall API Projection | recall candidates, citations, freshness, conflicts, blockers, boundaries를 GET/HEAD-only API/UI로 투영한다. | `context_recall_api_route_rows` |
| P10761-P10780 | Negative Fixtures And Boundary | raw transcript recall, hidden conflict, auto mutation, final approval, production/enterprise PASS를 negative fixture로 막는다. | `context_recall_negative_fixture_rows` |
| P10781-P10800 | Required Review And Freeze | Claude Opus review receipt를 요구하고 P10800 freeze와 P10801 handoff를 고정한다. | `p10800_freeze_rows`, `context_recall_gate_rows` |

## Guard Semantics

P10800은 runtime recall engine이 아니다. 다음 세션 context 후보를 안전하게 보여주는 guard layer다.

- `context_recall_guard_ready`: cited recall guard 계약이 준비됨
- `next_session_recall_bundle_ready`: redacted, cited, stale/conflict 표시가 있는 bundle 후보가 준비됨
- `uncited_recall_allowed`: 항상 false
- `stale_fact_as_current_allowed`: 항상 false
- `cross_domain_recall_allowed`: 항상 false
- `auto_context_mutation_enabled`: 항상 false
- `runtime_recall_enabled`: 이 tranche에서는 false
- `production_pass_enabled`, `enterprise_pass_enabled`: 이 tranche에서는 false

## Fail-Closed Rules

다음 조건은 P10800 closeout을 BLOCK한다.

- P10600 source artifact가 ready가 아님
- Claude Opus review receipt가 없거나 blocking finding이 있음
- recall candidate에 citation ref가 없음
- stale/expired/unknown freshness가 current truth로 표시됨
- conflict가 hidden 또는 auto-resolved 됨
- uncited memory가 plan/phase/decision/current state로 승격됨
- project/domain/tenant/client/HR/legal/resource boundary를 넘음
- raw/full transcript body가 UI/API/recall bundle에 노출됨
- API가 POST/PUT/PATCH/DELETE를 허용하거나 context를 mutate함

## Completion Criteria

```text
P10600 source 없음 = P10800 recall 없음
Claude review receipt 없음 = P10800 freeze 없음
citation 없음 = recall 없음
stale fact = current truth 아님
conflict hidden 없음
uncited memory 없음
cross-domain recall 없음
raw/full transcript body recall 없음
auto context mutation 없음
Codex/Claude final approval 없음
production PASS 없음
enterprise PASS 없음
```
