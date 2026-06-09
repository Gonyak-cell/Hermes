# Hermes Roadmap P68801-P69200 Focused Verification Capture Normalization

## Phase Objective

P68801-P69200 consumes the P68800 focused verification capture and normalizes it into finding status recommendations. Because the focused Claude review has not been completed in this tranche, every HRM-04, HRM-03, and HRM-01 recommendation must remain `verification_pending`. This phase does not claim fixed status, verified status, resolved status, clean checkpoint, protected closeout, production PASS, enterprise PASS, or final approval.

## Source Binding

- `artifacts/post-p64000-focused-hrm-verification-capture/latest/post-p64000-focused-hrm-verification-capture.json`
- `artifacts/post-p64000-focused-hrm-verification-capture/latest/focused-verification-capture-envelope.md`
- `artifacts/post-p64000-focused-hrm-verification-capture/latest/focused-verification-evidence-rows.json`
- `artifacts/post-p64000-focused-hrm-verification-capture/latest/candidate-digest-match-rows.json`
- `artifacts/post-p64000-focused-hrm-verification-capture/latest/verification-event-boundary-rows.json`
- `artifacts/post-p64000-focused-hrm-verification-capture/latest/finding-state-continuity-rows.json`

## Output Rows

- `p68800_source_binding_rows`: verifies P68800 source readiness, capture envelope, evidence rows, digest rows, event boundary rows, and finding continuity rows.
- `normalized_capture_rows`: normalizes each HRM capture row as `candidate_capture_ready` with recommendation `verification_pending`.
- `finding_status_recommendation_rows`: records one pending recommendation for HRM-04, HRM-03, and HRM-01.
- `verification_pending_guard_rows`: blocks fixed, verified, resolved, clean checkpoint, and review-completed claims.
- `future_review_packet_rows`: prepares the next focused Claude review dispatch metadata handoff.
- `authority_boundary_rows`: keeps runtime, write, protected action, deployment, production PASS, enterprise PASS, reviewer mutation, finding resolution, clean checkpoint, and final approval false.
- `negative_fixture_contract_rows`: records the blocking fixtures that would invalidate normalization.
- `validation_command_rows`: declares the diff-first commands required for this tranche.
- `p69200_closeout_rows`: closes only the normalization contract.
- `p69201_handoff_rows`: hands off to focused Claude review dispatch metadata.

## Schema Script Doc Test Scope

- `schemas/post-p64000-focused-hrm-verification-normalization.schema.json`
- `src/post-p64000-focused-hrm-verification-normalization.mjs`
- `scripts/post-p64000-focused-hrm-verification-normalization.mjs`
- `test/post-p64000-focused-hrm-verification-normalization.test.mjs`
- `docs/hermes-roadmap-p68801-p69200.md`
- `docs/architecture.md`
- `package.json`

## Negative Fixtures

- missing P68800 source
- P68800 invalid or not ready
- missing focused evidence row
- missing digest row
- candidate digest mismatch
- missing capture envelope
- review event completed claim
- recommendation claims fixed
- recommendation claims verified
- recommendation claims resolved
- finding auto-resolved
- clean checkpoint claim
- protected closeout claim
- production PASS claim
- enterprise PASS claim
- source mutation claim
- patch apply claim
- write action claim
- reviewer mutation claim
- Codex final approval claim
- Claude final approval claim
- final automated approval claim
- missing future focused review handoff

## Validation Commands

```bash
node --check src/post-p64000-focused-hrm-verification-normalization.mjs
node --check scripts/post-p64000-focused-hrm-verification-normalization.mjs
node --test test/post-p64000-focused-hrm-verification-normalization.test.mjs
npm run platform:post-p64000-focused-hrm-verification-normalization -- --check
node --test test/post-p64000-focused-hrm-verification-capture.test.mjs test/post-p64000-focused-hrm-verification-normalization.test.mjs
npm run platform:review-authority-contract -- --check
npm run platform:review-process-upgrade -- --check
node -e 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8")); JSON.parse(require("node:fs").readFileSync("schemas/post-p64000-focused-hrm-verification-normalization.schema.json", "utf8"));'
git diff --check
```

## Authority Boundary

P68801-P69200 is recommendation normalization only. It does not perform focused Claude review completion, runtime execution, command execution, write action, connector write, protected action, deployment, finding resolution, patch apply, reviewer mutation, source mutation, clean checkpoint, protected closeout, production PASS, enterprise PASS, Codex final approval, Claude final approval, or final automated approval.

## Closeout Criteria

- P68800 focused verification capture is valid and ready for P68801.
- HRM-04, HRM-03, and HRM-01 normalized capture rows exist.
- Every finding status recommendation is `verification_pending`.
- Fixed, verified, resolved, clean checkpoint, protected closeout, production PASS, enterprise PASS, and final approval claims remain false.
- Future focused review dispatch metadata handoff exists.
- Targeted validation passes.

## Next-Phase Handoff

P69201-P69600 should prepare focused Claude review dispatch metadata. Dispatch preparation, auth failures, timeouts, hangs, malformed output, or pending recommendations must not be counted as review evidence or final approval.
