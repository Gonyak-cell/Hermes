# Hermes Roadmap P69201-P69600 Focused Claude Review Dispatch Metadata

## Phase Objective

P69201-P69600 consumes the P69200 focused verification normalization output and prepares focused Claude Code Opus max dispatch metadata for HRM-04, HRM-03, and HRM-01. It does not execute Claude, does not capture raw review output, does not count review evidence, and does not change finding status.

## Source Binding

- `artifacts/post-p64000-focused-hrm-verification-normalization/latest/post-p64000-focused-hrm-verification-normalization.json`
- `artifacts/post-p64000-focused-hrm-verification-normalization/latest/normalized-recommendation-packet.md`
- `artifacts/post-p64000-focused-hrm-verification-normalization/latest/finding-status-recommendation-rows.json`
- `artifacts/post-p64000-focused-hrm-verification-normalization/latest/future-review-packet-rows.json`
- `artifacts/post-p64000-focused-hrm-verification-normalization/latest/verification-pending-guard-rows.json`

## Output Rows

- `p69200_source_binding_rows`: verifies P69200 normalization readiness, recommendation packet, pending rows, future review rows, and guard rows.
- `dispatch_metadata_rows`: creates one dispatch metadata row each for HRM-04, HRM-03, and HRM-01.
- `review_scope_rows`: bounds each HRM review question and allowed future verdicts.
- `review_prompt_guard_rows`: requires JSON-only, no mutation, no patch apply, no final approval, no status resolution, and no clean checkpoint.
- `evidence_counting_guard_rows`: prevents dispatch, auth failure, timeout, malformed output, and tool-call-shaped output from being counted as review evidence.
- `authority_boundary_rows`: keeps runtime, write, protected action, deployment, production PASS, enterprise PASS, reviewer mutation, finding resolution, clean checkpoint, and final approval false.
- `negative_fixture_contract_rows`: records the blocking fixtures that would invalidate dispatch metadata.
- `validation_command_rows`: declares the diff-first commands required for this tranche.
- `p69600_closeout_rows`: closes only the dispatch metadata contract.
- `p69601_handoff_rows`: hands off to durable raw focused Claude review capture.

## Schema Script Doc Test Scope

- `schemas/post-p64000-focused-claude-review-dispatch-metadata.schema.json`
- `src/post-p64000-focused-claude-review-dispatch-metadata.mjs`
- `scripts/post-p64000-focused-claude-review-dispatch-metadata.mjs`
- `test/post-p64000-focused-claude-review-dispatch-metadata.test.mjs`
- `docs/hermes-roadmap-p69201-p69600.md`
- `docs/architecture.md`
- `package.json`

## Negative Fixtures

- missing P69200 source
- P69200 invalid or not ready
- missing recommendation packet
- missing future review row
- recommendation not pending
- dispatch performed claim
- raw review captured claim
- auth failure counted as evidence
- hang or timeout counted as evidence
- malformed output counted as evidence
- tool-call-shaped output counted as review
- review evidence counted before capture
- finding fixed claim
- finding verified claim
- finding resolved claim
- finding auto-resolved claim
- source mutation claim
- patch apply claim
- write action claim
- reviewer mutation claim
- clean checkpoint claim
- protected closeout claim
- production PASS claim
- enterprise PASS claim
- Codex final approval claim
- Claude final approval claim
- final automated approval claim

## Validation Commands

```bash
node --check src/post-p64000-focused-claude-review-dispatch-metadata.mjs
node --check scripts/post-p64000-focused-claude-review-dispatch-metadata.mjs
node --test test/post-p64000-focused-claude-review-dispatch-metadata.test.mjs
npm run platform:post-p64000-focused-claude-review-dispatch-metadata -- --check
node --test test/post-p64000-focused-hrm-verification-normalization.test.mjs test/post-p64000-focused-claude-review-dispatch-metadata.test.mjs
npm run platform:review-authority-contract -- --check
npm run platform:review-process-upgrade -- --check
node -e 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8")); JSON.parse(require("node:fs").readFileSync("schemas/post-p64000-focused-claude-review-dispatch-metadata.schema.json", "utf8"));'
git diff --check
```

## Authority Boundary

P69201-P69600 is dispatch metadata only. It does not perform Claude execution, runtime execution, command execution, write action, connector write, protected action, deployment, raw review capture, review evidence counting, finding resolution, patch apply, reviewer mutation, source mutation, clean checkpoint, protected closeout, production PASS, enterprise PASS, Codex final approval, Claude final approval, or final automated approval.

## Closeout Criteria

- P69200 focused verification normalization is valid and ready for P69201.
- HRM-04, HRM-03, and HRM-01 dispatch metadata rows exist.
- Reviewer lane, model alias, and effort are explicit.
- Dispatch performed, raw review captured, and evidence counted are false.
- Prompt and evidence counting guards are visible.
- Targeted validation passes.

## Next-Phase Handoff

P69601-P70000 may capture durable focused Claude review raw JSON. Auth failure, timeout, hang, malformed output, tool-call-shaped output, or dispatch metadata must not be counted as review evidence.
