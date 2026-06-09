# Hermes Roadmap P71601-P72000

P71601-P72000은 P71201-P71600 focused re-review dispatch gate 이후의 raw capture intake tranche다. 이 단계는 Claude Code Opus max focused re-review raw JSON을 evidence 후보로 받아들이거나, raw가 없거나 무효하면 이를 숨기지 않고 missing/invalid evidence BLOCK으로 고정한다. 이 tranche는 review evidence normalization, finding resolution, clean checkpoint, protected closeout, production PASS, enterprise PASS, final approval을 열지 않는다.

## Phase Objective

- P71600 dispatch gate artifact, dispatch packet, dispatch rows, raw capture gate rows, evidence counting guard rows를 source of truth로 묶는다.
- actual Claude focused re-review raw JSON이 있으면 wrapper, payload, reviewer lane, scope, HRM ids, finality boundary를 검사한다.
- raw JSON이 없거나 empty이면 `missing_evidence_block_rows`로 기록한다.
- auth failure, timeout/hang, malformed JSON, tool-call-shaped output, wrong scope, wrong reviewer, missing HRM ids는 `invalid_evidence_block_rows`로 기록한다.
- valid raw capture라도 review evidence counted, normalized receipt, finding resolution, clean checkpoint, protected closeout, production/enterprise PASS, final approval은 false로 유지한다.
- P72001이 valid raw normalization 또는 capture retry를 이어갈 수 있게 handoff한다.

## Source Binding

- `artifacts/post-p64000-focused-re-review-dispatch-gate/latest/post-p64000-focused-re-review-dispatch-gate.json`
- `artifacts/post-p64000-focused-re-review-dispatch-gate/latest/focused-re-review-dispatch-packet.md`
- `artifacts/post-p64000-focused-re-review-dispatch-gate/latest/focused-re-review-dispatch-packet-rows.json`
- `artifacts/post-p64000-focused-re-review-dispatch-gate/latest/durable-raw-capture-gate-rows.json`
- `artifacts/post-p64000-focused-re-review-dispatch-gate/latest/evidence-counting-guard-rows.json`
- expected optional raw: `artifacts/post-p64000-focused-re-review-raw-capture/review/claude-focused-re-review-raw.json`

## Output Rows

- `p71600_dispatch_gate_source_rows`
- `focused_re_review_raw_intake_rows`
- `missing_evidence_block_rows`
- `invalid_evidence_block_rows`
- `raw_review_output_shape_rows`
- `failure_mode_block_rows`
- `authority_boundary_rows`
- `negative_fixture_contract_rows`
- `validation_command_rows`
- `p72000_wiring_rows`
- `p72000_closeout_rows`
- `p72001_handoff_rows`

## Change Scope

- `schemas/post-p64000-focused-re-review-raw-capture-intake.schema.json`
- `src/post-p64000-focused-re-review-raw-capture-intake.mjs`
- `scripts/post-p64000-focused-re-review-raw-capture-intake.mjs`
- `test/post-p64000-focused-re-review-raw-capture-intake.test.mjs`
- `docs/hermes-roadmap-p71601-p72000.md`
- `package.json`
- `docs/architecture.md`

## Negative Fixtures

- `missing_p71600_dispatch_gate_source`
- `p71600_dispatch_gate_invalid`
- `missing_dispatch_packet`
- `missing_dispatch_rows`
- `missing_raw_capture_gate_rows`
- `missing_evidence_counting_guard_rows`
- `missing_raw_capture`
- `empty_raw_capture`
- `malformed_raw_json`
- `auth_failure_or_login_prompt`
- `timeout_or_hang_counted_as_evidence`
- `pty_stdout_loss_counted_as_evidence`
- `tool_call_shaped_output_counted_as_review`
- `wrong_reviewer_or_lane`
- `wrong_dispatch_scope`
- `wrong_reviewed_scope`
- `missing_required_hrm_ids`
- `finding_fixed_claim`
- `finding_verified_claim`
- `finding_resolved_claim`
- `reviewer_mutation_claim`
- `source_mutation_claim`
- `finding_resolution_claim`
- `patch_apply_claim`
- `write_action_claim`
- `clean_checkpoint_claim`
- `protected_closeout_claim`
- `production_pass_claim`
- `enterprise_pass_claim`
- `final_approval_claim`
- `missing_p72001_handoff`

## Validation Commands

```bash
node --check src/post-p64000-focused-re-review-raw-capture-intake.mjs
node --check scripts/post-p64000-focused-re-review-raw-capture-intake.mjs
node --test test/post-p64000-focused-re-review-raw-capture-intake.test.mjs
npm run platform:post-p64000-focused-re-review-raw-capture-intake -- --check
node --test test/post-p64000-focused-re-review-dispatch-gate.test.mjs test/post-p64000-focused-re-review-raw-capture-intake.test.mjs
npm run platform:review-authority-contract -- --check
npm run platform:review-process-upgrade -- --check
node -e 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8")); JSON.parse(require("node:fs").readFileSync("schemas/post-p64000-focused-re-review-raw-capture-intake.schema.json", "utf8"));'
git diff --check
```

## Authority Boundary

P71601-P72000은 intake와 block handoff만 수행한다. 다음은 모두 금지다.

- runtime execution
- command execution
- write action
- patch apply
- source mutation
- connector write
- reviewer mutation
- finding resolution
- fixed/verified/resolved claim
- normalized receipt claim
- review evidence counted claim
- missing evidence counted as review evidence
- invalid Claude output counted as review evidence
- clean checkpoint
- protected closeout
- deployment
- production PASS
- enterprise PASS
- Codex final approval
- Claude final approval
- final automated approval

## Closeout Criteria

- P71600 dispatch gate source is valid and ready for P71601 handoff.
- Raw capture state is exactly one of valid candidate, missing evidence block, or invalid evidence block.
- Missing or invalid raw capture is visible and never counted as review evidence.
- Valid raw capture is only a P72001 normalization candidate, not final review completion.
- Authority false flags remain false.
- Negative fixture rows are complete.
- Package/docs/schema/test wiring is present.
- P72001 handoff row is present and passing.

## Next-Phase Handoff

P72001-P72400 may normalize valid focused re-review raw JSON if it exists. If raw capture is missing or invalid, P72001 must keep normalization blocked and route the next allowed action to capture/retry actual Claude Code Opus max focused re-review raw JSON.
