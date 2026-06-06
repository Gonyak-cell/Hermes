# Hermes Roadmap P11201-P11400 Design Tokens And Component Foundation

P11201-P11400은 P11200 Global UI Contract 다음 단계다. 목표는 P11401 이후 실제 Global Operator Queue와 trace detail UI가 사용할 design token, primitive, component state, smoke fixture foundation을 deterministic artifact로 고정하는 것이다.

이 단계는 제품 화면 구현이 아니다. Token과 primitive를 정의하지만 write control, protected action, Codex/Claude final approval, production PASS, enterprise PASS, domain pack product identity는 열지 않는다.

## Phase Plan

| Range | Name | Goal | Output |
|---|---|---|---|
| P11201-P11220 | Design Token Registry | neutral base, restrained blue, semantic amber/red/green, typography, spacing, radius, shadow, motion token을 정의한다. | `design_token_rows` |
| P11221-P11240 | Table/List Primitive | Operator Queue와 drilldown list의 column, sort, density, overflow, row selection behavior를 정의한다. | `table_list_primitive_rows` |
| P11241-P11260 | Detail/Inspector Primitive | object summary, source refs, requirement trace, evidence chain, gate state, reviewer authority, blocked reason, next action section을 정의한다. | `detail_inspector_primitive_rows` |
| P11261-P11280 | Timeline Primitive | typed evidence timeline의 timestamp, actor, source, event type, artifact ref, review status, linked gate를 정의한다. | `timeline_primitive_rows` |
| P11281-P11300 | Boundary Notice And Receipt Rows | blocked reason, missing evidence, receipt required, allowed next action, forbidden action, rollback target, timeout, lower-trust notice를 정의한다. | `boundary_notice_receipt_rows` |
| P11301-P11320 | Readiness Rule Matrix Primitive | scorecard가 아니라 rule matrix로 PASS/BLOCK/degraded/missing evidence/review pending/lower trust를 표시한다. | `readiness_rule_matrix_rows` |
| P11321-P11340 | Review Evidence Trace Primitive | AI Review Surface가 아니라 reviewer evidence trace로 reviewer engine, receipt ref, finding, revalidation, authority boundary를 표시한다. | `review_evidence_trace_rows` |
| P11341-P11360 | Component State Matrix | default, hover, focus, selected, disabled, loading, stale, blocked, missing evidence, review pending state를 정의한다. | `component_state_matrix_rows` |
| P11361-P11380 | UI Smoke Fixture Plan | nonblank shell, no raw/secret, no write, no final approval, no production/enterprise PASS, no overlap, text fit, stable dimensions fixture를 정의한다. | `ui_smoke_fixture_plan_rows` |
| P11381-P11400 | Token/Component Foundation Freeze | P11401-P11600 Operator Queue UI v0가 소비할 token/component foundation을 freeze한다. | `p11400_freeze_rows` |

## Token Contract

- `color.neutral`: background, surface, border, text, muted text
- `color.accent`: restrained blue only for selected/focus/link state
- `color.semantic`: amber, red, green only for status semantics
- `typography`: fixed scale, no viewport-width font scaling, no negative letter spacing
- `spacing`: dense but readable table/detail rhythm
- `radius`: 4px to 8px
- `shadow`: low elevation only
- `motion`: minimal, non-authority state transition

## Primitive Contract

- Table/list primitives must support stable columns, sorting, density, overflow handling, selected row, keyboard focus, no layout shift, scan-friendly rows, status cells, and saved view binding.
- Detail/inspector primitives must keep trace spine, source refs, evidence chain, gate state, reviewer authority, blocked reason, next action, and forbidden actions in stable sections.
- Timeline primitives must show typed evidence chronology with timestamp, actor, source, event type, artifact ref, review status, and linked gate.
- Boundary notice and receipt rows must never become action execution buttons.
- Readiness Rule Matrix is a rule/status display, not a KPI scorecard.
- Review Evidence Trace is reviewer evidence, not final approval. It must include reviewer engine, receipt ref, finding, revalidation, authority boundary, model and effort, and raw reference only.
- Readiness Rule Matrix must require evidence required for every PASS/BLOCK/degraded/missing evidence/review pending/lower trust state.
- UI smoke fixtures must include no hero/dashboard home and read-only state checks before any product screen implementation.

## Completion Criteria

```text
P11200 source contract 없음 = P11400 foundation 없음
design token registry 없음 = BLOCK
table/list primitive 없음 = BLOCK
detail/inspector primitive 없음 = BLOCK
timeline primitive 없음 = BLOCK
boundary notice/receipt rows 없음 = BLOCK
Readiness Rule Matrix 없음 = BLOCK
Review Evidence Trace 없음 = BLOCK
component state matrix 없음 = BLOCK
UI smoke fixture plan 없음 = BLOCK
raw/full body exposure 없음
secret-bearing key exposure 없음
write/protected action 없음
Codex/Claude final approval 없음
production PASS 없음
enterprise PASS 없음
P11401 UI v0 handoff 가능
P11800 design-system freeze는 아직 false
```
