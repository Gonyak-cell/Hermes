# Hermes Roadmap P11401-P11600 Operator Queue And Trace Detail UI v0

P11401-P11600은 P11400 Design Tokens And Component Foundation 다음 단계다. 목표는 Global Operator Queue와 trace detail UI v0가 실제 화면 구현 전에 따라야 할 read-only 화면 계약을 deterministic artifact로 고정하는 것이다.

이 단계는 production UI freeze가 아니다. Queue, inspector, trace detail, review gate, evidence timeline, conversation detail, domain detail의 화면 구조를 정의하지만 write control, protected action, raw/full body exposure, Codex/Claude final approval, production PASS, enterprise PASS, domain pack product identity는 열지 않는다.

## Phase Plan

| Range | Name | Goal | Output |
|---|---|---|---|
| P11401-P11420 | Global Operator Queue Shell | home surface를 KPI dashboard가 아니라 Global Operator Queue로 고정하고 lanes, saved views, trace spine, inspector region을 정의한다. | `global_operator_queue_shell_rows` |
| P11421-P11440 | Queue Row And Source Card Model | source card와 queue row가 claim, requirement, evidence, gate, review, verdict, next action, blocker reason을 표시하도록 정의한다. | `queue_row_source_card_rows` |
| P11441-P11460 | Object Inspector Panel v0 | selected object identity, source refs, evidence chain, gate state, reviewer authority, blocked reason, next action, forbidden actions를 정의한다. | `object_inspector_panel_rows` |
| P11461-P11480 | Requirement Trace Detail v0 | requirement id, acceptance item, test ref, evidence ref, review ref, gate ref, lineage, stale state를 정의한다. | `requirement_trace_detail_rows` |
| P11481-P11500 | Review Gate Detail v0 | authority boundary, missing evidence, receipt requirement, lower trust, no final approval, protected action blocked, rollback, timeout을 정의한다. | `review_gate_detail_rows` |
| P11501-P11520 | Evidence Timeline v0 | timestamp, actor, source ref, artifact ref, evidence type, review status, linked gate, freshness state를 정의한다. | `evidence_timeline_rows` |
| P11521-P11540 | Conversation Source Detail v0 | redacted summary, citation refs, decisions, blockers, validation events, review events, source refs를 표시하고 raw/full body는 숨긴다. | `conversation_source_detail_ui_rows` |
| P11541-P11560 | Domain Pack Detail v0 | domain context, pack id, capabilities, resource boundary, protected output boundary, cross-domain isolation, human note, product identity disabled를 정의한다. | `domain_pack_detail_rows` |
| P11561-P11580 | Read-only UI/API Smoke Projection | nonblank HTML, GET/HEAD-only projection, POST blocked, no raw/secret, no write, no final approval, no production/enterprise PASS fixture를 정의한다. | `read_only_ui_api_smoke_rows` |
| P11581-P11600 | Operator Queue UI v0 Freeze | P11601-P11800 visual/accessibility regression이 소비할 Operator Queue UI v0 contract를 freeze한다. | `p11600_freeze_rows` |

## UI Contract

- Home surface is Global Operator Queue, not a KPI dashboard or marketing page.
- Queue rows must use the Source -> Claim -> Requirement -> Evidence -> Gate -> Review -> Verdict -> Next Action spine.
- Object Inspector Panel must be a read-only detail surface with stable sections.
- Requirement Trace Detail must expose evidence and review refs, not final truth.
- Review Gate Detail must show authority boundary, missing evidence, allowed next action, rollback, and timeout without approval controls.
- Evidence Timeline must show chronology and freshness without raw payloads.
- Conversation Source Detail must show redacted summary and citations only.
- Domain Pack Detail must keep domain packs as context, not Hermes product identity.
- Read-only UI/API Smoke Projection must block write methods, form/button actions, raw/full body, secret keys, final approval, production PASS, enterprise PASS, and no overlap failures.

## Completion Criteria

```text
P11400 design foundation 없음 = P11600 UI v0 없음
Global Operator Queue shell 없음 = BLOCK
queue row/source card model 없음 = BLOCK
Object Inspector Panel 없음 = BLOCK
Requirement Trace Detail 없음 = BLOCK
Review Gate Detail 없음 = BLOCK
Evidence Timeline 없음 = BLOCK
Conversation Source Detail 없음 = BLOCK
Domain Pack Detail 없음 = BLOCK
read-only UI/API smoke 없음 = BLOCK
raw/full body exposure 없음
secret-bearing key exposure 없음
write/protected action 없음
form/button execution 없음
Codex/Claude final approval 없음
production PASS 없음
enterprise PASS 없음
domain pack product identity 없음
KPI dashboard home 없음
P11601 visual/accessibility regression handoff 가능
P11800 design-system freeze는 아직 false
```
