# Hermes Roadmap P20401-P20800 Post-P20400 Launch Envelope

P20401-P20800은 P20400 Post-P20000 Operator Handoff가 연 P20401 handoff를 다음 실행자가 안전하게 시작할 수 있는 launch envelope로 바꾸는 단계다. 목표는 handoff packet을 읽고, 어떤 queue item이 read-only로 소비 가능한지, 어떤 action이 조건부 검증인지, 어떤 protected action이 계속 금지인지, Claude review와 full test가 언제 필요한지 명확히 고정하는 것이다.

이 단계는 production PASS, enterprise trust, release approval, deployment, runtime execution, write/protected action, connector write, raw exposure, secret read, reviewer mutation, final automated approval을 열지 않는다. P20800 ready는 다음 control-plane handoff ready일 뿐이며, protected closeout이나 enterprise trust가 아니다.

| 범위 | 이름 | 목표 | 산출물 |
|---|---|---|---|
| P20401-P20440 | P20400 Source Binding | P20400 source artifact, source range, validation state, P20401 handoff flag, commit ref를 고정한다. | `p20400_source_binding_rows` |
| P20441-P20520 | Handoff Consumption Queue | P20400 operator handoff packet을 read-only launch queue로 변환한다. | `handoff_consumption_queue_rows` |
| P20521-P20600 | Action Eligibility Matrix | read-only inspection, targeted validation, adjacent validation은 허용하고 protected action은 금지한다. | `action_eligibility_matrix_rows` |
| P20601-P20680 | Review Cadence Router | routine projection에는 Claude review를 요구하지 않고 high-risk 전환에만 review requirement를 연결한다. | `review_cadence_router_rows` |
| P20681-P20740 | Validation Launch Packet | 다음 tranche가 사용할 syntax, targeted, adjacent, CLI, diff, full-suite 조건을 launch packet으로 만든다. | `validation_launch_packet_rows` |
| P20741-P20780 | Boundary Guard Projection | production, enterprise, release, write, runtime, connector, raw, final approval boundary false를 보존한다. | `boundary_guard_projection_rows` |
| P20781-P20800 | P20800 Launch Checkpoint | source, queue, eligibility, review router, validation packet, boundary guard, P20801 handoff blocker를 freeze한다. | `p20800_launch_checkpoint_rows` |

완료 기준:

- P20400 source artifact가 없으면 in-memory P20400 builder로 conservative source를 재계산한다.
- P20400 source가 `ready_for_p20401_handoff=false`이면 P20800은 valid BLOCK이고 blocker가 보여야 한다.
- Action eligibility matrix는 read-only/validation action과 protected action을 같은 PASS로 섞지 않고 `allowed_now`로 분리해야 한다.
- Review cadence router는 routine read-only projection에는 Claude review를 요구하지 않고, high-risk authority/freeze/release/write/connector/schema 전환에만 required condition을 붙여야 한다.
- Full `npm test`는 항상 요구하지 않고, broad trust/release/write/schema freeze 전환일 때만 required condition으로 표시한다.
- P20801 handoff는 source ready, queue visible, eligibility visible, review cadence visible, validation packet visible, boundary guard closed일 때만 열린다.
- P20801 handoff가 true여도 production/enterprise/release/write/runtime/connector/raw/final approval 권한은 모두 false다.
