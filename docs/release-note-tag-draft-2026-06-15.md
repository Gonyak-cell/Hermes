# Hermes Release Note And Tag Draft - 2026-06-15

이 문서는 Hermes desktop candidate commit `8200ed3b754b74900a95fe5a48875a1daf707335` 기준 release note와 tag 초안이다. 실제 tag 생성, tag push, GitHub Release publication, package publication, production deployment는 owner approval 이후에만 수행한다.

## Tag Policy Draft

Current package version:

```text
hermes-project-ops-harness@0.1.0
@hermes/operator-desktop@0.1.0
```

Recommended RC tag before production approval:

```text
v0.1.0-rc.20260615.8200ed3
```

Current RC tag status:

```text
Created locally: false
Pushed to GitHub: false
GitHub Release published: false
Desktop package published: false
Trust mode: single-owner lower-trust RC
GitHub independent approval: not pursued
```

Previous local RC tag:

```text
v0.1.0-rc.20260614.5e332b1
```

The previous tag remains historical evidence for the prior candidate and should not be reused for the desktop-hardened candidate.

Recommended production tag only after owner production approval:

```text
v0.1.0
```

Do not use `v1.0.0` unless the owner explicitly changes version policy. Existing v1 freeze language is an acceptance-envelope label, while `package.json` currently declares `0.1.0`.

## Tag Commands Draft

Do not run until owner tag creation approval:

```bash
git tag -a v0.1.0-rc.20260615.8200ed3 8200ed3b754b74900a95fe5a48875a1daf707335 -m "Hermes v0.1.0 desktop RC - 2026-06-15"
```

Do not run until explicit tag-push approval:

```bash
git push github v0.1.0-rc.20260615.8200ed3
```

Production tag after explicit owner production approval:

```bash
git tag -a v0.1.0 8200ed3b754b74900a95fe5a48875a1daf707335 -m "Hermes v0.1.0"
git push github v0.1.0
```

## GitHub Release Draft

Title:

```text
Hermes v0.1.0 Desktop RC - Read-Only Operator Shell Baseline
```

Target:

```text
8200ed3b754b74900a95fe5a48875a1daf707335
```

Release type:

```text
Pre-release / release candidate
```

## Release Notes Draft

### Summary

Hermes `v0.1.0-rc.20260615.8200ed3` establishes a desktop release-candidate baseline for the Hermes project/workflow operating harness. This RC adds the read-only Hermes Operator Desktop shell and closes the Claude review hardening loop for desktop preview, CSP, parser, projection safety, projection-row authority, and guarded local repo-root override.

This is a release-candidate governance baseline. It is not a production PASS, enterprise PASS, enterprise trust claim, protected closeout, GitHub independent approval, tag push approval, or deployment authorization.

### Highlights

- Added a read-only Electron operator desktop shell for Hermes evidence, release, factory, and authority projections.
- Added Korean/English renderer copy support and deterministic section navigation.
- Added desktop read model, authority boundary, and packaging manifest scripts/schemas/tests.
- Added safe markdown source preview with allowlist/denylist handling and forbidden trust-copy redaction.
- Added render smoke checks for overview, factory, and source-preview screens.
- Closed Claude desktop review findings:
  - redacts `desktop write authority enabled`;
  - blocks allowlisted symlinks that resolve outside the repository;
  - removes `style-src 'unsafe-inline'` from CSP;
  - replaces release publish dead ternaries with explicit hardcoded false authority;
  - removes factory projection ordering dependency;
  - rejects unknown or missing CLI flags in desktop scripts.
- Closed the final P4 hardening notes:
  - replaces residual projection-row authority ternary with explicit hardcoded false authority;
  - gates and documents `HERMES_REPO_ROOT` for local desktop and smoke capture flows.

### Verification

Known current checks for candidate `8200ed3b754b74900a95fe5a48875a1daf707335`:

- `git diff --check`: passed
- `npm audit --prefix apps/desktop`: `found 0 vulnerabilities`
- `npm run desktop:local-preflight`: passed
- `npm run validate:core`: passed
- `npm run release:candidate -- --check`: complete
- `npm run release:freeze -- --check`: complete
- `npm run platform:release-readiness-control-plane -- --check`: ready, deployment remains blocked
- `npm run platform:release-bundle-provenance -- --check`: ready
- `npm run platform:launch-non-human-readiness -- --check`: ready, authority flags closed
- `node --test test/desktop-read-model.test.mjs`: `7 pass / 0 fail`
- `npm run test:desktop`: `19 pass / 0 fail`
- Previous full `npm test` on `1d98ee0d...`: `2670 pass / 0 fail`; not rerun after P4-only hardening
- Optional `npm run platform:release-check -- --check`: attempted and interrupted after long-running `project:zendd-active-operator-dashboard --check`; not counted as pass

### Authority Boundary

The following remain intentionally blocked:

- production deployment;
- production PASS;
- enterprise PASS;
- enterprise trust claim;
- protected closeout;
- GitHub independent approval;
- human-gate bypass;
- runtime execution authority;
- connector write authority;
- secret read authority;
- raw source exposure;
- desktop write authority;
- auto-update or package publication authority.

### Known Non-Launch Items

- P4 closure Claude review receipt is captured for this exact candidate: `PASS_WITH_FINDINGS`, `0` blocking findings, `1` P3 document-pointer drift finding resolved by this packet refresh.
- Owner RC re-freeze decision is not yet recorded for `8200ed3b...`.
- Production deployment target is not selected.
- Production secrets/environment owner is not recorded.
- Independent GitHub approval is not pursued for this single-owner local RC.
- Owner production launch decision is not recorded.
- Final `platform:release-check -- --check` envelope remains optional before tag publication unless the owner requires a single umbrella receipt; the latest attempt was interrupted and is not a pass.

### Upgrade / Deployment Notes

- No production migration is approved by this release note.
- No runtime deployment is performed by this release note.
- No local or remote tag is created by this release note.
- Use `docs/production-launch-checklist-2026-06-15.md` before staging, package publication, or production deployment.
- Use `docs/release-decision-packet-2026-06-15.md` for owner decision capture.

### Rollback

If the release candidate is rejected:

- Do not create or push the tag.
- Do not publish GitHub Release.
- Keep `8200ed3b754b74900a95fe5a48875a1daf707335` as a reviewed candidate attempt only.
- Open a new patch lane from the intended baseline.
- Re-run the release checks after the patch.

If a tag is created locally by mistake:

```bash
git tag -d v0.1.0-rc.20260615.8200ed3
```

If a tag is pushed by mistake:

```bash
git push github :refs/tags/v0.1.0-rc.20260615.8200ed3
```

Only run tag deletion with explicit owner approval.
