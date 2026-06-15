# Hermes Release Decision Packet - 2026-06-15

이 문서는 Hermes desktop-shell 반영 후 새 release-candidate 기준점 후보를 기록한다. 이 문서는 출시 승인 자체가 아니며, Codex가 production PASS, enterprise PASS, GitHub 독립 승인, protected closeout, 배포 권한을 자체 발급하지 않는다.

## Decision Summary

| Field | Value |
|---|---|
| Repository | `Gonyak-cell/Hermes` |
| Branch | `codex/hermes-desktop-shell` |
| Candidate commit | `1d98ee0d0744cd419d9762bb98f4aad90a24d362` |
| Candidate commit title | `fix: address desktop review hardening findings` |
| Previous RC baseline | `5e332b1c6327b255cf9bf418bc455b7965172658` |
| Previous local RC tag | `v0.1.0-rc.20260614.5e332b1` |
| Package | `hermes-project-ops-harness@0.1.0` |
| Desktop package | `@hermes/operator-desktop@0.1.0` |
| Packet date | 2026-06-15 KST |
| Recommended decision | Approve release-candidate re-freeze only; do not mark production PASS |
| Proposed local RC tag | `v0.1.0-rc.20260615.1d98ee0` |
| Tag status | draft only, not created, not pushed |
| Trust mode | `single-owner lower-trust RC`; GitHub independent approval not pursued |

## Why This Supersedes The 2026-06-14 Packet

The 2026-06-14 decision packet remains historical evidence for commit `5e332b1c6327b255cf9bf418bc455b7965172658`. It is not deleted or rewritten.

This 2026-06-15 packet is needed because the desktop review hardening findings were fixed after the previous RC baseline. The new candidate includes the full desktop shell line plus the follow-up hardening commit:

- read-only desktop shell and renderer contract;
- desktop read model and authority boundary artifacts;
- local packaging boundary manifest;
- safe source preview;
- release and factory state projection into the desktop shell;
- desktop render smoke tests;
- Claude review finding remediation for redaction, symlink containment, CSP, parser hardening, and projection cleanup.

## Current Evidence

### Local Evidence

| Evidence | Result |
|---|---|
| `git status --short --branch` | `## codex/hermes-desktop-shell` |
| `git diff --check` | pass |
| `npm audit --prefix apps/desktop` | `found 0 vulnerabilities` |
| `npm run desktop:local-preflight` | pass; desktop packaging/read-model/authority checks, desktop tests, Vite build, and three smoke renders passed |
| `npm run validate:core` | pass |
| `npm run release:candidate -- --check` | `Status: complete`, `Matrix: 8/8`, `Commands: 20/20`, `Validation errors: 0` |
| `npm run release:freeze -- --check` | `Status: complete`, `Checklist: 8/8`, `Gates: 7/7`, `Validation errors: 0` |
| `npm run platform:release-readiness-control-plane -- --check` | `Status: ready_for_release_readiness_control_plane`, `Deployment allowed: false`, `Validation errors: 0` |
| `npm run platform:release-bundle-provenance -- --check` | `Status: ready`, bundle requirements `5/5`, validation errors `0` |
| `npm run platform:launch-non-human-readiness -- --check` | `Status: ready_for_non_human_launch_readiness_execution`, authority flags closed `12/12`, validation errors `0` |
| `npm test` | `2670 pass / 0 fail` |

### Desktop Evidence

| Evidence | Result |
|---|---|
| Desktop package audit | 0 vulnerabilities |
| Desktop tests | `16 pass / 0 fail` during `desktop:local-preflight` |
| Desktop build | Vite production build pass |
| Render smoke | `tmp/desktop-render-smoke.png` |
| Factory render smoke | `tmp/desktop-render-smoke-factory.png` |
| Preview render smoke | `tmp/desktop-render-smoke-preview.png` |
| Forbidden trust copy guard | passed through `--assert-no-forbidden-trust-copy` |

### Review Evidence

| Evidence | Result |
|---|---|
| Prior Claude review | `PASS_WITH_FINDINGS` on `64ab0fe24c0cf2d8be1e5941c112138b64b99fe4` |
| Prior findings fixed in candidate | yes, by `1d98ee0d0744cd419d9762bb98f4aad90a24d362` |
| Fresh Claude final review | `PASS_WITH_FINDINGS`; `observed_valid_review`; `6/6` prior findings fixed; `0` blocking findings; `2` P4 hardening notes |
| Fresh Claude receipt | `artifacts/hermes-desktop-claude-review/final-1d98ee0d/review-receipt.json` |
| Fresh Claude raw SHA256 | `0e689e880b1262c16da73b6d3dbec60af6854620ac0151c9ee71dda125cc9313` |

## Decision Choices

### A. Approve Release-Candidate Re-Freeze

Recommended now if the owner accepts the fresh Claude final review result and the two P4 notes as non-blocking follow-up items.

- Approves `1d98ee0d0744cd419d9762bb98f4aad90a24d362` as the current release-candidate evidence baseline.
- Supersedes the prior `5e332b1c...` RC baseline for future desktop RC discussion.
- Allows preparing a local RC tag draft, reviewer handoff, and deployment rehearsal materials.
- Does not allow production deployment.
- Does not allow enterprise trust claim.
- Does not satisfy GitHub independent approval by itself.

### B. Hold For More Review

Use this if the owner wants any of the following before re-freeze:

- remediation of the two P4 Claude hardening notes;
- another Claude review after remediation;
- external GitHub collaborator review;
- fresh CI run on a PR;
- final umbrella `npm run platform:release-check -- --check`;
- tag policy changes.

### C. Approve Staging Rehearsal

Allowed only after separate owner staging authority is recorded.

- Requires target provider, environment owner, secrets owner, monitoring owner, and rollback owner.
- Must keep production PASS false.
- Must not be conflated with production launch.

### D. Approve Production Launch

Not recommended from this packet alone.

Required before this option can be selected:

- owner production launch approval for this exact candidate commit;
- deployment target and domain decision;
- secrets/environment ownership;
- monitoring and incident response ownership;
- rollback target and command evidence;
- optional but recommended final `platform:release-check -- --check`;
- explicit statement that single-owner mode is lower-trust and not enterprise independent review.

## Authority Boundary

The following remain false unless a separate authorized receipt changes them:

- `deployment_allowed_now: false`
- `release_approval_allowed_now: false`
- `production_pass_enabled: false`
- `enterprise_pass_enabled: false`
- `enterprise_trust_claim_allowed_now: false`
- `protected_closeout_enabled: false`
- `human_gate_bypass_allowed_now: false`
- `independent_review_bypass_allowed_now: false`
- `single_owner_enterprise_trust_allowed_now: false`
- `runtime_execution_allowed_now: false`
- `write_action_allowed_now: false`
- `connector_write_enabled: false`
- `secret_read_allowed_now: false`
- `raw_source_exposure_allowed: false`
- `desktop_write_authority: false`

## Owner Decision Template

Copy this block only if the fresh Claude final review result is accepted.

```text
Hermes desktop RC re-freeze decision.

Candidate commit: 1d98ee0d0744cd419d9762bb98f4aad90a24d362
Repository: Gonyak-cell/Hermes
Branch: codex/hermes-desktop-shell
Decision selected: A release-candidate re-freeze

I approve this commit as the current desktop release-candidate evidence baseline,
superseding the 2026-06-14 RC baseline for future desktop RC work.

This is not production launch approval, production PASS, enterprise PASS,
GitHub independent approval, protected closeout, tag-push approval, GitHub Release
publication approval, or deployment authorization.

I accept the fresh Claude final review result for this candidate as
PASS_WITH_FINDINGS with 0 blocking findings and 2 non-blocking P4 hardening notes.
```

## Next Required Human Inputs After Step 4

| Input | Required for | Current status |
|---|---|---|
| Owner RC re-freeze decision | making `1d98ee0d...` the active RC baseline | pending |
| Local RC tag creation approval | creating `v0.1.0-rc.20260615.1d98ee0` | pending |
| Tag push approval | publishing tag to GitHub | missing |
| Owner production launch approval | production deployment | missing |
| Deployment target selection | staging or production | missing |
| Secrets/environment owner confirmation | staging or production | missing |
| Monitoring/incident owner confirmation | production launch | missing |
