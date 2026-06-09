# Hermes Roadmap P66001-P66400

P66001-P66400은 Claude review finding HRM-03을 remediation하는 tranche다. HRM-03의 핵심은 마지막 durable Claude Code Opus max review 이후 `113` commits와 많은 phase/file 변경이 한 번에 review packet으로 묶여 clean checkpoint 신뢰도를 떨어뜨렸다는 점이다. 이 tranche는 큰 review window를 숨기지 않고, commit-count cap, phase-range cap, scope-split guard, risk-prioritized redispatch next action으로 구조화한다.

## Phase Objective

- P64400 baseline의 post-review commit/file scope를 source로 묶는다.
- inter-Claude-review window cap을 `<= 25 commits`와 `<= 1 roadmap phase file`로 고정한다.
- 현재 window가 cap을 넘으면 clean candidate가 아니라 scope split required로 표시한다.
- HRM-03을 remediated candidate로 기록하되 clean checkpoint, protected closeout, production PASS, enterprise PASS는 열지 않는다.

## Source Binding

- `artifacts/post-p64000-hrm04-review-event-boundary/latest/post-p64000-hrm04-review-event-boundary.json`
- `artifacts/post-p64000-claude-review/latest/post-p64000-claude-review-baseline.json`
- `artifacts/post-p64000-claude-review-execution/latest/post-p64000-claude-review-execution.json`
- `artifacts/post-p64000-claude-review-normalization/latest/normalized-claude-review-receipt.json`
- `artifacts/post-p64000-claude-review-handoff-freeze/latest/post-p64000-claude-review-handoff-freeze.json`

## Output Rows

- `p66000_hrm04_source_rows`
- `review_window_observation_rows`
- `review_window_cap_policy_rows`
- `scope_split_guard_rows`
- `hrm03_remediation_rows`
- `authority_boundary_rows`
- `negative_fixture_contract_rows`
- `validation_command_rows`
- `p66400_wiring_rows`
- `p66400_closeout_rows`
- `p66401_handoff_rows`

## Schema, Script, Doc, Test Scope

- `schemas/post-p64000-hrm03-review-window-cap.schema.json`
- `src/post-p64000-hrm03-review-window-cap.mjs`
- `scripts/post-p64000-hrm03-review-window-cap.mjs`
- `test/post-p64000-hrm03-review-window-cap.test.mjs`
- `docs/hermes-roadmap-p66001-p66400.md`
- `docs/architecture.md`
- `package.json`

## Negative Fixtures

- missing P64400 baseline
- missing post-review commit count
- commit count over cap treated as clean
- phase range over cap treated as clean
- missing scope split action
- missing reviewer window cap policy
- final approval claim
- production PASS claim
- enterprise PASS claim
- source mutation claim
- HRM-03 auto-resolved claim
- review dispatch without window gate

## Validation Commands

```bash
node --check src/post-p64000-hrm03-review-window-cap.mjs
node --check scripts/post-p64000-hrm03-review-window-cap.mjs
node --test test/post-p64000-hrm03-review-window-cap.test.mjs
npm run platform:post-p64000-hrm03-review-window-cap -- --check
node --test test/post-p64000-hrm04-review-event-boundary.test.mjs test/post-p64000-hrm03-review-window-cap.test.mjs
npm run platform:review-authority-contract -- --check
npm run platform:review-process-upgrade -- --check
node -e 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8")); JSON.parse(require("node:fs").readFileSync("schemas/post-p64000-hrm03-review-window-cap.schema.json", "utf8"));'
git diff --check
```

## Authority Boundary

P66400은 HRM-03 window-cap remediation candidate다. 다음은 모두 false다.

- review window over cap clean allowed
- scope split bypass
- review packet dispatch without window gate
- HRM-03 auto-resolution
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

- P66000 HRM-04 boundary, P64400 baseline, P64800 execution, P65200 normalized receipt, and P65600 handoff freeze are valid.
- Review window observation records the current `113`-commit window and changed-file scope.
- Cap policy requires `<= 25 commits` and `<= 1 roadmap phase file`.
- Current over-cap window produces `scope_split_required=true`.
- Clean candidate is blocked while the window is over cap.
- HRM-03 is recorded as `remediated_candidate_pending_future_review`.
- Clean checkpoint, protected closeout, production PASS, enterprise PASS, final approval remain false.

## Next-Phase Handoff

P66401-P66800 should remediate HRM-01 by adding review depth cap, one-level review recursion boundary, and clean-candidate review packet guard. P66400 itself must not claim HRM-03 is finally approved; it only supplies deterministic window cap and scope split evidence for future review.
