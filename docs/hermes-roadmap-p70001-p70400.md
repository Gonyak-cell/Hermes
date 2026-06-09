# Hermes Roadmap P70001-P70400

P70001-P70400은 P69601-P70000에서 캡처한 Claude Code Opus max focused raw JSON을 normalized focused review receipt와 finding loop로 전환하는 tranche다. 이 단계는 review evidence를 구조화하지만, finding fixed/verified/resolved, finding resolution, clean checkpoint, protected closeout, production PASS, enterprise PASS, final approval을 열지 않는다.

## Phase Objective

- P70000 durable focused raw JSON capture를 source로 고정한다.
- raw review hash, reviewer, lane, dispatch scope, reviewed scope, event scope를 normalized focused receipt에 보존한다.
- Claude finding을 blocking/nonblocking으로 분류하고 HRM-04, HRM-03, HRM-01 blocking status를 숨기지 않는다.
- 각 finding에 next allowed action을 부여하되 fixed, verified, resolved, patch apply, clean checkpoint로 해석하지 않는다.
- clean checkpoint, protected closeout, production PASS, enterprise PASS, Codex/Claude/final approval을 계속 false로 유지한다.

## Source Binding

- `artifacts/post-p64000-focused-claude-review-raw-capture/latest/post-p64000-focused-claude-review-raw-capture.json`
- `artifacts/post-p64000-focused-claude-review-raw-capture/latest/extracted-focused-review-payload.json`
- `artifacts/post-p64000-focused-claude-review-raw-capture/latest/focused-review-output-shape-rows.json`
- `artifacts/post-p64000-focused-claude-review-raw-capture/latest/focused-review-event-boundary-rows.json`
- `artifacts/post-p64000-focused-claude-review-raw-capture/review/claude-focused-review-raw.json`

## Output Rows

- `p70000_capture_source_rows`
- `normalized_focused_review_receipt_rows`
- `focused_finding_classification_rows`
- `focused_finding_loop_rows`
- `focused_finding_action_rows`
- `receipt_boundary_rows`
- `authority_boundary_rows`
- `negative_fixture_contract_rows`
- `validation_command_rows`
- `p70400_wiring_rows`
- `p70400_closeout_rows`
- `p70401_handoff_rows`

## Schema, Script, Doc, Test Scope

- `schemas/post-p64000-focused-claude-review-receipt-normalization.schema.json`
- `src/post-p64000-focused-claude-review-receipt-normalization.mjs`
- `scripts/post-p64000-focused-claude-review-receipt-normalization.mjs`
- `test/post-p64000-focused-claude-review-receipt-normalization.test.mjs`
- `docs/hermes-roadmap-p70001-p70400.md`
- `docs/architecture.md`
- `package.json`

## Negative Fixtures

- missing P70000 capture source
- P70000 capture invalid
- missing raw review hash
- raw review hash mismatch
- missing extracted payload
- malformed focused review payload
- wrong reviewer or lane
- wrong dispatch scope
- wrong reviewed scope
- wrong event scope
- missing required HRM ids
- missing finding required field
- blocking finding hidden
- fixed claim in payload
- verified claim in payload
- resolved claim in payload
- finding auto-resolved
- dispatch metadata counted as review
- raw capture counted as normalized receipt
- clean checkpoint claim
- protected closeout claim
- final approval claim
- production PASS claim
- enterprise PASS claim
- reviewer mutation claim
- source mutation claim
- finding resolution claim
- missing next action

## Validation Commands

```bash
node --check src/post-p64000-focused-claude-review-receipt-normalization.mjs
node --check scripts/post-p64000-focused-claude-review-receipt-normalization.mjs
node --test test/post-p64000-focused-claude-review-receipt-normalization.test.mjs
npm run platform:post-p64000-focused-claude-review-receipt-normalization -- --check
node --test test/post-p64000-focused-claude-review-raw-capture.test.mjs test/post-p64000-focused-claude-review-receipt-normalization.test.mjs
npm run platform:review-authority-contract -- --check
npm run platform:review-process-upgrade -- --check
node -e 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8")); JSON.parse(require("node:fs").readFileSync("schemas/post-p64000-focused-claude-review-receipt-normalization.schema.json", "utf8"));'
git diff --check
```

## Authority Boundary

P70400은 focused receipt normalization과 finding loop routing만 수행한다. 다음은 모두 false다.

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
- finding fixed/verified/resolved claim
- finding resolution
- finding auto-resolution
- clean checkpoint claim
- protected closeout from review

## Closeout Criteria

- P70000 capture artifact is valid and ready for P70001 handoff.
- Raw review SHA-256 from P70000 matches the durable raw JSON file.
- Extracted focused review payload is available and binds to `dispatch_program_range=P69201-P69600`, `reviewed_program_range=P68801-P69200`, and `review_event_program_range=P69601-P70000`.
- Normalized focused receipt preserves reviewer, lane, raw hash, reviewed HRM ids, findings, and next handoff recommendations.
- HRM-04, HRM-03, and HRM-01 remain `blocking_open`.
- Blocking findings route to remediation closeout candidate or re-review planning, not clean checkpoint.
- Nonblocking findings route to tracked follow-up, not hidden pass.
- Authority boundary and protected output false flags remain false.

## Next-Phase Handoff

P70401-P70800 should convert normalized focused review findings into a remediation closeout candidate or re-review plan. P70400 itself is not clean checkpoint, protected closeout, production PASS, enterprise PASS, or final approval.
