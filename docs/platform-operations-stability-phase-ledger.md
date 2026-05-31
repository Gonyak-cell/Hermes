# Hermes Platform Operations Stability Phase Ledger (P341-P500)

Status date: 2026-05-31

This ledger starts after the Hermes v1.0 freeze and the Trading Pack P340 verified
baseline. Its purpose is not to add risky runtime behavior. It turns the harness
into a more reproducible, observable, recoverable, and operator-safe platform.

## Current Boundary

- Platform v1.0 source baseline: Phase 312.
- Trading pack completion baseline: Phase 340.
- Verified P340 transfer bundle SHA256: `1a1563a47e2f6704e0f25be56a4c74069863e97c6312e0b0348088ccd231051d`.
- Verified P340 history baseline commit: `0abc97b`.
- Mac replay stabilization commit: `8e4323d`.
- Hermes Desktop posture: optional read-only operator companion, not source of truth.
- Trading posture: research, backtest, and paper are active; shadow-live, limited-live, full-auto, live order submission, broker writes, and automatic order submission stay disabled by default.

## Phase Ranges

| Range | Scope | Current status | Stability note |
| --- | --- | --- | --- |
| P341-P360 | Reproducibility baseline | complete | Pin Node/npm policy, lockfile policy, P340 provenance, deterministic runtime baseline artifact, and `platform:runtime-baseline`. |
| P361-P380 | Unified platform and trading checks | active | Add `trading:release-check`, `platform:ops-check`, and `platform:release-check` so operators do not rely on remembered command order. |
| P381-P400 | Trading safety regression | planned | Fail immediately if live, full-auto, automatic order submission, broker credential, generic order, or mutating trading routes become enabled. |
| P401-P420 | Promotion receipt gates | planned | Require independent human approval receipts for research -> backtest -> paper -> shadow -> limited-live -> full-auto promotion claims. |
| P421-P440 | Execution and secret isolation | planned | Keep simulated and live broker adapters schema/API separated; live credentials are external secret handles only. |
| P441-P460 | Recovery drills | planned | Cover stale data, exchange outage, failed fill, partial fill, duplicate order intent, kill switch, and rollback-to-paper as dry-run receipt drafts. |
| P461-P480 | Operator observability | planned | Show why live/future mutation is blocked: risk halt, missing approval, disabled route, rollback target, and Desktop read-only boundary. |
| P481-P500 | Platform operations freeze | planned | Freeze the operations layer with unified checks, reproducibility evidence, recovery proof, and safety boundary invariants. |

## P341-P360 Acceptance Criteria

- P341: `platform:runtime-baseline` validates `.nvmrc`, `.node-version`, `.npmrc`, `packageManager`, `engines`, `package-lock.json`, this ledger, and the P340 bundle hash without installing dependencies, creating releases, or enabling trading mutation.
- P342: `platform:drift-check` compares the current local runtime/dependency/provenance state to the P341 baseline in memory and validates source fingerprints without overwriting artifacts in `--check`.
- P343: `platform:replay-window` consumes the P342 drift check in memory and maps current-checkout, contract/release, validation/test, artifact-regeneration, cross-OS history, and Trading safety replay windows without executing commands.
- P344: `platform:operator-handoff` turns P343 replay windows into human-reviewable handoff packets with evidence rows, decision rows, owner roles, and next operator actions without executing commands.
- P345: `platform:artifact-guard` closes the runtime/dependency drift-report sequence by proving P341-P345 generated outputs stay under ignored `artifacts/`, platform commands are registered in validation, and `--check` remains no-overwrite.
- P346: `platform:provenance-ledger` records the P340 bundle hash, P340 history baseline commit, Mac replay stabilization commit, release-bundle hash policy, and future signed-tag requirements without creating tags or releases.
- P347: `platform:release-bundle-provenance` expands release-bundle hash and manifest requirements without creating release bundles, tags, signed tags, or releases.
- P348: `platform:signed-tag-provenance` expands future signed-tag policy and gates without running git, materializing signing keys, creating tags, creating signed tags, or publishing releases.
- P349: `platform:provenance-freeze-preflight` maps P341-P349 provenance freeze sources and gates before final freeze without executing checks, creating tags, creating signed tags, creating release bundles, or publishing releases.
- P350: `platform:provenance-freeze` provides final provenance freeze closeout for P346-P350 rows and gates without creating tags, signed tags, release bundles, releases, or protected actions.
- P351: `platform:mac-windows-replay-notes` documents Mac/Windows replay notes for operator handoff without importing history, changing checkout state, regenerating artifacts, or mutating lockfiles.
- P352: `platform:lockfile-policy` records package manager, npmrc, and package-lock policy without dependency installs, package mutation, lockfile mutation, or artifact regeneration.
- P353: `platform:replay-handoff-map` maps replay scopes to owner roles, expected evidence, and next operator actions without executing commands or protected actions.
- P354: `platform:replay-evidence-checklist` records replay evidence expectations without collecting evidence, executing commands, regenerating artifacts, or performing protected actions.
- P355: `platform:replay-handoff-closeout` closes P351-P355 replay handoff readiness without executing replay actions, regenerating artifacts, collecting evidence, or performing protected actions.
- P356: `platform:reproducibility-check-registry` registers P341-P356 reproducibility checks in package scripts and validation, while bridging to future release-check commands without executing checks or requiring future scripts now.
- P357: `platform:reproducibility-evidence-matrix` records grouped reproducibility evidence expectations without collecting evidence, executing checks, or executing future release-check commands.
- P358: `platform:reproducibility-proof-index` maps reproducibility evidence rows to expected proof references without materializing proof, reading artifacts, collecting evidence, or executing checks.
- P359: `platform:reproducibility-operator-review` turns proof rows into human-reviewable operator review rows without completing review, applying approvals, reading artifacts, or executing protected actions.
- P360: `platform:reproducibility-closeout` closes P341-P360 reproducibility readiness and records P361-P380 as the next unified platform and trading check block without executing checks, applying approvals, or protected actions.

## P361-P380 Acceptance Criteria

- P361: `trading:release-check` executes the contract validation, release freeze, and complete Trading Pack check stack in `--check` mode while keeping live trading, full-auto, order submission, broker writes, exchange writes, release publication, git operations, and protected actions disabled.
- P362: `platform:ops-check` verifies runtime baseline, contract validation, control-plane loop runner readiness, dashboard/API smoke readiness, and domain-pack registry health without rebuilding dashboard artifacts, running package commands, or mutating release/trading state.
- P363: `platform:release-check` composes `platform:ops-check -- --check`, `trading:release-check -- --check`, `npm run validate`, `npm test`, `contracts:validate -- --check`, and `release:freeze -- --check` without registering itself in `npm run validate` or executing release/trading mutations.
- P364: `platform:release-check-no-write-audit` verifies the P361-P363 release-check bridge commands have `--check` write guards and no-overwrite tests without executing those commands or mutating artifacts.
- P365: `platform:release-check-evidence-index` maps P361-P364 release-check commands to docs, expected report paths, validation-chain policy, and human-review evidence without executing commands or mutating artifacts.
- P366: `platform:release-check-review-packet` turns P365 evidence rows into human-reviewable release-check review packets with reviewer roles and expected decisions without completing review, applying approvals, executing commands, reading/writing artifacts, or mutating release/trading state.
- P367: `platform:release-check-signoff-ledger` records required human signoff receipts for P366 review rows without completing signoff, applying approvals, materializing receipts, executing commands, reading/writing artifacts, or mutating release/trading state.
- P368: `platform:release-check-signoff-receipt-template` creates human-fillable signoff receipt templates from P367 rows without completing receipts, applying approvals, materializing receipts, executing commands, reading/writing artifacts, or mutating release/trading state.
- P369: `platform:release-check-signoff-receipt-intake` queues P368 receipt templates for external human input without receiving receipts, validating receipts, completing signoff, applying approvals, executing commands, reading/writing artifacts, or mutating release/trading state.
- P370: `platform:release-check-signoff-closeout` closes the P365-P370 signoff-readiness subchain as ready for external human receipt collection without receiving receipts, validating receipts, completing signoff, applying approvals, executing commands, reading/writing artifacts, or mutating release/trading state.
- P371: `platform:release-check-status-ledger` summarizes the P361-P370 release-check command, evidence, review, signoff, receipt, and closeout status in a read-only operator ledger while keeping human receipts pending and without receiving receipts, validating receipts, applying approvals, executing commands, reading/writing artifacts, or mutating release/trading state.
- P372: `platform:release-check-receipt-queue` turns the P371 status ledger into a deterministic external human receipt collection queue without receiving receipts, validating receipts, completing signoff, applying approvals, executing commands, reading/writing artifacts, or mutating release/trading state.
- P373: `platform:release-check-receipt-validation-rules` declares deterministic future validation rules for queued release-check receipts without receiving receipt payloads, validating receipts, completing signoff, applying approvals, executing commands, reading/writing artifacts, or mutating release/trading state.
- P374: `platform:release-check-receipt-workspace` declares reviewer receipt workspace rows and editable receipt fields without materializing receipt input files, receiving payloads, validating receipts, completing signoff, applying approvals, executing commands, reading/writing artifacts, or mutating release/trading state.
- P375: `platform:release-check-receipt-workspace-merge` declares future merge rows for release-check receipt workspaces without reading actor workspace files, materializing merged receipt input, receiving payloads, validating receipts, completing signoff, applying approvals, executing commands, reading/writing artifacts, or mutating release/trading state.
- P376: `platform:release-check-receipt-merge-preflight` declares future merge-validation preflight rows for release-check receipts without reading actor workspace files, materializing merged receipt input, receiving payloads, validating receipts, completing signoff, applying approvals, executing commands, reading/writing artifacts, or mutating release/trading state.
- P377: `platform:release-check-receipt-validation-packet` declares future validation packet rows for release-check receipts without reading actor workspace files, materializing merged receipt input, receiving payloads, validating receipts, completing signoff, applying approvals, executing commands, reading/writing artifacts, or mutating release/trading state.
- P378: `platform:release-check-receipt-approval-plan` declares future approval-plan rows for release-check receipts without reading actor workspace files, materializing merged receipt input, receiving payloads, validating receipts, completing signoff, applying approvals, executing commands, reading/writing artifacts, or mutating release/trading state.
- P379: `platform:release-check-receipt-approval-closeout` closes the future approval-plan readiness layer for release-check receipts without reading actor workspace files, materializing merged receipt input, receiving payloads, validating receipts, completing signoff, applying approvals, executing commands, reading/writing artifacts, or mutating release/trading state.
- `trading:release-check` runs the complete Trading Pack validation stack, contract validation, release freeze, and trading no-write checks in one command.
- `platform:ops-check` verifies runtime baseline, contracts, control-plane loop, dashboard/API smoke readiness, and domain-pack registry health.
- `platform:release-check` composes `platform:ops-check`, `trading:release-check`, `npm run validate`, `npm test`, `contracts:validate -- --check`, and `release:freeze -- --check`.
- Every command supports `--check` without overwriting existing artifacts on failure.

## P381-P400 Acceptance Criteria

- Regression fixtures fail when `limited_live_enabled`, `full_auto_enabled`, `automatic_order_submission_allowed`, or `live_order_submission_allowed` is true.
- Route inventory fixtures fail when mutating trading routes, broker credential routes, live broker write routes, or generic order submission routes are present.
- Safety checks cover disabled routes, approval absence, live adapter disabled state, credential lookup disabled state, no broker writes, and no exchange writes.

## P401-P420 Acceptance Criteria

- Each promotion stage has an independent approval receipt contract and summary row.
- A higher stage cannot be marked complete for enablement without its required receipt.
- Governance reports may be complete while real enablement remains false.
- Full-auto governance remains complete only as a blocked/default-disabled control-plane state.

## P421-P440 Acceptance Criteria

- Simulated broker adapter and live broker adapter contracts are separate.
- Live adapter files, if present in the future, are not imported by default control-plane paths.
- Live credentials use external secret handles only; plaintext, environment dumps, and provider keys are forbidden in repo artifacts.
- Secret boundary checks include Trading and Desktop companion configuration fixtures.

## P441-P460 Acceptance Criteria

- Recovery drills include stale data, exchange outage, failed fill, partial fill, duplicate order intent, kill switch, rollback-to-paper, and rollback-to-paper-after-live-halt fixtures.
- Recovery commands remain draft receipts and do not execute broker calls, shell commands, file restores, or protected actions.
- Recovery artifacts are visible to operator surfaces and remain human-review gated.

## P461-P480 Acceptance Criteria

- Dashboard/API surfaces explain why live/future mutation is blocked.
- Operator rows expose risk block/halt reason, disabled route, missing approval, rollback target, current stage, and next allowed action.
- Hermes Desktop remains a companion/operator surface and never becomes runtime source of truth.

## P481-P500 Acceptance Criteria

- Platform operations freeze proves every P341-P480 source is complete or explicitly blocked by a documented human gate.
- `platform:release-check -- --check`, `trading:release-check -- --check`, `npm run validate`, `npm test`, `contracts:validate -- --check`, `release:freeze -- --check`, and `control-plane:loop` pass.
- Trading live/full-auto/order submission, Desktop mutation/source-of-truth, protected recovery execution, and secret exposure remain false.

## Non-Goal

This program does not turn Hermes into a broker, deployment system, Desktop source
of truth, or autonomous mutation engine. It strengthens the platform's ability to
prove what is safe, blocked, reproducible, observable, and recoverable.
