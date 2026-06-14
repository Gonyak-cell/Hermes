# Hermes Roadmap P71201-P71600

P71201-P71600은 P70801-P71200 strict remediation plan을 focused re-review dispatch packet과 durable raw JSON capture gate로 전환하는 tranche다. 이 단계는 실제 Claude re-review evidence capture가 아니다. dispatch packet은 review evidence가 아니며, durable raw JSON capture와 evidence counting은 P71601 이후에만 가능하다.

## Phase Objective

- P71200 strict remediation plan을 source of truth로 삼는다.
- HRM-04/03/01별 focused re-review dispatch packet row를 만든다.
- HRM-04/03/01별 durable raw JSON capture gate row를 만든다.
- dispatch packet, auth failure, timeout, hang, malformed output, tool-call-shaped output이 review evidence로 카운트되지 않도록 guard를 만든다.
- P71601이 실제 raw capture를 시도하거나 evidence missing으로 BLOCK할 수 있게 handoff한다.

## Source Binding

- `artifacts/post-p64000-focused-strict-remediation-plan/latest/post-p64000-focused-strict-remediation-plan.json`
- `artifacts/post-p64000-focused-strict-remediation-plan/latest/strict-remediation-plan-rows.json`
- `artifacts/post-p64000-focused-strict-remediation-plan/latest/re-review-dispatch-readiness-rows.json`
- `artifacts/post-p64000-focused-strict-remediation-plan/latest/evidence-requirement-rows.json`
- `artifacts/post-p64000-focused-strict-remediation-plan/latest/strict-remediation-plan-packet.md`

## Output Rows

- `p71200_strict_plan_source_rows`
- `focused_re_review_dispatch_packet_rows`
- `durable_raw_capture_gate_rows`
- `evidence_counting_guard_rows`
- `failure_mode_guard_rows`
- `authority_boundary_rows`
- `negative_fixture_contract_rows`
- `validation_command_rows`
- `p71600_wiring_rows`
- `p71600_closeout_rows`
- `p71601_handoff_rows`

## Change Scope

- `schemas/post-p64000-focused-re-review-dispatch-gate.schema.json`
- `src/post-p64000-focused-re-review-dispatch-gate.mjs`
- `scripts/post-p64000-focused-re-review-dispatch-gate.mjs`
- `test/post-p64000-focused-re-review-dispatch-gate.test.mjs`
- `docs/hermes-roadmap-p71201-p71600.md`
- `package.json`
- `docs/architecture.md`

## Negative Fixtures

- `missing_p71200_strict_plan_source`
- `p71200_strict_plan_invalid`
- `missing_strict_plan_rows`
- `missing_re_review_dispatch_readiness_rows`
- `missing_evidence_requirement_rows`
- `missing_strict_remediation_packet`
- `missing_required_hrm_dispatch_row`
- `dispatch_packet_counted_as_review_evidence`
- `raw_capture_claimed_before_capture`
- `auth_failure_counted_as_evidence`
- `timeout_or_hang_counted_as_evidence`
- `malformed_output_counted_as_evidence`
- `tool_call_shaped_output_counted_as_review`
- `reviewer_completion_claim`
- `finding_fixed_claim`
- `finding_verified_claim`
- `finding_resolved_claim`
- `source_mutation_claim`
- `patch_apply_claim`
- `write_action_claim`
- `clean_checkpoint_claim`
- `protected_closeout_claim`
- `production_pass_claim`
- `enterprise_pass_claim`
- `final_approval_claim`
- `missing_durable_raw_capture_gate`
- `missing_p71601_handoff`

## Validation Commands

```bash
node --check src/post-p64000-focused-re-review-dispatch-gate.mjs
node --check scripts/post-p64000-focused-re-review-dispatch-gate.mjs
node --test test/post-p64000-focused-re-review-dispatch-gate.test.mjs
npm run platform:post-p64000-focused-re-review-dispatch-gate -- --check
node --test test/post-p64000-focused-strict-remediation-plan.test.mjs test/post-p64000-focused-re-review-dispatch-gate.test.mjs
npm run platform:review-authority-contract -- --check
npm run platform:review-process-upgrade -- --check
node -e 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8")); JSON.parse(require("node:fs").readFileSync("schemas/post-p64000-focused-re-review-dispatch-gate.schema.json", "utf8"));'
git diff --check
```

## Authority Boundary

P71201-P71600은 dispatch packet과 capture gate만 만든다. 다음은 모두 금지다.

- runtime execution
- command execution
- write action
- patch apply
- source mutation
- connector write
- reviewer mutation
- finding resolution
- fixed/verified/resolved claim
- reviewer completion claim
- durable raw JSON captured claim
- review evidence counted claim
- dispatch packet counted as review evidence
- invalid Claude output counted as evidence
- clean checkpoint
- protected closeout
- deployment
- production PASS
- enterprise PASS
- Codex final approval
- Claude final approval
- final automated approval

## Closeout Criteria

- P71200 strict plan source is valid and ready for P71201 handoff.
- HRM-04/03/01 dispatch packet rows are present.
- HRM-04/03/01 durable raw capture gate rows are present.
- Evidence counting guard rows keep dispatch packet, missing raw capture, auth failure, timeout, hang, malformed output, and tool-call-shaped output out of review evidence.
- No row claims fixed, verified, resolved, source mutation, patch apply, write action, clean checkpoint, production PASS, enterprise PASS, or final approval.
- P71601 handoff row is present and passing.

## Next-Phase Handoff

P71601-P72000 may capture actual Claude Code Opus max focused re-review raw JSON. If valid durable raw JSON is missing, auth-failure, timed out, hung, malformed, or tool-call-shaped, the next tranche must remain BLOCK instead of pretending review evidence exists.
