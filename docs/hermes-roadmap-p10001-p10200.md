# Hermes Roadmap P10001-P10200 Claude Review Integration Lane

P10001-P10200은 P10000 Product Build Verification Loop 다음 단계다. 목표는 Claude Code Opus max 또는 최신 Opus equivalent review를 Hermes의 독립 reviewer evidence lane으로 정식화하되, Claude가 source mutation, final approval, protected closeout, production PASS, enterprise PASS를 만들 수 없도록 고정하는 것이다.

## Phase Plan

| Range | Name | Goal | Output |
|---|---|---|---|
| P10001-P10020 | P10000 Source Binding | P10000 product build verification artifact와 P10000 Claude receipt를 source로 묶는다. | `p10000_source_binding_rows` |
| P10021-P10040 | Claude Review Request Contract | review request id, reviewed artifact, prompt ref, model policy, effort policy, mutation boundary를 표준화한다. | `review_request_packet_rows` |
| P10041-P10060 | Model And Effort Evidence | requested model, observed model, requested effort, max effort evidence를 receipt에서 분리해 검증한다. | `model_effort_evidence_rows` |
| P10061-P10080 | Review Receipt Intake | Claude receipt가 completed, read-only, non-final인지 intake gate로 판정한다. | `review_receipt_intake_rows` |
| P10081-P10100 | Finding Normalization Contract | Claude finding을 severity, category, blocking, unresolved, revalidation requirement로 정규화한다. | `finding_normalization_rows` |
| P10101-P10120 | Unresolved Finding Blocker | unresolved 또는 blocking finding이 closeout을 막도록 fail-closed gate를 둔다. | `unresolved_finding_blocker_rows` |
| P10121-P10140 | Revalidation Evidence Binding | nonblocking finding도 revalidation evidence 없이 closeout되지 않도록 묶는다. | `review_revalidation_binding_rows` |
| P10141-P10160 | Review Authority Boundary | Codex/Claude final approval, reviewer mutation, GitHub approval 대체, human owner adjudication 대체를 모두 false로 고정한다. | `review_authority_boundary` |
| P10161-P10180 | Review API Projection | review request, receipt, finding, unresolved, revalidation, boundary를 read-only API/UI로 투영한다. | `review_api_route_rows`, `review_api_smoke_rows`, `review_browser_smoke_rows` |
| P10181-P10200 | P10200 Freeze | source, request, model evidence, receipt, finding loop, revalidation, boundary, negative fixtures를 freeze한다. | `p10200_freeze_rows`, `review_gate_rows` |

## Required Review Contract

P10001-P10200은 required Claude closeout review tranche다. 단, 이 review는 final approval이 아니라 review evidence다.

Required receipt properties:

- `review_status=completed`
- `review_effort_requested=max` 또는 equivalent max effort evidence
- requested/observed model이 Claude Opus 또는 최신 Opus equivalent 정책과 호환
- `reviewer_mutation_allowed=false`
- `reviewer_mutated_source`는 true일 수 없음
- `codex_final_approval_allowed=false`
- `claude_final_approval_allowed=false`
- `production_pass_allowed=false`
- `enterprise_pass_allowed=false`
- blocking finding count는 0
- unresolved finding count는 0

## Fail-Closed Rules

다음 조건은 P10200 closeout을 BLOCK한다.

- P10000 source artifact가 ready가 아님
- P10000 Claude source receipt가 없음
- P10200 review request packet이 없음
- model/effort evidence가 없음
- P10200 Claude receipt가 없음
- receipt가 source mutation 또는 final approval을 허용함
- blocking finding이 있음
- unresolved finding이 있음
- nonblocking finding에 revalidation evidence가 없음
- API/UI가 write method, protected action, raw material, secret key를 노출함

## Completion Criteria

```text
P10000 source 없음 = P10200 PASS 없음
P10000 Claude receipt 없음 = P10200 PASS 없음
review request 없음 = Claude review 없음
model/effort evidence 없음 = review evidence PASS 없음
completed receipt 없음 = closeout 없음
unresolved finding 있음 = closeout BLOCK
revalidation 없는 finding 있음 = closeout BLOCK
Claude mutation/final approval/production PASS/enterprise PASS = 항상 false
API/UI는 read-only projection만 허용
```
