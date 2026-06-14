# Hermes Roadmap P19601-P20000 Trust Evidence Clean Checkpoint

P19601-P20000은 P19600 Post-Handoff Trust Intake가 연 P19601 handoff를 소비해 P16800 이후 trust evidence chain을 operator가 읽을 수 있는 clean checkpoint로 묶는 단계다. 목표는 "검증을 통과했다"는 한 줄 요약이 아니라, source chain, receipt, freshness, command packet, blocker, authority boundary를 다시 분리해서 검증의 검증 matrix로 고정하는 것이다.

이 단계는 production PASS, enterprise trust, release approval, deployment, runtime execution, write/protected action, connector write, raw exposure, secret read, reviewer mutation, final automated approval을 열지 않는다. P20000 ready는 다음 control-plane handoff ready일 뿐이며, protected closeout이나 enterprise trust가 아니다.

| 범위 | 이름 | 목표 | 산출물 |
|---|---|---|---|
| P19601-P19640 | P19600 Source Binding | P19600 source artifact, source range, validation state, P19601 handoff flag, commit ref를 고정한다. | `p19600_source_binding_rows` |
| P19641-P19700 | Trust Evidence Chain Index | P16800 이후 P17200, P17600, P18000, P18400, P18800, P19200, P19600 chain을 visible index로 연결한다. | `trust_evidence_chain_index_rows` |
| P19701-P19760 | Verification-Of-Verification Matrix | 각 validator가 검증한 것과 검증하지 않은 것을 분리하고 stale/receipt/blocker 상태를 표시한다. | `verification_of_verification_rows` |
| P19761-P19820 | Operator Trust Projection | 운영자가 보는 verified/not-enterprise/blocked/next-action row를 만든다. | `operator_trust_checkpoint_rows` |
| P19821-P19900 | Remaining Authority Debt | production, enterprise, release, write, runtime, connector, raw, final approval debt를 계속 carried-forward로 유지한다. | `remaining_authority_debt_rows` |
| P19901-P19960 | Regression Command Packet | 다음 tranche가 사용할 targeted, adjacent, full-suite 조건과 diff checks를 evidence화한다. | `regression_command_packet_rows` |
| P19961-P20000 | P20000 Clean Checkpoint | source, chain, matrix, operator projection, authority debt, command packet, P20001 handoff blocker를 freeze한다. | `p20000_clean_checkpoint_rows` |

완료 기준:

- P19600 source artifact가 없으면 in-memory P19600 builder로 conservative source를 재계산한다.
- P19600 source가 `ready_for_p19601_handoff=false`이면 P20000은 valid BLOCK이고 blocker가 보여야 한다.
- Verification-of-verification matrix는 검증이 보장하는 범위와 보장하지 않는 범위를 분리해야 한다.
- Full `npm test`는 항상 요구하지 않고, trust/release/write/schema freeze 전환일 때만 required condition으로 표시한다.
- P20001 handoff는 source ready, chain visible, verification matrix pass, operator projection pass, authority closed, regression packet visible일 때만 열린다.
- P20001 handoff가 true여도 production/enterprise/release/write/runtime/connector/raw/final approval 권한은 모두 false다.
