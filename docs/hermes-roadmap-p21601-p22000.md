# Hermes Roadmap P21601-P22000 Validation Receipt Candidate Queue

P21601-P22000은 P21600 Validation Evidence Receipt Intake가 연 P21601 handoff를 validation receipt candidate queue와 verifier-facing digest index로 바꾸는 단계다. 목표는 receipt 후보 슬롯, redacted digest metadata, acceptance decision matrix, operator verification index를 만들되, 실제 receipt 수령/수락/finality/protected approval로 승격하지 않는 것이다.

이 단계는 production PASS, enterprise trust, release approval, deployment, runtime execution, write/protected action, connector write, raw exposure, secret read, reviewer mutation, final automated approval을 열지 않는다. P22000 ready는 다음 receipt completion/reconciliation handoff ready일 뿐이며, 검증 완료나 enterprise 신뢰가 아니다.

| 범위 | 이름 | 목표 | 산출물 |
|---|---|---|---|
| P21601-P21640 | P21600 Source Binding | P21600 source artifact, source range, validation state, P21601 handoff flag, no-execution/raw boundary를 고정한다. | `p21600_source_binding_rows` |
| P21641-P21720 | Receipt Candidate Metadata Queue | syntax, targeted, adjacent, CLI, diff, full-suite, Claude review receipt 후보 슬롯과 missing candidate 상태를 정의한다. | `receipt_candidate_metadata_rows` |
| P21721-P21800 | Result Digest Redaction Index | hash, redacted summary ref, command id, source commit ref, freshness window를 raw output 없이 분리한다. | `result_digest_redaction_index_rows` |
| P21801-P21880 | Acceptance Decision Matrix | candidate present, payload accepted, rejected, missing 상태를 수락/finality와 분리한다. | `acceptance_decision_matrix_rows` |
| P21881-P21940 | Operator Verification Index | operator가 어떤 receipt candidate가 없고 어떤 next action이 필요한지 read-only index로 본다. | `operator_verification_index_rows` |
| P21941-P21980 | No-Finality Boundary | candidate queue가 final review authority, human gate, merge/release/deploy 권한으로 승격되지 않도록 boundary를 닫는다. | `no_finality_boundary_rows` |
| P21981-P22000 | P22000 Clean Checkpoint | source, candidate queue, digest index, acceptance matrix, operator index, no-finality boundary, P22001 blocker를 freeze한다. | `p22000_clean_checkpoint_rows` |

완료 기준:

- P21600 source artifact가 없으면 in-memory P21600 builder로 conservative source를 재계산한다.
- P21600 source가 `ready_for_p21601_handoff=false`이면 P22000은 valid BLOCK이고 blocker가 보여야 한다.
- Receipt candidate slot은 실제 receipt가 없다는 사실을 `candidate_missing_visible`로 유지해야 한다.
- Result digest index는 raw stdout/stderr, secret material, full transcript를 저장하지 않고 hash/redacted summary/evidence_ref만 허용해야 한다.
- Acceptance decision matrix는 candidate presence와 accepted/final authority를 분리해야 한다.
- Operator verification index는 missing candidate, rejected candidate, required next action을 PASS로 숨기지 않아야 한다.
- P22001 handoff가 true여도 production/enterprise/release/write/runtime/connector/raw/final approval 권한은 모두 false다.
