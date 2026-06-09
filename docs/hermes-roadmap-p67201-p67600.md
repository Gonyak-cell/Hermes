# Hermes Roadmap P67201-P67600

P67201-P67600은 P66801-P67200에서 만든 HRM clean-candidate review packet을 Claude Code Opus max read-only reviewer lane에 전달하고, 결과를 durable raw JSON으로 캡처하는 tranche다. 이 raw capture는 performed review event 후보이지만 아직 normalized receipt, finding resolution, clean checkpoint, protected closeout, production PASS, enterprise PASS, final approval이 아니다.

## Phase Objective

- P67200 clean-candidate packet과 packet boundary를 source로 고정한다.
- Claude Code Opus max, effort max, independent read-only dispatch metadata를 기록한다.
- Claude Code raw JSON wrapper와 내부 review JSON payload를 durable artifact로 캡처한다.
- auth failure, timeout/hang, PTY/stdout loss, malformed JSON, tool-call-shaped output을 review evidence로 세지 않는다.
- raw review가 HRM-04, HRM-03, HRM-01을 모두 검토했는지 확인한다.
- blocking finding이 있으면 숨기지 않고 P67601-P68000 normalization/finding loop로 넘긴다.

## Source Binding

- `artifacts/post-p64000-hrm-revalidation-clean-candidate-review/latest/post-p64000-hrm-revalidation-clean-candidate-review.json`
- `artifacts/post-p64000-hrm-revalidation-clean-candidate-review/latest/clean-candidate-review-packet.md`
- `artifacts/post-p64000-hrm-revalidation-clean-candidate-review/latest/clean-candidate-review-packet-boundary.json`
- `artifacts/post-p64000-claude-read-only-review-capture/review/claude-review-dispatch-metadata.json`
- `artifacts/post-p64000-claude-read-only-review-capture/review/claude-review-raw.json`

## Output Rows

- `p67200_source_binding_rows`
- `model_policy_rows`
- `durable_raw_json_capture_rows`
- `review_output_shape_rows`
- `review_event_boundary_rows`
- `authority_boundary_rows`
- `negative_fixture_contract_rows`
- `validation_command_rows`
- `p67600_wiring_rows`
- `p67600_closeout_rows`
- `p67601_handoff_rows`

## Schema, Script, Doc, Test Scope

- `schemas/post-p64000-claude-read-only-review-capture.schema.json`
- `src/post-p64000-claude-read-only-review-capture.mjs`
- `scripts/post-p64000-claude-read-only-review-capture.mjs`
- `test/post-p64000-claude-read-only-review-capture.test.mjs`
- `docs/hermes-roadmap-p67201-p67600.md`
- `docs/architecture.md`
- `package.json`

## Negative Fixtures

- missing P67200 source result
- P67200 not ready for handoff
- missing clean-candidate packet
- packet boundary claims review event
- missing dispatch metadata
- wrong reviewer model or effort
- missing raw capture
- empty raw capture
- malformed raw JSON
- auth failure or login prompt
- timeout or hang counted as evidence
- PTY/stdout loss counted as evidence
- tool-call-shaped output counted as review
- missing review JSON payload
- review payload not performed event
- review payload wrong scope
- review payload missing HRM ids
- reviewer mutation claim
- source mutation claim
- finding resolution claim
- clean checkpoint claim
- Claude final approval claim
- production PASS claim
- enterprise PASS claim

## Validation Commands

```bash
node --check src/post-p64000-claude-read-only-review-capture.mjs
node --check scripts/post-p64000-claude-read-only-review-capture.mjs
node --test test/post-p64000-claude-read-only-review-capture.test.mjs
npm run platform:post-p64000-claude-read-only-review-capture -- --check
node --test test/post-p64000-hrm-revalidation-clean-candidate-review.test.mjs test/post-p64000-claude-read-only-review-capture.test.mjs
npm run platform:review-authority-contract -- --check
npm run platform:review-process-upgrade -- --check
node -e 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8")); JSON.parse(require("node:fs").readFileSync("schemas/post-p64000-claude-read-only-review-capture.schema.json", "utf8"));'
git diff --check
```

## Authority Boundary

P67600에서 허용되는 것은 Claude Code Opus max read-only review raw JSON capture뿐이다. 다음은 모두 false다.

- runtime execution
- command execution
- write action
- direct file write
- generated patch apply
- connector ingestion/write
- external service mutation
- raw material access
- cross-domain access
- secret read
- protected action
- protected closeout
- deployment
- release approval
- production PASS
- enterprise PASS
- enterprise trust claim
- Codex final approval
- Claude final approval
- final automated approval
- reviewer mutation
- source mutation from review
- finding resolution
- finding auto-resolution
- clean checkpoint claim
- protected closeout from review

## Closeout Criteria

- P67200 source result, clean-candidate packet, and packet boundary are valid.
- Dispatch metadata records Claude Code Opus max, `model_alias=opus`, `effort=max`, and independent read-only lane.
- Claude raw JSON exists, parses as Claude Code result wrapper, is success, is not auth failure, and is not tool-call-shaped output.
- Raw result contains extractable review JSON payload.
- Payload marks itself as `is_claude_review_event=true` but `is_final_approval=false`, `is_production_pass=false`, and `is_enterprise_pass=false`.
- Payload covers `reviewed_program_range=P66801-P67200`, `review_event_program_range=P67201-P67600`, and all HRM-04/03/01 ids.
- Payload does not claim source mutation, finding resolution, clean checkpoint, protected closeout, production PASS, enterprise PASS, or final approval.

## Next-Phase Handoff

P67601-P68000 should normalize this durable raw JSON into a Claude review receipt and route findings into the finding loop. P67600 itself is not a clean checkpoint, protected closeout, production PASS, enterprise PASS, or final approval.
