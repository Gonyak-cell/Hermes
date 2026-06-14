# Hermes Production Launch Checklist - 2026-06-14

이 체크리스트는 Hermes candidate commit `5e332b1c6327b255cf9bf418bc455b7965172658`를 production launch까지 가져갈 때 사용할 실행 전 점검표다. 현재 자동화 증거는 production launch를 준비할 수 있음을 보여주지만, production deployment authority는 아직 열려 있지 않다.

## Launch Class

| Class | Meaning | Current recommendation |
|---|---|---|
| Internal RC | evidence baseline, no public launch | yes |
| Staging rehearsal | controlled deploy rehearsal | possible after owner opens staging authority |
| Production launch | public/real user release | not yet approved |
| Enterprise trust release | independent enterprise-grade trust claim | not allowed |

## Pre-Launch Preconditions

### Source And Version

- [ ] Confirm release candidate commit is still `5e332b1c6327b255cf9bf418bc455b7965172658`.
- [ ] Confirm `git status --short --branch` is clean.
- [ ] Confirm `git rev-parse HEAD` equals `git rev-parse github/main`.
- [ ] Confirm package version policy: current package version is `0.1.0`.
- [x] Confirm local RC tag name: `v0.1.0-rc.20260614.5e332b1`.
- [x] Create local annotated RC tag.
- [ ] Approve tag push before pushing any tag to GitHub.

### Local Validation

- [x] `npm test` completed with `2655 pass / 0 fail`.
- [x] `npm run validate:core` passed.
- [x] `git diff --check` passed.
- [x] `npm run release:candidate -- --check` passed.
- [x] `npm run release:freeze -- --check` passed.
- [x] `npm run deployment:runbook -- --check` passed.
- [x] `npm run platform:release-readiness-control-plane -- --check` passed.
- [x] `npm run platform:release-bundle-provenance -- --check` passed.
- [x] `npm run platform:production-governance-hardening -- --check` passed.
- [x] `npm run platform:p16800-platform-freeze -- --check` passed.
- [ ] Optional final single-command envelope: `npm run platform:release-check -- --check`.

Note: `platform:release-check -- --check` invokes expensive child commands including `npm test`. It should be run before an actual tag if the owner wants a single final envelope receipt.

### GitHub / CI

- [x] PR #2 merged into `main`.
- [x] Latest `main` push CI succeeded: `Hermes Verification Trust`, run `27494810403`.
- [x] Independent GitHub approval explicitly not pursued for this single-owner local RC.
- [ ] If independent / enterprise trust is later required, add an external collaborator or use a separate authorized approver account.
- [ ] Record the final approver identity and approval URL only if independent approval is reopened.

### Human Authority

- [x] Owner selects launch decision from `docs/release-decision-packet-2026-06-14.md`.
- [x] Owner release-candidate freeze decision recorded in `docs/release-owner-decision-2026-06-14.md`.
- [ ] Owner explicitly approves or rejects production launch.
- [ ] Owner records that production approval is separate from provenance approval.
- [ ] Owner records that production approval is separate from enterprise trust.
- [x] Owner records that `platform:release-check` final envelope is waived for now before tag publication.

### Deployment Target

- [ ] Choose target: local-only, staging, production.
- [ ] Choose provider: Vercel, Netlify, Cloudflare, AWS, private host, or other.
- [ ] Register project/app in provider.
- [ ] Confirm build command.
- [ ] Confirm start command if serverful.
- [ ] Confirm Node version.
- [ ] Confirm artifact retention.
- [ ] Confirm preview/staging URL.
- [ ] Confirm production domain and DNS owner.

### Environment And Secrets

- [ ] Inventory required environment variables.
- [ ] Confirm no secrets are committed.
- [ ] Add secrets through provider secret manager only.
- [ ] Confirm least-privilege tokens.
- [ ] Confirm secret rotation owner.
- [ ] Confirm no `artifacts/` ignored evidence contains raw secret payloads.
- [ ] Confirm `secret_read_allowed_now` remains false in Hermes governance until explicitly changed.

### Data / Migration

- [ ] Confirm whether this release has database migrations.
- [ ] If migrations exist, run staging migration rehearsal.
- [ ] Confirm rollback or forward-fix path.
- [ ] Confirm backup snapshot before production migration.
- [ ] Record migration owner.

For the current harness release, no production data migration is approved by this checklist.

### Observability

- [ ] Select logging target.
- [ ] Select error tracking target.
- [ ] Select uptime/health check.
- [ ] Define launch watch window.
- [ ] Define error-rate threshold.
- [ ] Define latency threshold if applicable.
- [ ] Define rollback trigger.
- [ ] Assign incident owner.

### Rollback

- [ ] Record previous known-good commit/tag.
- [ ] Record candidate commit/tag.
- [ ] Record rollback command for the chosen provider.
- [ ] Record rollback validation command.
- [ ] Record communication path if rollback happens.
- [ ] Confirm rollback does not require Codex to self-authorize protected actions.

## Launch Procedure

### 1. Final Evidence Refresh

```bash
git fetch github
git status --short --branch
git rev-parse HEAD
git rev-parse github/main
npm run validate:core
npm test
npm run release:candidate -- --check
npm run release:freeze -- --check
npm run deployment:runbook -- --check
npm run platform:release-readiness-control-plane -- --check
npm run platform:production-governance-hardening -- --check
npm run platform:p16800-platform-freeze -- --check
```

Optional final envelope:

```bash
npm run platform:release-check -- --check
```

### 2. Human Approval Capture

- [ ] Attach the refreshed command output summary.
- [ ] Attach GitHub CI URL.
- [x] Attach owner release-candidate freeze decision.
- [ ] Attach GitHub independent approval URL if available.
- [ ] Attach owner production launch decision.
- [ ] Attach signed provenance record.

### 3. Tag Preparation

Use the tag draft in `docs/release-note-tag-draft-2026-06-14.md`.

Local RC tag created:

```bash
git tag -a v0.1.0-rc.20260614.5e332b1 5e332b1c6327b255cf9bf418bc455b7965172658
```

Do not push the tag until owner tag-push approval is recorded.

### 4. Staging Deployment

- [ ] Deploy candidate to staging.
- [ ] Run smoke tests.
- [ ] Verify logs and monitoring.
- [ ] Verify rollback path.
- [ ] Record staging evidence.

### 5. Production Deployment

Allowed only after owner production launch approval.

- [ ] Deploy production.
- [ ] Verify health endpoint or equivalent.
- [ ] Verify core read-only operator flow.
- [ ] Verify no protected action controls are exposed as live authority.
- [ ] Watch metrics for the agreed launch window.
- [ ] Record production deployment receipt.

### 6. Post-Launch

- [ ] Publish release notes.
- [ ] Notify stakeholders.
- [ ] Open incident watch.
- [ ] Record first-use audit.
- [ ] Create post-launch patch lane.

## Rollback Triggers

Rollback or hold launch if any are true:

- CI fails on the final candidate.
- `npm test` fails.
- Any production governance check flips `deployment_allowed_now` unexpectedly.
- Any authority flag claims production PASS or enterprise PASS without explicit receipt.
- Smoke test fails.
- Secrets or raw protected payloads are exposed.
- GitHub independent approval is required but missing.
- Owner production decision is missing or ambiguous.

## Explicit Non-Approvals

This checklist does not approve:

- production launch
- production PASS
- enterprise PASS
- enterprise trust claim
- GitHub independent approval
- human-gate bypass
- protected closeout
- deployment authority
