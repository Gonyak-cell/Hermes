# Hermes Roadmap P12601-P12800 Human/Owner Adjudication Option

P12601-P12800은 P12600 Patch Candidate Lane 다음 단계다. 목표는 Hermes가 protected closeout 후보에 대해 owner adjudication receipt를 선택적으로 받을 수 있는 control-plane 계약을 만드는 것이다.

이 단계는 owner receipt를 실제 최종 승인으로 적용하지 않는다. Owner adjudication은 protected closeout input일 뿐이며 independent GitHub review, enterprise-independent review, production PASS, enterprise PASS, Codex final approval, Claude final approval을 대체하지 않는다.

P12600 source가 `ready_for_p12601_handoff=false`이면 P12800은 ready가 아니라 explicit BLOCK으로 남아야 한다. 또한 owner adjudication receipt가 없으면 protected closeout option은 visible blocker로 남고 P12801 Release Readiness Control Plane handoff는 열리지 않는다.

## Phase Plan

| Range | Name | Goal | Output |
|---|---|---|---|
| P12601-P12620 | P12600 Source Binding | Patch Candidate Lane source, blocked source handoff, no-patch/no-write boundary를 고정한다. | `adjudication_source_binding_rows` |
| P12621-P12640 | Owner Adjudication Receipt Schema | receipt schema, adjudicator id, adjudicator role, scope ref, decision set, evidence refs, raw payload redaction을 정의한다. | `owner_adjudication_receipt_rows` |
| P12641-P12660 | Protected Closeout Mapping | protected output class, owner receipt requirement, review evidence ref, validation evidence ref, rollback evidence ref, closeout remains blocked를 정의한다. | `protected_closeout_mapping_rows` |
| P12661-P12680 | Independent Review Separation | independent GitHub review, Claude review evidence, owner adjudication evidence, enterprise trust separation, review authority boundary, no reviewer replacement를 고정한다. | `independent_review_separation_rows` |
| P12681-P12700 | Single-Owner Trust Downgrade | single-owner mode, lower trust classification, not enterprise independent review, merge readiness only, explicit exception receipt를 정의한다. | `single_owner_trust_downgrade_rows` |
| P12701-P12720 | Adjudication Queue | queue item id, scope owner, required evidence, missing receipt, blocked reason, next condition을 정의한다. | `adjudication_queue_rows` |
| P12721-P12740 | Finding Disposition | finding id, disposition enum, owner decision ref, follow-up required, unresolved finding remains blocked, redacted rationale summary를 정의한다. | `finding_disposition_rows` |
| P12741-P12760 | Read-Only Operator/API Projection | adjudication state, source state, receipt state, independent review state, single-owner trust state, next condition을 GET/HEAD-only projection으로 정의한다. | `adjudication_operator_projection_rows` |
| P12761-P12780 | Authority Guard | owner receipt not enterprise review, owner receipt not GitHub approval, Codex not final approver, Claude not final approver, no production PASS, no enterprise PASS를 고정한다. | `adjudication_authority_guard_rows` |
| P12781-P12800 | Human/Owner Adjudication Freeze | source, receipt, protected mapping, review separation, single-owner downgrade, queue, disposition, projection, authority guard를 freeze한다. | `p12800_freeze_rows` |

## Adjudication Contract

- Owner adjudication receipt rows include receipt schema, adjudicator id, adjudicator role, scope ref, decision set, evidence refs, raw payload redaction.
- Protected closeout mapping rows include protected output class, owner receipt requirement, review evidence ref, validation evidence ref, rollback evidence ref, closeout remains blocked.
- Independent review separation rows include independent GitHub review, Claude review evidence, owner adjudication evidence, enterprise trust separation, review authority boundary, no reviewer replacement.
- Single-owner trust downgrade rows include single-owner mode, lower trust classification, not enterprise independent review, merge readiness only, explicit exception receipt.
- Adjudication queue rows include queue item id, scope owner, required evidence, missing receipt, blocked reason, next condition.
- Finding disposition rows include finding id, disposition enum, owner decision ref, follow-up required, unresolved finding remains blocked, redacted rationale summary.
- Operator/API projection includes adjudication state, source state, receipt state, independent review state, single-owner trust state, next condition.
- Authority guards include owner receipt not enterprise review, owner receipt not GitHub approval, Codex not final approver, Claude not final approver, no production PASS, no enterprise PASS.

## Completion Criteria

```text
P12600 source 없음 = BLOCK
P12600 ready_for_p12601_handoff=false = P12800 ready 아님
owner adjudication receipt 없음 = P12800 ready 아님
owner receipt가 있어도 independent GitHub review 아님
owner receipt가 있어도 enterprise-independent review 아님
single-owner mode는 lower trust / merge readiness only
protected closeout remains blocked until required receipts and independent gates exist
patch generation 없음
patch apply 없음
direct apply 없음
file write 없음
protected action 없음
connector write 없음
runtime execution 없음
Codex/Claude final approval 없음
owner receipt auto final approval 없음
production PASS 없음
enterprise PASS 없음
P12801 Release Readiness Control Plane handoff는 P12600 source와 owner adjudication evidence가 모두 ready일 때만 가능
```
