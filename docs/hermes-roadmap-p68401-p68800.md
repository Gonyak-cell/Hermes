# Hermes Roadmap P68401-P68800 Focused HRM Verification Evidence Capture

## Phase Objective

P68401-P68800 consumes the P68400 focused HRM verification packet and captures the source evidence needed for later focused HRM verification normalization. It proves candidate source refs and sha256 digests are still stable and packages per-HRM evidence rows for HRM-04, HRM-03, and HRM-01. It does not complete a Claude review event, does not decide fixed or verified status, and does not resolve findings.

## Source Binding

- `artifacts/post-p64000-focused-hrm-remediation-plan/latest/post-p64000-focused-hrm-remediation-plan.json`
- `artifacts/post-p64000-focused-hrm-remediation-plan/latest/focused-hrm-verification-packet.md`
- `artifacts/post-p64000-focused-hrm-remediation-plan/latest/verification-packet-rows.json`
- `artifacts/post-p64000-focused-hrm-remediation-plan/latest/focused-hrm-plan-rows.json`
- HRM-04, HRM-03, and HRM-01 candidate JSON artifacts referenced by P68400

## Output Rows

- `p68400_source_binding_rows`: verifies P68400 source readiness and packet availability.
- `focused_verification_evidence_rows`: captures one source/digest/question evidence row each for HRM-04, HRM-03, and HRM-01.
- `candidate_digest_match_rows`: proves the current candidate artifact digest matches the P68400 digest.
- `verification_event_boundary_rows`: prevents this capture from being treated as a completed Claude review event.
- `finding_state_continuity_rows`: keeps blocking findings open and routes status interpretation to the next tranche.
- `authority_boundary_rows`: keeps runtime, write, protected action, deployment, production PASS, enterprise PASS, reviewer mutation, finding resolution, clean checkpoint, and final approval false.
- `negative_fixture_contract_rows`: records the blocking fixtures that would invalidate the capture.
- `validation_command_rows`: declares the diff-first commands required for this tranche.
- `p68800_closeout_rows`: closes only the capture contract.
- `p68801_handoff_rows`: hands off to focused verification capture normalization.

## Schema Script Doc Test Scope

- `schemas/post-p64000-focused-hrm-verification-capture.schema.json`
- `src/post-p64000-focused-hrm-verification-capture.mjs`
- `scripts/post-p64000-focused-hrm-verification-capture.mjs`
- `test/post-p64000-focused-hrm-verification-capture.test.mjs`
- `docs/hermes-roadmap-p68401-p68800.md`
- `docs/architecture.md`
- `package.json`

## Negative Fixtures

- missing P68400 source
- P68400 not ready for handoff
- missing focused verification packet
- missing verification packet row
- candidate digest mismatch
- missing candidate artifact
- candidate validation invalid
- focused evidence claims fixed
- focused evidence claims verified
- finding auto-resolved
- missing per-HRM evidence row
- missing future normalization handoff
- raw Claude failure counted as evidence
- reviewer mutation claim
- source mutation claim
- patch apply claim
- write action claim
- clean checkpoint claim
- protected closeout claim
- production PASS claim
- enterprise PASS claim
- Codex final approval claim
- Claude final approval claim
- final automated approval claim

## Validation Commands

```bash
node --check src/post-p64000-focused-hrm-verification-capture.mjs
node --check scripts/post-p64000-focused-hrm-verification-capture.mjs
node --test test/post-p64000-focused-hrm-verification-capture.test.mjs
npm run platform:post-p64000-focused-hrm-verification-capture -- --check
node --test test/post-p64000-focused-hrm-remediation-plan.test.mjs test/post-p64000-focused-hrm-verification-capture.test.mjs
npm run platform:review-authority-contract -- --check
npm run platform:review-process-upgrade -- --check
node -e 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8")); JSON.parse(require("node:fs").readFileSync("schemas/post-p64000-focused-hrm-verification-capture.schema.json", "utf8"));'
git diff --check
```

## Authority Boundary

P68401-P68800 is focused source evidence capture only. It does not perform Claude review completion, runtime execution, command execution, write action, connector write, protected action, deployment, finding resolution, patch apply, reviewer mutation, source mutation, clean checkpoint, protected closeout, production PASS, enterprise PASS, Codex final approval, Claude final approval, or final automated approval.

## Closeout Criteria

- P68400 focused plan is valid and ready for P68401.
- Focused packet markdown is present.
- HRM-04, HRM-03, and HRM-01 evidence capture rows exist.
- Candidate artifact digests match P68400.
- Findings remain open and unresolved.
- Completed review event, fixed claim, verified claim, clean checkpoint, protected closeout, production PASS, enterprise PASS, and final approval all remain false.
- Targeted validation passes.

## Next-Phase Handoff

P68801-P69200 should normalize the focused capture envelope into finding status recommendations. It must not auto-resolve HRM-04, HRM-03, or HRM-01, and it must not claim clean checkpoint, protected closeout, production PASS, enterprise PASS, or final approval.
