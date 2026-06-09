# Hermes Roadmap P68001-P68400 Focused HRM Remediation Or Verification Planning

## Phase Objective

P68001-P68400 converts the P68000 normalized Claude review receipt into focused HRM remediation or verification planning. It does not resolve HRM-04, HRM-03, or HRM-01. It creates a deterministic plan and read-only verification packet so the next tranche can verify each remediation candidate without pretending that planning is evidence of a fix.

## Source Binding

- `artifacts/post-p64000-claude-review-receipt-normalization/latest/post-p64000-claude-review-receipt-normalization.json`
- `artifacts/post-p64000-claude-review-receipt-normalization/latest/normalized-claude-review-receipt.json`
- `artifacts/post-p64000-claude-review-receipt-normalization/latest/finding-loop-rows.json`
- `artifacts/post-p64000-claude-review-receipt-normalization/latest/finding-action-rows.json`
- `artifacts/post-p64000-hrm04-review-event-boundary/latest/post-p64000-hrm04-review-event-boundary.json`
- `artifacts/post-p64000-hrm03-review-window-cap/latest/post-p64000-hrm03-review-window-cap.json`
- `artifacts/post-p64000-hrm01-review-depth-cap/latest/post-p64000-hrm01-review-depth-cap.json`

## Output Rows

- `p68000_receipt_source_rows`: verifies P68000 validation, raw review hash, finding rows, and HRM blocking state.
- `focused_hrm_plan_rows`: creates one focused plan row each for HRM-04, HRM-03, and HRM-01, with candidate source refs and sha256 digests.
- `verification_packet_rows`: creates the read-only packet inputs for a future focused Claude verification event.
- `finding_state_preservation_rows`: proves the blocking findings remain `blocking_open` and clean checkpoint remains blocked.
- `authority_boundary_rows`: keeps runtime, write, protected action, deployment, production PASS, enterprise PASS, reviewer mutation, finding resolution, clean checkpoint, and final approval false.
- `negative_fixture_contract_rows`: records the blocking fixtures that would invalidate the P68400 plan.
- `validation_command_rows`: declares the diff-first commands required for this tranche.
- `p68400_closeout_rows`: closes only the planning contract.
- `p68401_handoff_rows`: hands off to focused verification evidence capture.

## Schema Script Doc Test Scope

- `schemas/post-p64000-focused-hrm-remediation-plan.schema.json`
- `src/post-p64000-focused-hrm-remediation-plan.mjs`
- `scripts/post-p64000-focused-hrm-remediation-plan.mjs`
- `test/post-p64000-focused-hrm-remediation-plan.test.mjs`
- `docs/hermes-roadmap-p68001-p68400.md`
- `docs/architecture.md`
- `package.json`

## Negative Fixtures

- missing P68000 normalization source
- invalid P68000 normalization
- missing normalized receipt
- missing raw review hash
- missing HRM blocking finding
- HRM finding auto-resolved
- focused plan claims fixed
- focused plan claims verified
- missing candidate source ref
- missing candidate digest
- missing verification packet
- missing per-finding next action
- patch apply claim
- write action claim
- clean checkpoint claim
- protected closeout claim
- production PASS claim
- enterprise PASS claim
- Codex final approval claim
- Claude final approval claim
- reviewer mutation claim
- source mutation claim
- finding resolution claim

## Validation Commands

```bash
node --check src/post-p64000-focused-hrm-remediation-plan.mjs
node --check scripts/post-p64000-focused-hrm-remediation-plan.mjs
node --test test/post-p64000-focused-hrm-remediation-plan.test.mjs
npm run platform:post-p64000-focused-hrm-remediation-plan -- --check
node --test test/post-p64000-claude-review-receipt-normalization.test.mjs test/post-p64000-focused-hrm-remediation-plan.test.mjs
npm run platform:review-authority-contract -- --check
npm run platform:review-process-upgrade -- --check
node -e 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8")); JSON.parse(require("node:fs").readFileSync("schemas/post-p64000-focused-hrm-remediation-plan.schema.json", "utf8"));'
git diff --check
```

## Authority Boundary

P68001-P68400 is plan and packet generation only. It does not perform runtime execution, command execution, write action, connector write, protected action, deployment, finding resolution, patch apply, reviewer mutation, source mutation, clean checkpoint, protected closeout, production PASS, enterprise PASS, Codex final approval, Claude final approval, or final automated approval.

## Closeout Criteria

- P68000 normalized receipt and raw hash are source-bound.
- HRM-04, HRM-03, and HRM-01 remain `blocking_open`.
- Each HRM candidate artifact has a source ref and sha256 digest.
- A focused verification packet exists for the next tranche.
- All authority and no-finality flags remain false.
- Negative fixtures are visible.
- Targeted validation passes.

## Next-Phase Handoff

P68401-P68800 should capture focused verification evidence for HRM-04, HRM-03, and HRM-01 candidate artifacts. It must treat P68400 as planning evidence only, not a fix, not verification completion, not finding resolution, and not a clean checkpoint.
