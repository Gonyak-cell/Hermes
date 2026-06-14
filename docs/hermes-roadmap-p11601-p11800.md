# Hermes Roadmap P11601-P11800 UI Governance And Visual Regression Freeze

P11601-P11800은 P11600 Operator Queue UI v0 다음 단계다. 목표는 Global Operator Console의 UI governance, negative fixtures, visual regression, accessibility regression, review evidence, and design-system freeze 조건을 deterministic artifact로 고정하는 것이다.

이 단계는 UI freeze milestone이므로 Claude Code Opus max review receipt가 필요하다. 다만 Claude review는 독립 검토 evidence일 뿐 final approval, human adjudication, production PASS, enterprise PASS, protected closeout 권한을 만들지 않는다.

## Phase Plan

| Range | Name | Goal | Output |
|---|---|---|---|
| P11601-P11620 | UI Governance Source Binding | P11401-P11600 Operator Queue source binding과 P11800 freeze 전제를 고정한다. | `ui_governance_source_binding_rows` |
| P11621-P11640 | Negative UI Fixture Matrix | raw/full/secret/write/form/final approval/AI approved/production/enterprise/domain identity/KPI dashboard copy를 차단한다. | `negative_ui_fixture_rows` |
| P11641-P11660 | Visual Regression Fixture Manifest | desktop/mobile/tablet snapshots, nonblank, no overlap, text fit, stable dimensions, responsive constraints를 정의한다. | `visual_regression_fixture_rows` |
| P11661-P11680 | Accessibility Regression Contract | keyboard focus, ARIA labels, contrast, status announcement, reduced motion, no viewport font scaling, stable dimensions, screen reader를 정의한다. | `accessibility_regression_rows` |
| P11681-P11700 | Read-only UI/API Governance Smoke | GET/HEAD only, POST blocked, sanitized payload, no raw, no secret, no mutation, no final approval, no production/enterprise를 검증한다. | `read_only_governance_smoke_rows` |
| P11701-P11720 | Boundary Copy Audit | AI approved, Claude approved, Codex approved, production ready, enterprise PASS, smart insight, auto resolved, final approver 문구를 금지한다. | `boundary_copy_audit_rows` |
| P11721-P11740 | Claude Review Packet Requirement | Claude Code Opus max, effort max, durable raw JSON ref, receipt, no mutation, no final approval boundary, actual changed file refs, not summary-only 조건을 요구한다. | `claude_review_packet_rows` |
| P11741-P11760 | Claude Finding Loop Contract | finding normalization, severity, evidence ref, revalidation ref, unresolved P0/P1 blocker, no auto-resolve를 정의한다. | `claude_finding_loop_rows` |
| P11761-P11780 | Design-System Freeze Matrix | source, negative, visual, accessibility, API smoke, copy, Claude receipt, finding loop을 freeze matrix로 결합한다. | `design_system_freeze_matrix_rows` |
| P11781-P11800 | Global Console Design-System Freeze | P11800 design-system freeze와 P11801 SaaS quality gate handoff를 고정한다. | `p11800_freeze_rows` |

## Governance Contract

- P11600 source 없이는 P11800 freeze가 없다.
- P11800 freeze requires durable Claude Code Opus max review evidence.
- P11800 Claude receipt must cite actual changed file refs and must not be summary-only or self-attestation-only.
- Claude review evidence를 안전하게 capture하지 못하면 P11800 artifact는 explicit BLOCK 상태로 유효하게 남고, `ready_for_p11801_handoff`는 false여야 한다.
- Claude review receipt is review evidence, not final approval.
- Unresolved P0/P1 Claude findings block freeze.
- Visual regression fixtures must include desktop, tablet, and mobile.
- Accessibility regression must include keyboard focus, ARIA labels, contrast, reduced motion, stable dimensions, and screen reader behavior.
- UI/API smoke must remain read-only and sanitized, with no production/enterprise trust copy.
- No UI copy may say AI approved, Claude approved, Codex approved, production ready, enterprise PASS, smart insight, auto resolved, or final approver.

## Completion Criteria

```text
P11600 operator queue source 없음 = P11800 freeze 없음
negative UI fixtures 없음 = BLOCK
visual regression fixtures 없음 = BLOCK
accessibility regression 없음 = BLOCK
read-only UI/API smoke 없음 = BLOCK
boundary copy audit 없음 = BLOCK
Claude review packet 없음 = BLOCK
durable Claude review receipt 없음 = BLOCK
Claude review capture unsafe/unavailable = explicit BLOCK
unresolved P0/P1 finding 있음 = BLOCK
raw/full body exposure 없음
secret-bearing key exposure 없음
write/protected action 없음
form/button execution 없음
Codex/Claude final approval 없음
production PASS 없음
enterprise PASS 없음
domain pack product identity 없음
KPI dashboard home 없음
P11800 design-system freeze는 durable Claude review evidence가 있을 때만 가능
P11801 SaaS quality gate handoff는 durable Claude review evidence가 있을 때만 가능
```
