# Hermes Roadmap P18001-P18400 Check-Mode Guard Normalization

P18001-P18400은 P18000 Trust Delta Ledger 다음 단계다. 목표는 P18000에서 드러난 validation/full-suite trust debt 중 `--check` no-write policy failure를 먼저 닫는 것이다. 이 단계는 새로운 실행 권한을 여는 것이 아니라, 기존 guarded generator들이 `--check`에서 artifact write를 하지 않는다는 검증 자체를 더 신뢰 가능하게 만든다.

P18000 source artifact가 디스크에 없으면 P18400 builder는 P18000 Trust Delta Ledger를 in-memory로 재계산해 conservative source summary를 만든다. 그러나 P18000 source가 blocked인 사실은 그대로 보존하며, P18400은 production PASS, enterprise trust, runtime execution, write/action authority, connector write, reviewer mutation, final approval을 열지 않는다.

| 범위 | 이름 | 목표 | 산출물 |
|---|---|---|---|
| P18001-P18040 | No-Write Failure Source Inventory | 현재 `check-no-write-policy` failure가 실제 write leak인지 scanner blind spot인지 구분한다. | `guard_inventory_rows` |
| P18041-P18080 | Generic Check Branch Scanner | `arg`, `value`, 기타 local parser 변수와 one-line/multi-line branch를 모두 인식한다. | `scanner_capability_rows` |
| P18081-P18120 | Guarded Generator File Ledger | `options.write !== false`와 `--check`를 가진 generator 파일별 branch/write guard 상태를 ledger로 만든다. | `check_mode_guard_file_rows` |
| P18121-P18160 | Offender Finding Rows | check branch 없음, check만 있고 write false 없음, malformed branch를 finding으로 분리한다. | `check_mode_guard_finding_rows` |
| P18161-P18200 | Policy Test Recovery | 기존 no-write policy test가 scanner helper를 사용하도록 바꾸고 negative fixtures를 추가한다. | `policy_test_recovery_rows` |
| P18201-P18240 | Trust Delta Carryover | P18000 trust debt는 지우지 않고, no-write validation debt 개선만 별도 delta로 표시한다. | `trust_delta_carryover_rows` |
| P18241-P18280 | Authority Boundary Recheck | production, enterprise, runtime, write/action, connector write, final approval boundary를 닫아둔다. | `authority_boundary_rows` |
| P18281-P18320 | Validation Evidence Rows | targeted test, adjacent trust checks, package script wiring, diff check를 기록한다. | `validation_evidence_rows` |
| P18321-P18360 | Claude Review Packet Slot | no-write validation scanner 변경은 review evidence 대상임을 표시하되 Claude를 final approver로 처리하지 않는다. | `review_packet_rows` |
| P18361-P18400 | P18400 Handoff Freeze | scanner debt가 0인지, remaining trust debt가 무엇인지, P18401 handoff readiness를 고정한다. | `p18400_freeze_rows` |

완료 기준:

- `check-no-write-policy`가 `arg`, `value`, single-line branch, multi-line branch를 모두 처리한다.
- 실제 guarded generator offender count가 0일 때만 P18401 validation handoff가 열린다.
- P18000에서 남은 broader trust debt는 지워지지 않고 carryover로 표시된다.
- no-write scanner recovery는 execution/write 권한, connector write, production PASS, enterprise trust, final approval을 열지 않는다.
