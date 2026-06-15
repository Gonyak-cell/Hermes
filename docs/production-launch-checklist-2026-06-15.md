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
- [ ] Owner approves this commit as the new RC baseline.
- [ ] Confirm whether this branch should be merged to `main` before tag creation.
- [ ] Confirm `git rev-parse HEAD` equals the intended tag target immediately before creating a tag.

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
- [ ] Optional final single-command envelope before tag push: `npm run platform:release-check -- --check` was attempted and interrupted after long-running `project:zendd-active-operator-dashboard --check`; not counted as pass.

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
- [ ] Decide whether to add real app packaging tooling later; current packaging boundary intentionally keeps auto-update and publish closed.

### Review

- [x] Prior Claude review receipt exists for the desktop branch and recorded `PASS_WITH_FINDINGS`.
- [x] Prior findings were remediated in commit `1d98ee0d0744cd419d9762bb98f4aad90a24d362`.
- [x] Fresh Claude final review receipt captured under `artifacts/hermes-desktop-claude-review/final-1d98ee0d/`.
- [x] Fresh Claude final review result: `PASS_WITH_FINDINGS`, `6/6` prior findings fixed, `0` blocking findings, `2` P4 hardening notes.
- [x] P4 closure commit recorded: `8200ed3b754b74900a95fe5a48875a1daf707335`.
- [x] P4 closure Claude review receipt captured under `artifacts/hermes-desktop-claude-review/final-8200ed3b/`.
- [x] P4 closure Claude review result: `PASS_WITH_FINDINGS`, `8/8` prior/P4 findings fixed, `0` blocking findings, `1` P3 document-pointer drift finding resolved by this packet refresh.
- [ ] Owner reviews the fresh Claude result.
- [ ] Owner records RC re-freeze decision if acceptable.

### Human Authority

- [ ] Owner explicitly approves or rejects RC re-freeze.
- [ ] Owner explicitly approves or rejects production launch.
- [ ] Owner records that production approval is separate from provenance approval.
- [ ] Owner records that production approval is separate from enterprise trust.
- [ ] Owner records that single-owner local RC is lower-trust and not independently approved.
- [ ] Owner approves tag creation.
- [ ] Owner approves tag push if any tag is to leave local machine.

### Deployment Target

- [ ] Choose target: local-only, staging, production.
- [ ] Choose provider: local desktop package, Vercel, Netlify, Cloudflare, AWS, private host, or other.
- [ ] Confirm build command.
- [ ] Confirm start command if serverful.
- [ ] Confirm Node version.
- [ ] Confirm artifact retention.
- [ ] Confirm preview/staging URL if applicable.
- [ ] Confirm production domain and DNS owner if applicable.

### Environment And Secrets

- [ ] Inventory required environment variables.
- [ ] Confirm no secrets are committed.
- [ ] Add secrets through provider secret manager only.
- [ ] Confirm least-privilege tokens.
- [ ] Confirm secret rotation owner.
- [ ] Confirm no `artifacts/` ignored evidence contains raw secret payloads.
- [ ] Confirm `secret_read_allowed_now` remains false until explicitly changed by authority receipt.

### Data / Migration

- [ ] Confirm whether this release has database migrations.
- [ ] If migrations exist, run staging migration rehearsal.
- [ ] Confirm rollback or forward-fix path.
- [ ] Confirm backup snapshot before production migration.
- [ ] Record migration owner.

For the current desktop RC candidate, no production data migration is approved by this checklist.

### Observability

- [ ] Select logging target.
- [ ] Select error tracking target.
- [ ] Select uptime/health check if serverful.
- [ ] Define launch watch window.
- [ ] Define error-rate threshold.
- [ ] Define rollback trigger.
- [ ] Assign incident owner.

### Rollback

- [ ] Record previous known-good commit/tag.
- [ ] Record candidate commit/tag.
- [ ] Record rollback command for the chosen provider or local package.
- [ ] Record rollback validation command.
- [ ] Record communication path if rollback happens.
- [ ] Confirm rollback does not require Codex to self-authorize protected actions.

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

- [ ] Attach validation summary.
- [x] Attach Claude final review receipt.
- [ ] Attach owner RC re-freeze decision.
- [ ] Attach GitHub independent approval URL only if independent approval is reopened.
- [ ] Attach signed provenance record if tag or release publication is requested.

### 3. Tag Preparation

Use the tag draft in `docs/release-note-tag-draft-2026-06-15.md`.

Local RC tag created locally:

```bash
git tag -a v0.1.0-rc.20260615.8200ed3 8200ed3b754b74900a95fe5a48875a1daf707335 -m "Hermes v0.1.0 desktop RC - 2026-06-15"
```

Do not push the tag until owner tag push approval is recorded. Local tag creation is not production launch approval.

### 4. Staging Deployment Or Desktop Package Rehearsal

- [ ] Build package or deploy staging candidate.
- [ ] Run smoke tests.
- [ ] Verify logs and monitoring.
- [ ] Verify rollback path.
- [ ] Record staging/package evidence.

### 5. Production Deployment

Allowed only after owner production launch approval.

- [ ] Deploy production or publish package.
- [ ] Verify health endpoint or local launch equivalent.
- [ ] Verify core read-only operator flow.
- [ ] Verify no protected action controls are exposed as live authority.
- [ ] Watch metrics for the agreed launch window.
- [ ] Record production deployment receipt.

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
