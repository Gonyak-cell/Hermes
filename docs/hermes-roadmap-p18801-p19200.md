# Hermes Roadmap P18801-P19200 Trust Debt Recalibration

P18801-P19200은 P18800 Check-Mode Scanner Robustness 다음 단계다. 목표는 P18000에서 남은 broader trust debt 중 P18400/P18800이 실제로 닫은 no-write scanner debt와 아직 operator가 봐야 하는 trust/review/validation debt를 분리해서 재계산하는 것이다.

이 단계는 trust score, production PASS, enterprise trust, deployment, runtime execution, write/protected action, connector write, raw exposure, reviewer mutation, final automated approval을 열지 않는다. Claude Code Opus max review와 full-suite evidence는 handoff 입력으로 다루되, receipt가 없으면 P19201 handoff만 닫고 P19200 계약 자체는 valid BLOCK으로 남긴다.

| 범위 | 이름 | 목표 | 산출물 |
|---|---|---|---|
| P18801-P18840 | P18800 Source Binding | P18800 source availability, source range, scanner robustness status, P18801 handoff state, source chain을 고정한다. | `p18800_source_binding_rows` |
| P18841-P18900 | Closed Debt Credit Ledger | no-write policy debt, scanner finding debt, parser/tokenizer debt, schema readiness debt, source blocker debt가 닫혔는지 credit으로 정규화한다. | `closed_debt_credit_rows` |
| P18901-P18960 | Remaining Trust Debt Ledger | production/enterprise trust, independent review, durable validation, external verification, release/write authority debt를 carried-forward 상태로 유지한다. | `remaining_trust_debt_rows` |
| P18961-P19020 | Validation Freshness Recheck | targeted validation, adjacent regression, full npm test, diff check, stale evidence blocker를 분리한다. | `validation_freshness_recheck_rows` |
| P19021-P19080 | Claude Review Evidence Recheck | Claude review receipt, blocking finding count, nonblocking finding loop, reviewer non-finality, missing receipt blocker를 표시한다. | `review_evidence_recheck_rows` |
| P19081-P19140 | Authority Boundary Recheck | deployment, release, production, enterprise, runtime, write, connector, raw, secret, reviewer mutation, final approval boundary를 닫아둔다. | `authority_boundary_recheck_rows` |
| P19141-P19180 | Operator Next Action Projection | next evidence action, missing receipt action, review action, validation action, no mutation projection을 만든다. | `operator_next_action_rows` |
| P19181-P19200 | P19200 Handoff Freeze | source, closed debt, remaining debt, validation, review, authority, P19201 handoff blocker를 freeze한다. | `p19200_freeze_rows` |

완료 기준:

- P18800 source가 없으면 in-memory P18800 builder로 conservative source를 재계산한다.
- P18800 ready_for_p18801_handoff=false이면 P19200은 valid BLOCK으로 남는다.
- P18400/P18800이 닫은 no-write scanner debt는 closed debt credit으로 분리된다.
- production/enterprise/release/write/execution/connector/raw/final approval debt는 닫힌 것으로 오인하지 않고 carried-forward로 남긴다.
- Claude review receipt나 full-suite receipt가 없으면 P19201 handoff는 열리지 않는다.
- receipt 부재는 validation failure가 아니라 visible blocker다.
- Codex와 Claude는 최종 승인자가 아니다.
- P19201 handoff는 source ready, closed debt credit pass, review evidence pass, validation evidence pass, authority closed일 때만 열린다.
