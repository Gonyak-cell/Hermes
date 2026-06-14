# Hermes Roadmap P21201-P21600 Validation Evidence Receipt Intake

P21201-P21600은 P21200 Validation Runbook Readiness가 연 P21201 handoff를 검증 결과 receipt intake 구조로 바꾸는 단계다. 목표는 command evidence plan을 실제 명령 실행으로 오해하지 않고, syntax, targeted, adjacent, CLI, diff, conditional full-suite, conditional Claude review evidence가 어떤 receipt shape로 들어와야 하는지, raw stdout/secret 없이 어떻게 보관되는지, stale/source-mismatch/missing 상태가 어떻게 BLOCK으로 보이는지 고정하는 것이다.

이 단계는 production PASS, enterprise trust, release approval, deployment, runtime execution, write/protected action, connector write, raw exposure, secret read, reviewer mutation, final automated approval을 열지 않는다. P21600 ready는 다음 control-plane handoff ready일 뿐이며, protected closeout이나 enterprise trust가 아니다.

| 범위 | 이름 | 목표 | 산출물 |
|---|---|---|---|
| P21201-P21240 | P21200 Source Binding | P21200 source artifact, source range, validation state, P21201 handoff flag, commit ref를 고정한다. | `p21200_source_binding_rows` |
| P21241-P21320 | Validation Evidence Receipt Schema | syntax, targeted, adjacent, CLI, diff, full-suite, Claude review receipt shape와 required/conditional 상태를 정의한다. | `validation_evidence_receipt_schema_rows` |
| P21321-P21400 | Redacted Result Capture Contract | raw stdout/stderr/secret material은 금지하고 hash, redacted summary, evidence_ref만 허용한다. | `redacted_result_capture_rows` |
| P21401-P21480 | Freshness Completeness Guard | stale, missing, duplicate, source mismatch, command mismatch 상태를 BLOCK rule로 고정한다. | `freshness_completeness_guard_rows` |
| P21481-P21540 | Operator Evidence Inbox | 어떤 receipt가 왔고 무엇이 누락됐는지 operator가 볼 수 있는 inbox row를 만든다. | `operator_evidence_inbox_rows` |
| P21541-P21580 | No-Execution Raw Boundary | receipt intake가 command execution, raw capture, secret read, protected action으로 승격되지 않도록 boundary를 닫는다. | `no_execution_raw_boundary_rows` |
| P21581-P21600 | P21600 Clean Checkpoint | source, receipt schema, redaction, freshness guard, inbox, no-execution boundary, P21601 blocker를 freeze한다. | `p21600_clean_checkpoint_rows` |

완료 기준:

- P21200 source artifact가 없으면 in-memory P21200 builder로 conservative source를 재계산한다.
- P21200 source가 `ready_for_p21201_handoff=false`이면 P21600은 valid BLOCK이고 blocker가 보여야 한다.
- Receipt schema는 actual receipt가 없다는 사실을 숨기지 않고 `missing_receipt_visible` 상태로 operator inbox에 남겨야 한다.
- Redacted capture contract는 raw stdout/stderr, secret material, full transcript, unrestricted log capture를 모두 금지해야 한다.
- Freshness/completeness guard는 stale, duplicate, source mismatch, missing receipt를 pass로 요약하지 않고 guard rule로 보여야 한다.
- P21601 handoff는 source ready, receipt intake contract visible, redaction contract visible, freshness guard visible, operator inbox visible, no-execution/raw boundary closed일 때만 열린다.
- P21601 handoff가 true여도 production/enterprise/release/write/runtime/connector/raw/final approval 권한은 모두 false다.
