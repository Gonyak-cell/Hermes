# Hermes Production Launch Checklist - 2026-06-15

이 체크리스트는 Hermes desktop candidate commit `8200ed3b754b74900a95fe5a48875a1daf707335`를 release-candidate re-freeze 이후 staging 또는 production launch까지 가져갈 때 사용할 실행 전 점검표다. 현재 자동화 증거는 desktop RC 후보를 준비할 수 있음을 보여주지만, production deployment authority는 아직 열려 있지 않다.

## Launch Class

| Class | Meaning | Current recommendation |
|---|---|---|
| Local desktop RC | local evidence baseline, no public launch | yes |
| Staging rehearsal | controlled deploy or package rehearsal | possible after owner opens staging authority |
| Production launch | public/real user release | not approved |
| Enterprise trust release | independent enterprise-grade trust claim | not allowed |

## Pre-Launch Preconditions

### Source And Version

- [x] Candidate commit selected: `8200ed3b754b74900a95fe5a48875a1daf707335`.
- [x] Current branch checked: `codex/hermes-desktop-shell`.
- [x] Worktree clean before document packet creation.
- [x] Package version recorded: `hermes-project-ops-harness@0.1.0`.
- [x] Desktop package version recorded: `@hermes/operator-desktop@0.1.0`.
- [x] Owner selected local-only RC handling for this candidate.
- [x] Local RC tag target verified as `8200ed3b754b74900a95fe5a48875a1daf707335`.
- [x] No merge to `main` is required for local-only tag evidence.

### Local Validation

- [x] `git diff --check` passed.
- [x] `npm audit --prefix apps/desktop` passed with `found 0 vulnerabilities`.
- [x] `npm run desktop:local-preflight` passed.
- [x] `npm run validate:core` passed.
- [x] `npm run release:candidate -- --check` passed.
- [x] `npm run release:freeze -- --check` passed.
- [x] `npm run platform:release-readiness-control-plane -- --check` passed with deployment allowed false.
- [x] `npm run platform:release-bundle-provenance -- --check` passed.
- [x] `npm run platform:launch-non-human-readiness -- --check` passed.
- [x] `node --test test/desktop-read-model.test.mjs` completed with `7 pass / 0 fail`.
- [x] `npm run test:desktop` completed with `19 pass / 0 fail`.
- [x] Full `npm test` rerun after P4-only hardening completed 2026-06-15 12:01 KST with `2670 pass / 0 fail` and `duration_ms 3721539.720667`.
- [x] Optional final single-command envelope before tag push is not required for local-only closeout; prior `npm run platform:release-check -- --check` attempt remains interrupted and is not counted as pass.

### Desktop-Specific Readiness

- [x] Desktop packaging manifest validates local build readiness while packaging authority stays closed.
- [x] Desktop read model validates 6/6 sections and 20/20 sources.
- [x] Desktop authority boundary validates 14/14 forbidden capabilities closed.
- [x] Electron renderer tests pass.
- [x] Vite build passes.
- [x] Smoke render passes for overview screen.
- [x] Smoke render passes for factory screen.
- [x] Smoke render passes for source preview screen.
- [x] Smoke render forbidden trust copy guard passes.
- [x] Real app packaging tooling is deferred; current local-only closeout keeps auto-update and publish closed.

### Review

- [x] Prior Claude review receipt exists for the desktop branch and recorded `PASS_WITH_FINDINGS`.
- [x] Prior findings were remediated in commit `1d98ee0d0744cd419d9762bb98f4aad90a24d362`.
- [x] Fresh Claude final review receipt captured under `artifacts/hermes-desktop-claude-review/final-1d98ee0d/`.
- [x] Fresh Claude final review result: `PASS_WITH_FINDINGS`, `6/6` prior findings fixed, `0` blocking findings, `2` P4 hardening notes.
- [x] P4 closure commit recorded: `8200ed3b754b74900a95fe5a48875a1daf707335`.
- [x] P4 closure Claude review receipt captured under `artifacts/hermes-desktop-claude-review/final-8200ed3b/`.
- [x] P4 closure Claude review result: `PASS_WITH_FINDINGS`, `8/8` prior/P4 findings fixed, `0` blocking findings, `1` P3 document-pointer drift finding resolved by this packet refresh.
- [x] Owner selected local-only closeout after the fresh Claude result.
- [x] Owner records RC re-freeze decision for local-only evidence.

### Human Authority

- [x] Owner explicitly selected local-only RC re-freeze.
- [x] Owner selected no production launch for this closeout.
- [x] Production approval remains separate from provenance approval.
- [x] Production approval remains separate from enterprise trust.
- [x] Single-owner local RC remains lower-trust and not independently approved.
- [x] Local RC tag creation is complete.
- [x] Tag push is not approved because this closeout is local-only.

### Deployment Target

- [x] Choose target: local-only.
- [x] Choose provider: local git tag and local evidence packet only.
- [x] Build command already validated through local desktop preflight; no publish command selected.
- [x] Start command is not applicable for local-only closeout.
- [x] Node version is governed by the local Hermes toolchain used for validation.
- [x] Artifact retention remains local repository evidence plus ignored render/test artifacts.
- [x] Preview/staging URL is not applicable.
- [x] Production domain and DNS owner are not applicable.

### Environment And Secrets

- [x] No production environment variables are required for local-only closeout.
- [x] Secret handling remains closed; no provider secret manager is opened.
- [x] Least-privilege token review is not applicable without tag push or deployment.
- [x] Secret rotation owner is not applicable without staging or production.
- [x] No raw secret payload handling is approved by this checklist.
- [x] `secret_read_allowed_now` remains false until explicitly changed by authority receipt.

### Data / Migration

- [x] No database migration is approved or required for local-only closeout.
- [x] Staging migration rehearsal is not applicable.
- [x] Rollback path is local evidence only: keep or delete the local RC tag with explicit owner approval.
- [x] Backup snapshot is not applicable without production migration.
- [x] Migration owner is not applicable.

For the current desktop RC candidate, no production data migration is approved by this checklist.

### Observability

- [x] Logging target is not applicable without staging or production runtime.
- [x] Error tracking target is not applicable without staging or production runtime.
- [x] Uptime/health check is not applicable without serverful deployment.
- [x] Launch watch window is not applicable.
- [x] Error-rate threshold is not applicable.
- [x] Rollback trigger is local-only tag/evidence rejection.
- [x] Incident owner is not applicable without launch.

### Rollback

- [x] Previous known-good tag recorded: `v0.1.0-rc.20260614.5e332b1`.
- [x] Candidate commit/tag recorded: `8200ed3b...` and `v0.1.0-rc.20260615.8200ed3`.
- [x] Local rollback command recorded in `docs/release-note-tag-draft-2026-06-15.md`.
- [x] Rollback validation command remains local evidence recheck, not deployment validation.
- [x] Communication path is local owner decision in this repository.
- [x] Rollback does not require Codex to self-authorize protected actions.

## Launch Procedure

### 1. Final Evidence Refresh

```bash
git status --short --branch
git rev-parse HEAD
git diff --check
npm audit --prefix apps/desktop
npm run desktop:local-preflight
npm run validate:core
npm run release:candidate -- --check
npm run release:freeze -- --check
npm run platform:release-readiness-control-plane -- --check
npm run platform:release-bundle-provenance -- --check
npm run platform:launch-non-human-readiness -- --check
npm test
```

Optional final umbrella receipt:

```bash
npm run platform:release-check -- --check
```

The optional umbrella command was attempted after `8200ed3b...` and interrupted after a long-running `project:zendd-active-operator-dashboard --check` substep. Do not count it as a pass unless rerun to completion.

### 2. Review Capture

- [x] Attach validation summary.
- [x] Attach Claude final review receipt.
- [x] Attach owner local-only RC re-freeze decision.
- [x] GitHub independent approval URL is not applicable because independent approval is not pursued for this local-only RC.
- [x] Signed provenance record is not required because tag push and release publication are not requested.

### 3. Tag Preparation

Use the tag draft in `docs/release-note-tag-draft-2026-06-15.md`.

Local RC tag created locally:

```bash
git tag -a v0.1.0-rc.20260615.8200ed3 8200ed3b754b74900a95fe5a48875a1daf707335 -m "Hermes v0.1.0 desktop RC - 2026-06-15"
```

Do not push the tag until owner tag push approval is recorded. Local tag creation is not production launch approval.

### 4. Staging Deployment Or Desktop Package Rehearsal

- [x] Skipped by local-only decision.
- [x] Existing local smoke tests remain the evidence baseline.
- [x] Logs and monitoring are not applicable without runtime deployment.
- [x] Local tag rollback path is documented.
- [x] No staging/package evidence is created for this closeout.

### 5. Production Deployment

Allowed only after owner production launch approval. The current owner decision
is local-only, so production remains closed.

- [x] Skipped by local-only decision; no production deploy or package publish.
- [x] Health endpoint or launch-equivalent verification is not applicable without deployment.
- [x] Core read-only operator flow was verified by local desktop preflight and smoke checks.
- [x] Protected action controls remain blocked by local authority and smoke evidence.
- [x] Metrics watch is not applicable without launch.
- [x] Production deployment receipt is not created because production remains closed.

## Rollback Triggers

Rollback or hold launch if any are true:

- CI fails on the final candidate.
- `npm test` fails.
- Any production governance check flips `deployment_allowed_now` unexpectedly.
- Any authority flag claims production PASS or enterprise PASS without explicit receipt.
- Desktop smoke test fails.
- Secrets or raw protected payloads are exposed.
- Owner production decision is missing or ambiguous.

## Explicit Non-Approvals

This checklist does not approve:

- production launch;
- production PASS;
- enterprise PASS;
- enterprise trust claim;
- GitHub independent approval;
- human-gate bypass;
- protected closeout;
- deployment authority;
- tag push;
- GitHub Release publication.
