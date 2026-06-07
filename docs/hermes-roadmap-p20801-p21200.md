# Hermes Roadmap P20801-P21200 Validation Runbook Readiness

P20801-P21200은 P20800 Post-P20400 Launch Envelope가 연 P20801 handoff를 다음 실행자가 사용할 수 있는 validation runbook readiness로 바꾸는 단계다. 목표는 launch envelope의 read-only queue, action eligibility, review cadence, validation launch packet을 실제 실행 권한이 아니라 evidence-backed runbook plan으로 고정하는 것이다.

이 단계는 production PASS, enterprise trust, release approval, deployment, runtime execution, write/protected action, connector write, raw exposure, secret read, reviewer mutation, final automated approval을 열지 않는다. P21200 ready는 다음 control-plane handoff ready일 뿐이며, protected closeout이나 enterprise trust가 아니다.

| 범위 | 이름 | 목표 | 산출물 |
|---|---|---|---|
| P20801-P20840 | P20800 Source Binding | P20800 source artifact, source range, validation state, P20801 handoff flag, commit ref를 고정한다. | `p20800_source_binding_rows` |
| P20841-P20920 | Launch Evidence Queue | P20800 queue/action/review/validation rows를 evidence queue로 분리한다. | `launch_evidence_queue_rows` |
| P20921-P21000 | Command Evidence Plan | syntax, targeted, adjacent, CLI, diff, full-suite 조건을 command evidence plan으로 전환한다. | `command_evidence_plan_rows` |
| P21001-P21080 | Review Escalation Rules | routine read-only에는 review를 요구하지 않고 high-risk 전환에만 Claude review escalation을 붙인다. | `review_escalation_rule_rows` |
| P21081-P21140 | No-Action Boundary Runbook | protected action은 runbook action이 아니라 blocked boundary로 표시한다. | `no_action_boundary_runbook_rows` |
| P21141-P21180 | Runbook Operator Projection | next runner가 보는 run order, evidence ref, blocker, next action을 고정한다. | `runbook_operator_projection_rows` |
| P21181-P21200 | P21200 Clean Checkpoint | source, queue, command plan, escalation, no-action boundary, operator projection, P21201 blocker를 freeze한다. | `p21200_clean_checkpoint_rows` |

완료 기준:

- P20800 source artifact가 없으면 in-memory P20800 builder로 conservative source를 재계산한다.
- P20800 source가 `ready_for_p20801_handoff=false`이면 P21200은 valid BLOCK이고 blocker가 보여야 한다.
- Command evidence plan은 command execution이 아니라 어떤 command evidence가 필요한지를 나타내야 한다.
- Review escalation은 routine read-only projection에는 요구하지 않고 high-risk authority/freeze/release/write/connector/schema 전환에만 required condition을 붙여야 한다.
- Protected action은 runbook action으로 승격되지 않고 `allowed_now=false`와 blocked boundary로 유지되어야 한다.
- P21201 handoff는 source ready, evidence queue visible, command plan visible, review escalation visible, no-action boundary closed, operator projection visible일 때만 열린다.
- P21201 handoff가 true여도 production/enterprise/release/write/runtime/connector/raw/final approval 권한은 모두 false다.
