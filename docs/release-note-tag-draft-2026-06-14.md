# Hermes Release Note And Tag Draft - 2026-06-14

이 문서는 Hermes candidate commit `5e332b1c6327b255cf9bf418bc455b7965172658` 기준 release note와 tag 초안이다. 실제 tag 생성, tag push, GitHub Release publication, production deployment는 owner approval 이후에만 수행한다.

## Tag Policy Draft

Current package version:

```text
hermes-project-ops-harness@0.1.0
```

Recommended RC tag before production approval:

```text
v0.1.0-rc.20260614.5e332b1
```

Current RC tag status:

```text
Created locally: true
Pushed to GitHub: false
GitHub Release published: false
Trust mode: single-owner lower-trust RC
GitHub independent approval: not pursued
```

Recommended production tag only after owner production approval:

```text
v0.1.0
```

Do not use `v1.0.0` unless the owner explicitly changes version policy. Existing v1 freeze language is an acceptance-envelope label, while `package.json` currently declares `0.1.0`.

## Tag Commands Draft

Already run locally after owner release-candidate freeze approval:

```bash
git fetch github
git checkout main
git pull --ff-only github main
git rev-parse HEAD
git tag -a v0.1.0-rc.20260614.5e332b1 5e332b1c6327b255cf9bf418bc455b7965172658 -m "Hermes v0.1.0 RC - 2026-06-14"
```

Do not run until explicit tag-push approval:

```bash
git push github v0.1.0-rc.20260614.5e332b1
```

Production tag after explicit owner approval:

```bash
git tag -a v0.1.0 5e332b1c6327b255cf9bf418bc455b7965172658 -m "Hermes v0.1.0"
git push github v0.1.0
```

## GitHub Release Draft

Title:

```text
Hermes v0.1.0 RC - Release Governance Baseline
```

Target:

```text
5e332b1c6327b255cf9bf418bc455b7965172658
```

Release type:

```text
Pre-release / release candidate
```

## Release Notes Draft

### Summary

Hermes `v0.1.0-rc.20260614.5e332b1` establishes a release-candidate baseline for the Hermes project/workflow operating harness. This release line focuses on deterministic release evidence, external verification hardening, production-governance readiness, and explicit authority boundaries.

This is a release-candidate governance baseline. It is not a production PASS, enterprise PASS, enterprise trust claim, or protected closeout.

### Highlights

- Hardened external verification evidence so blocked, failed, or remote-only receipts cannot become repository identity evidence.
- Preserved explicit evidence boundaries for GitHub CLI, CI artifacts, external verification, and local observed receipts.
- Fixed launch readiness ready-source handling and merged the fix into `main`.
- Closed release-readiness evidence for candidate, freeze, deployment runbook, provenance, production governance, and P16800 platform freeze checks.
- Added current launch decision, production checklist, GitHub reviewer packet, and tag draft material for owner review.

### Verification

Known current checks:

- `npm test`: `2655 pass / 0 fail`
- `npm run validate:core`: passed
- `git diff --check`: passed
- `npm run release:candidate -- --check`: complete
- `npm run release:freeze -- --check`: complete
- `npm run deployment:runbook -- --check`: complete
- `npm run platform:release-readiness-control-plane -- --check`: ready, deployment remains blocked
- `npm run platform:release-bundle-provenance -- --check`: ready
- `npm run factory:gate-opening-readiness -- --check`: ready, gate open now 0
- `npm run factory:stage6-7-execution-readiness -- --check`: ready, runtime authority closed
- `npm run platform:production-governance-hardening -- --check`: ready, production PASS false
- `npm run platform:p16800-platform-freeze -- --check`: ready, enterprise trust claim false

GitHub evidence:

- PR #2 merged into `main`.
- Candidate commit: `5e332b1c6327b255cf9bf418bc455b7965172658`.
- Latest `main` CI: `Hermes Verification Trust`, run `27494810403`, success.

### Authority Boundary

The following remain intentionally blocked:

- production deployment
- production PASS
- enterprise PASS
- enterprise trust claim
- protected closeout
- GitHub independent approval
- human-gate bypass
- runtime execution authority
- connector write authority
- secret read authority
- raw source exposure

### Known Non-Launch Items

- Production deployment target is not selected.
- Production secrets/environment owner is not recorded.
- Independent GitHub approval is not pursued for this single-owner local RC.
- Owner production launch decision is not recorded.
- Final `platform:release-check -- --check` envelope may be run before tag publication if the owner wants a single umbrella receipt.

### Upgrade / Deployment Notes

- No production migration is approved by this release note.
- No runtime deployment is performed by this release note.
- Use `docs/production-launch-checklist-2026-06-14.md` before staging or production deployment.
- Use `docs/release-decision-packet-2026-06-14.md` for owner decision capture.
- Use `docs/github-final-review-packet-2026-06-14.md` for independent reviewer handoff.

### Rollback

If the release candidate is rejected:

- Do not push the tag.
- Do not publish GitHub Release.
- Keep `5e332b1c6327b255cf9bf418bc455b7965172658` as the audited candidate baseline.
- Open a new patch lane from `main`.
- Re-run the release checks after the patch.

If a tag was created locally but not pushed:

```bash
git tag -d v0.1.0-rc.20260614.5e332b1
```

If a tag was pushed by mistake:

```bash
git push github :refs/tags/v0.1.0-rc.20260614.5e332b1
```

Only run tag deletion with explicit owner approval.

## Publication Checklist

- [x] Owner release-candidate freeze decision recorded in `docs/release-owner-decision-2026-06-14.md`.
- [x] GitHub independent reviewer decision marked not pursued for this single-owner local RC.
- [ ] Final CI checked.
- [ ] Final local validation checked.
- [x] Tag policy accepted for local RC tag.
- [x] Local RC tag created.
- [ ] Tag pushed.
- [ ] GitHub Release drafted as pre-release.
- [ ] Release notes pasted from this draft.
- [ ] Production launch remains blocked unless separately approved.
