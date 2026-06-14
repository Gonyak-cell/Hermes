# Hermes Roadmap P10401-P10600 Local Session Capture And Memory Store

P10401-P10600은 P10400 CI/GitHub Evidence Bridge 다음 단계다. 목표는 Codex, Claude, Harness validator, UI handoff 세션을 durable local evidence로 저장할 수 있는 계약을 만들되, raw/full transcript body를 기본 노출하지 않고 redacted summary와 citation ref만 read-only surface로 투영하는 것이다.

## Phase Plan

| Range | Name | Goal | Output |
|---|---|---|---|
| P10401-P10420 | P10400 Source Binding | P10400 CI/GitHub evidence bridge artifact를 source로 묶고 external blockers visibility를 보존한다. | `p10400_source_binding_rows` |
| P10421-P10440 | Session Source Schema | Codex, Claude, Harness validator, UI handoff source id, engine id, session id, run id를 표준화한다. | `session_source_identity_rows` |
| P10441-P10460 | Local Capture Store Envelope | append-only local capture envelope, transcript ref, source citation, provenance 필드를 고정한다. | `local_capture_store_rows` |
| P10461-P10480 | Raw Full Redacted Separation | raw/full/redacted tier를 분리하고 raw/full body의 UI/API 노출을 기본 false로 둔다. | `transcript_tier_boundary_rows` |
| P10481-P10500 | Event Extraction Rows | goal, decision, blocker, validation_event, review_event, phase_progress를 redacted/cited event로 추출한다. | `session_event_extraction_rows` |
| P10501-P10520 | Object Ref And Hash Binding | transcript/review/validation object ref, sha256/provenance/ref freshness 계약을 만든다. | `memory_object_ref_rows` |
| P10521-P10540 | Read-Only API Projection | session sources, transcript refs, events, object refs, drift, boundary를 GET/HEAD-only API로 투영한다. | `session_capture_api_route_rows` |
| P10541-P10560 | Drift And Duplicate Detection | duplicate session, stale context, uncited memory, cross-domain contamination, missing redaction을 BLOCK한다. | `session_drift_detector_rows` |
| P10561-P10580 | Negative Fixtures And Boundary | raw body exposure, API write, source mutation, final approval, production/enterprise PASS를 negative fixture로 막는다. | `session_capture_negative_fixture_rows` |
| P10581-P10600 | P10600 Freeze | source, capture, redaction, extraction, object refs, API, drift, boundary를 freeze하고 P10601 handoff를 연다. | `p10600_freeze_rows`, `session_capture_gate_rows` |

## Capture Semantics

P10600은 local source capture 계약이지, raw transcript viewer나 autonomous memory truth layer가 아니다.

- `session_capture_memory_store_ready`: 세션 source를 append-only evidence로 보존할 계약이 준비됨
- `redacted_event_projection_ready`: redacted summary와 citation ref를 UI/API로 투영할 준비가 됨
- `raw_transcript_body_visible`: 항상 false
- `full_transcript_body_visible`: 항상 false
- `runtime_recall_enabled`: 이 tranche에서는 false
- `production_pass_enabled`, `enterprise_pass_enabled`: 이 tranche에서는 false

## Fail-Closed Rules

다음 조건은 P10600 closeout을 BLOCK한다.

- P10400 source artifact가 ready가 아님
- transcript ref, engine id, session id, run id가 누락됨
- raw/full transcript body가 UI/API에 노출됨
- redacted event에 source citation이 없음
- duplicate session event를 별도 detector 없이 통과시킴
- stale context 또는 uncited memory를 current truth로 취급함
- Codex 또는 Claude conversation을 final approval로 취급함
- API가 POST/PUT/PATCH/DELETE를 허용하거나 source를 mutate함

## Completion Criteria

```text
P10400 source 없음 = P10600 capture 없음
transcript ref 없음 = session source 없음
raw/full body UI/API 노출 없음
redacted summary + citation ref만 표시
duplicate/stale/uncited/cross-domain drift는 BLOCK
Codex/Claude final approval 없음
runtime recall 없음
write/API mutation 없음
production PASS 없음
enterprise PASS 없음
```
