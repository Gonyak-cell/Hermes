# Hermes Roadmap P20001-P20400 Post-P20000 Operator Handoff

P20001-P20400은 P20000 Trust Evidence Clean Checkpoint가 연 P20001 handoff를 다음 운영자가 실제로 소비할 수 있는 handoff packet으로 바꾸는 단계다. 목표는 P20000의 trust evidence chain과 verification-of-verification matrix를 다시 요약하지 않고, source binding, consumption map, blocker, next action, boundary debt, regression command를 행 단위로 투영하는 것이다.

이 단계는 production PASS, enterprise trust, release approval, deployment, runtime execution, write/protected action, connector write, raw exposure, secret read, reviewer mutation, final automated approval을 열지 않는다. P20400 ready는 다음 control-plane handoff ready일 뿐이며, protected closeout이나 enterprise trust가 아니다.

| 범위 | 이름 | 목표 | 산출물 |
|---|---|---|---|
| P20001-P20040 | P20000 Source Binding | P20000 source artifact, source range, validation state, P20001 handoff flag, commit ref를 고정한다. | `p20000_source_binding_rows` |
| P20041-P20120 | Trust Consumption Map | P16800-P20000 trust chain을 다음 tranche가 소비할 수 있는 map row로 변환한다. | `trust_consumption_map_rows` |
| P20121-P20200 | Operator Handoff Packet | source, evidence, blocker, next action, owner lane, review lane, read-only surface를 operator handoff packet으로 만든다. | `operator_handoff_packet_rows` |
| P20201-P20280 | Boundary Debt Projection | production, enterprise, release, write, runtime, connector, raw, final approval debt를 계속 carried-forward로 유지한다. | `boundary_debt_projection_rows` |
| P20281-P20340 | Verification Consumption Guard | P20000 matrix가 검증한 것과 검증하지 않은 것을 handoff 소비 단계에서도 보존한다. | `verification_consumption_guard_rows` |
| P20341-P20380 | Regression Adjacent Command Packet | 다음 tranche가 사용할 targeted, adjacent, full-suite 조건과 Claude review cadence를 evidence화한다. | `regression_adjacent_command_packet_rows` |
| P20381-P20400 | P20400 Clean Checkpoint | source, consumption, handoff, boundary debt, verification guard, command packet, P20401 handoff blocker를 freeze한다. | `p20400_clean_checkpoint_rows` |

완료 기준:

- P20000 source artifact가 없으면 in-memory P20000 builder로 conservative source를 재계산한다.
- P20000 source가 `ready_for_p20001_handoff=false`이면 P20400은 valid BLOCK이고 blocker가 보여야 한다.
- Trust consumption map은 P16800-P20000 chain을 다음 tranche가 읽을 수 있는 stable row로 고정해야 한다.
- Verification consumption guard는 검증이 보장하지 않는 범위를 손실하지 않아야 한다.
- Claude review는 routine read-only projection에는 요구하지 않고, 다음 tranche가 authority/freeze/release/write/connector/schema 전환이면 required condition으로 표시한다.
- Full `npm test`는 항상 요구하지 않고, broad trust/release/write/schema freeze 전환일 때만 required condition으로 표시한다.
- P20401 handoff는 source ready, consumption map visible, operator handoff visible, boundary debt visible, verification guard visible, authority closed, regression packet visible일 때만 열린다.
- P20401 handoff가 true여도 production/enterprise/release/write/runtime/connector/raw/final approval 권한은 모두 false다.
