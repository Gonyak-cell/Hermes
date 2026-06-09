# Hermes Roadmap P66401-P66800

P66401-P66800은 Claude review finding HRM-01을 remediation하는 tranche다. HRM-01의 핵심은 review-stage가 다시 review-stage를 낳으면서 `review`가 반복되는 파일명과 schema/script/src/test quartet이 증가했고, termination criterion 없이 false-PASS 표면이 커졌다는 점이다. 이 tranche는 현재 cascading chain을 숨기지 않고 review-depth cap, cascade detector, waiver/collapse guard, packaging check requirement로 구조화한다.

## Phase Objective

- repo file inventory에서 cascading review file path와 quartet을 read-only로 관측한다.
- review depth cap을 `max_review_depth <= 1`, `max_review_tokens_per_file_path_without_waiver <= 2`로 고정한다.
- `review-review-review` 이상 path는 clean candidate가 아니라 collapse 또는 explicit waiver receipt required로 표시한다.
- HRM-01을 remediated candidate로 기록하되 source collapse, clean checkpoint, protected closeout, production PASS, enterprise PASS는 열지 않는다.

## Source Binding

- `artifacts/post-p64000-hrm03-review-window-cap/latest/post-p64000-hrm03-review-window-cap.json`
- `artifacts/post-p64000-claude-review-normalization/latest/normalized-claude-review-receipt.json`
- `artifacts/post-p64000-claude-review-handoff-freeze/latest/post-p64000-claude-review-handoff-freeze.json`
- `git ls-files`
- `package.json`
- `docs/architecture.md`

## Output Rows

- `p66400_hrm03_source_rows`
- `review_depth_inventory_rows`
- `review_depth_cap_policy_rows`
- `cascading_review_guard_rows`
- `hrm01_remediation_rows`
- `authority_boundary_rows`
- `negative_fixture_contract_rows`
- `validation_command_rows`
- `p66800_wiring_rows`
- `p66800_closeout_rows`
- `p66801_handoff_rows`

## Schema, Script, Doc, Test Scope

- `schemas/post-p64000-hrm01-review-depth-cap.schema.json`
- `src/post-p64000-hrm01-review-depth-cap.mjs`
- `scripts/post-p64000-hrm01-review-depth-cap.mjs`
- `test/post-p64000-hrm01-review-depth-cap.test.mjs`
- `docs/hermes-roadmap-p66401-p66800.md`
- `docs/architecture.md`
- `package.json`

## Negative Fixtures

- missing P66400 HRM-03 source
- missing HRM-01 finding
- review depth over cap treated as clean
- missing review depth cap policy
- missing cascade detector
- review depth waiver without explicit receipt
- new cascading review file allowed without waiver
- HRM-01 auto-resolved claim
- source mutation claim
- source collapse claim
- final approval claim
- production PASS claim
- enterprise PASS claim
- reviewer mutation claim
- finding resolution claim

## Validation Commands

```bash
node --check src/post-p64000-hrm01-review-depth-cap.mjs
node --check scripts/post-p64000-hrm01-review-depth-cap.mjs
node --test test/post-p64000-hrm01-review-depth-cap.test.mjs
npm run platform:post-p64000-hrm01-review-depth-cap -- --check
node --test test/post-p64000-hrm03-review-window-cap.test.mjs test/post-p64000-hrm01-review-depth-cap.test.mjs
npm run platform:review-authority-contract -- --check
npm run platform:review-process-upgrade -- --check
node -e 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8")); JSON.parse(require("node:fs").readFileSync("schemas/post-p64000-hrm01-review-depth-cap.schema.json", "utf8"));'
git diff --check
```

## Authority Boundary

P66800은 HRM-01 review-depth remediation candidate다. 다음은 모두 false다.

- review depth over cap clean allowed
- review depth waiver without explicit receipt
- new cascading review file allowed without waiver
- HRM-01 auto-resolution
- review depth source collapse claim
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
- reviewer final closeout
- finding resolution
- finding auto-resolution
- patch apply
- source mutation from review
- protected closeout from review
- clean checkpoint claim

## Closeout Criteria

- P66400 HRM-03 source, normalized receipt, and P65600 handoff freeze are valid.
- HRM-01 is present as an open blocker before remediation.
- Repo file inventory detects current over-depth review chain and quartet pattern.
- Review depth cap policy blocks clean candidate when depth is over cap.
- Over-depth review chain requires collapse or explicit waiver receipt.
- This tranche does not claim source collapse, patch apply, finding resolution, clean checkpoint, protected closeout, production PASS, enterprise PASS, or final approval.

## Next-Phase Handoff

P66801-P67200 should revalidate HRM-04, HRM-03, and HRM-01 remediation candidates and prepare a clean-candidate review packet for Claude Code Opus max. P66800 itself must not claim HRM-01 is finally approved; it only supplies deterministic review-depth cap and cascading guard evidence for future review.
