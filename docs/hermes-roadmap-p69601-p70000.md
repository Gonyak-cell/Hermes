# Hermes Roadmap P69601-P70000

P69601-P70000은 P69201-P69600에서 준비한 focused Claude review dispatch metadata를 실제 Claude Code Opus max read-only review raw JSON capture로 전환하는 tranche다. 이 단계는 performed focused review event 후보를 durable raw JSON으로 남기지만, 아직 normalized receipt, finding resolution, clean checkpoint, protected closeout, production PASS, enterprise PASS, final approval이 아니다.

## Phase Objective

- P69600 dispatch metadata와 guard rows를 source로 고정한다.
- Claude Code Opus max, effort max, independent read-only focused review lane을 검증한다.
- Claude Code raw JSON wrapper와 내부 focused review JSON payload를 durable artifact로 캡처한다.
- auth failure, timeout/hang, PTY/stdout loss, malformed JSON, tool-call-shaped output, dispatch metadata를 review evidence로 세지 않는다.
- raw payload가 HRM-04, HRM-03, HRM-01을 모두 다루고 `dispatch_program_range=P69201-P69600`, `reviewed_program_range=P68801-P69200`, `review_event_program_range=P69601-P70000`에 바인딩되는지 확인한다.
- blocking finding이 있으면 숨기지 않고 P70001-P70400 normalization/finding loop로 넘긴다.

## Source Binding

- `artifacts/post-p64000-focused-claude-review-dispatch-metadata/latest/post-p64000-focused-claude-review-dispatch-metadata.json`
- `artifacts/post-p64000-focused-claude-review-dispatch-metadata/latest/focused-claude-review-dispatch-packet.md`
- `artifacts/post-p64000-focused-claude-review-dispatch-metadata/latest/dispatch-metadata-rows.json`
- `artifacts/post-p64000-focused-claude-review-dispatch-metadata/latest/review-scope-rows.json`
- `artifacts/post-p64000-focused-claude-review-dispatch-metadata/latest/review-prompt-guard-rows.json`
- `artifacts/post-p64000-focused-claude-review-dispatch-metadata/latest/evidence-counting-guard-rows.json`
- `artifacts/post-p64000-focused-claude-review-raw-capture/review/claude-focused-review-raw.json`

## Output Rows

- `p69600_source_binding_rows`
- `focused_model_policy_rows`
- `durable_raw_json_capture_rows`
- `focused_review_output_shape_rows`
- `focused_review_event_boundary_rows`
- `authority_boundary_rows`
- `negative_fixture_contract_rows`
- `validation_command_rows`
- `p70000_wiring_rows`
- `p70000_closeout_rows`
- `p70001_handoff_rows`

## Schema, Script, Doc, Test Scope

- `schemas/post-p64000-focused-claude-review-raw-capture.schema.json`
- `src/post-p64000-focused-claude-review-raw-capture.mjs`
- `scripts/post-p64000-focused-claude-review-raw-capture.mjs`
- `test/post-p64000-focused-claude-review-raw-capture.test.mjs`
- `docs/hermes-roadmap-p69601-p70000.md`
- `docs/architecture.md`
- `package.json`

## Negative Fixtures

- missing P69600 dispatch source
- P69600 not ready for handoff
- missing dispatch packet
- missing dispatch rows
- wrong reviewer model or effort
- missing raw capture
- empty raw capture
- malformed raw JSON
- auth failure or login prompt
- timeout or hang counted as evidence
- PTY/stdout loss counted as evidence
- tool-call-shaped output counted as review
- dispatch metadata counted as review
- missing focused review payload
- review payload wrong dispatch scope
- review payload wrong reviewed scope
- review payload wrong event scope
- review payload missing HRM ids
- finding fixed claim
- finding verified claim
- finding resolved claim
- reviewer mutation claim
- source mutation claim
- finding resolution claim
- clean checkpoint claim
- protected closeout claim
- Claude final approval claim
- production PASS claim
- enterprise PASS claim

## Validation Commands

```bash
node --check src/post-p64000-focused-claude-review-raw-capture.mjs
node --check scripts/post-p64000-focused-claude-review-raw-capture.mjs
node --test test/post-p64000-focused-claude-review-raw-capture.test.mjs
npm run platform:post-p64000-focused-claude-review-raw-capture -- --check
node --test test/post-p64000-focused-claude-review-dispatch-metadata.test.mjs test/post-p64000-focused-claude-review-raw-capture.test.mjs
npm run platform:review-authority-contract -- --check
npm run platform:review-process-upgrade -- --check
node -e 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8")); JSON.parse(require("node:fs").readFileSync("schemas/post-p64000-focused-claude-review-raw-capture.schema.json", "utf8"));'
git diff --check
```

## Authority Boundary

P70000에서 허용되는 것은 Claude Code Opus max read-only focused review raw JSON capture뿐이다. 다음은 모두 false다.

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

- P69600 dispatch metadata, dispatch packet, dispatch rows, review scope rows, prompt guard rows, and evidence guard rows are valid.
- P69600 summary keeps `dispatch_performed_now=false`, `raw_review_captured_now=false`, and `review_evidence_counted_now=false`.
- Claude raw JSON exists, parses as Claude Code result wrapper, is success, is not auth failure, and is not tool-call-shaped output.
- Raw result contains extractable focused review JSON payload.
- Payload marks itself as `is_claude_review_event=true` but `is_final_approval=false`, `is_production_pass=false`, and `is_enterprise_pass=false`.
- Payload covers `dispatch_program_range=P69201-P69600`, `reviewed_program_range=P68801-P69200`, `review_event_program_range=P69601-P70000`, and all HRM-04/03/01 ids.
- Payload does not claim source mutation, finding fixed/verified/resolved status, finding resolution, clean checkpoint, protected closeout, production PASS, enterprise PASS, or final approval.

## Next-Phase Handoff

P70001-P70400 should normalize this durable focused raw JSON into a focused Claude review receipt and route findings into the finding loop. P70000 itself is not a clean checkpoint, protected closeout, production PASS, enterprise PASS, or final approval.
