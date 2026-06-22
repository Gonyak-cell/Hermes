# Hermes Release Decision Packet - 2026-06-15

이 문서는 Hermes desktop-shell 반영 후 새 release-candidate 기준점 후보를 기록한다. 이 문서는 출시 승인 자체가 아니며, Codex가 production PASS, enterprise PASS, GitHub 독립 승인, protected closeout, 배포 권한을 자체 발급하지 않는다.

## Decision Summary

| Field | Value |
|---|---|
| Repository | `Gonyak-cell/Hermes` |
| Branch | `codex/hermes-desktop-shell` |
| Candidate commit | `8200ed3b754b74900a95fe5a48875a1daf707335` |
| Candidate commit title | `fix: close desktop final review p4 findings` |
| Previous RC baseline | `5e332b1c6327b255cf9bf418bc455b7965172658` |
| Previous local RC tag | `v0.1.0-rc.20260614.5e332b1` |
| Package | `hermes-project-ops-harness@0.1.0` |
| Desktop package | `@hermes/operator-desktop@0.1.0` |
| Packet date | 2026-06-15 KST |
| Selected decision | Local-only release-candidate closeout; do not mark production PASS |
| Proposed local RC tag | `v0.1.0-rc.20260615.8200ed3` |
| Tag status | created locally only; not pushed |
| Launch path | `local-only`; no staging, production, package publication, or GitHub Release |
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
- Claude review finding remediation for redaction, symlink containment, CSP, parser hardening, projection cleanup, projection-row authority cleanup, and `HERMES_REPO_ROOT` guard/documentation.

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
| `node --test test/desktop-read-model.test.mjs` | `7 pass / 0 fail` |
| `npm run test:desktop` | `19 pass / 0 fail` |
| Full `npm test` after P4 hardening | `2670 pass / 0 fail`; completed 2026-06-15 12:01 KST; `duration_ms 3721539.720667` |
| Optional `npm run platform:release-check -- --check` | interrupted after long-running `project:zendd-active-operator-dashboard --check`; not counted as pass |

### Desktop Evidence

| Evidence | Result |
|---|---|
| Desktop package audit | 0 vulnerabilities |
| Desktop tests | `19 pass / 0 fail` during `desktop:local-preflight` |
| Desktop build | Vite production build pass |
| Render smoke | `tmp/desktop-render-smoke.png` |
| Factory render smoke | `tmp/desktop-render-smoke-factory.png` |
| Preview render smoke | `tmp/desktop-render-smoke-preview.png` |
| Forbidden trust copy guard | passed through `--assert-no-forbidden-trust-copy` |

### Review Evidence

| Evidence | Result |
|---|---|
| Prior Claude review | `PASS_WITH_FINDINGS` on `64ab0fe24c0cf2d8be1e5941c112138b64b99fe4` |
| First final Claude review | `PASS_WITH_FINDINGS` on `1d98ee0d0744cd419d9762bb98f4aad90a24d362`; `6/6` prior findings fixed; `0` blocking findings; `2` P4 hardening notes |
| Fresh Claude receipt | `artifacts/hermes-desktop-claude-review/final-1d98ee0d/review-receipt.json` |
| Fresh Claude raw SHA256 | `0e689e880b1262c16da73b6d3dbec60af6854620ac0151c9ee71dda125cc9313` |
| P4 closure Claude review | `PASS_WITH_FINDINGS` on `8200ed3b754b74900a95fe5a48875a1daf707335`; `8/8` prior/P4 findings fixed; `0` blocking findings; `1` P3 doc-pointer drift finding |
| P4 closure Claude receipt | `artifacts/hermes-desktop-claude-review/final-8200ed3b/review-receipt.json` |
| P4 closure Claude raw SHA256 | `191df0f6caefa08b67034d00722153afd4f35e1e36a2fa4c10cf4c602194632b` |
| P3 doc-pointer drift | resolved by this packet refresh from `1d98ee0d...` to `8200ed3b...` |

## Decision Choices

### A. Approve Release-Candidate Re-Freeze

Recommended now if the owner accepts the P4 closure review result and this packet refresh.

- Approves `8200ed3b754b74900a95fe5a48875a1daf707335` as the current desktop code release-candidate evidence baseline.
- Supersedes the prior `5e332b1c...` RC baseline for future desktop RC discussion.
- Allows preparing a local RC tag draft, reviewer handoff, and deployment rehearsal materials.
- Does not allow production deployment.
- Does not allow enterprise trust claim.
- Does not satisfy GitHub independent approval by itself.

### B. Hold For More Review

Use this if the owner wants any of the following before re-freeze:

- another Claude review after this packet refresh;
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

Copy this block only if the P4 closure Claude review result and this packet refresh are accepted.

```text
Hermes desktop RC re-freeze decision.

Candidate commit: 8200ed3b754b74900a95fe5a48875a1daf707335
Repository: Gonyak-cell/Hermes
Branch: codex/hermes-desktop-shell
Decision selected: A release-candidate re-freeze

I approve this commit as the current desktop release-candidate evidence baseline,
superseding the 2026-06-14 RC baseline for future desktop RC work.

This is not production launch approval, production PASS, enterprise PASS,
GitHub independent approval, protected closeout, tag-push approval, GitHub Release
publication approval, or deployment authorization.

I accept the P4 closure Claude review result for this candidate as
PASS_WITH_FINDINGS with 0 blocking findings. The one P3 document-pointer drift
finding is resolved by the refreshed 2026-06-15 release packet.
```

## Recorded Local-Only Decision

At 2026-06-15 15:08 KST, the owner selected `local-only` handling for the
desktop RC line.

- `8200ed3b754b74900a95fe5a48875a1daf707335` is the local desktop RC code
  evidence baseline.
- `v0.1.0-rc.20260615.8200ed3` remains a local-only RC tag.
- No tag push is approved.
- No GitHub Release publication is approved.
- No package publication is approved.
- No staging or production deployment is approved.
- Production PASS, enterprise PASS, enterprise trust, protected closeout, and
  deployment authority remain false.

## Next Required Human Inputs After Step 4

| Input | Required for | Current status |
|---|---|---|
| Owner RC re-freeze decision | making `8200ed3b...` the local RC baseline | completed for local-only |
| Local RC tag creation | `v0.1.0-rc.20260615.8200ed3` created locally only | completed locally; not pushed |
| Tag push approval | publishing tag to GitHub | not requested; not approved |
| Owner production launch approval | production deployment | not requested; not approved |
| Deployment target selection | release handling path | local-only selected |
| Secrets/environment owner confirmation | staging or production | not applicable while local-only |
| Monitoring/incident owner confirmation | production launch | not applicable while local-only |
