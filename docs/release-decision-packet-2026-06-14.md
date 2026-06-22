# Hermes Release Decision Packet - 2026-06-14

이 문서는 Hermes 출시 후보에 대한 owner / release manager 판정 패킷이다. 이 문서는 출시 승인 자체가 아니며, Codex가 production PASS, enterprise PASS, GitHub 독립 승인, protected closeout, 배포 권한을 자체 발급하지 않는다.

## Decision Summary

| Field | Value |
|---|---|
| Repository | `Gonyak-cell/Hermes` |
| Default branch | `main` |
| Candidate commit | `5e332b1c6327b255cf9bf418bc455b7965172658` |
| Candidate commit title | `Merge PR #2: Fix launch readiness ready-source handling` |
| Local branch state | `main...github/main` |
| Worktree tracked status | clean at packet creation |
| Package | `hermes-project-ops-harness@0.1.0` |
| Packet date | 2026-06-14 KST |
| Recommended decision | Approve release-candidate freeze only; do not mark production PASS yet |
| Observed owner decision | `A release-candidate freeze` recorded in `docs/release-owner-decision-2026-06-14.md` |
| Local RC tag | `v0.1.0-rc.20260614.5e332b1` created locally, not pushed |
| Trust mode | `single-owner lower-trust RC`; GitHub independent approval not pursued |

## Decision Choices

### A. Approve Release-Candidate Freeze

Recommended now.

- Approves this commit as the current release-candidate evidence baseline.
- Allows preparing final reviewer handoff, release note draft, tag draft, and deployment rehearsal materials.
- Does not allow production deployment.
- Does not allow enterprise trust claim.
- Does not satisfy GitHub independent approval by itself.

### B. Approve Staging Deployment Rehearsal

Allowed only after a human owner explicitly opens staging/deployment authority.

- Requires environment/secrets owner to confirm staging target.
- Requires rollback target and monitoring owner.
- Requires a post-deploy smoke report.
- Must keep production PASS false.

### C. Approve Production Launch

Not recommended from the current automated evidence alone.

Required before this option can be selected:

- GitHub independent approver records approval or equivalent external approval record.
- Human owner records production launch approval for this candidate commit.
- Deployment target, secrets, observability, rollback, and incident owner are confirmed.
- Final `platform:release-check` is run or explicitly waived by the human owner because its child commands were already run.
- Production smoke and rollback criteria are accepted.

### D. Block / Hold

Use this if the owner wants any of the following before launch:

- New external review.
- New CI run.
- Fresh full local test run.
- Deployment target decision.
- Release-note edits.
- Version/tag policy decision.

## Current Evidence

### Local Evidence

| Evidence | Result |
|---|---|
| `npm test` | `2655 pass / 0 fail` |
| `npm run validate:core` | pass |
| `git diff --check` | pass |
| `git status --short --branch` | `## main...github/main` |

### Release Evidence

| Command | Result |
|---|---|
| `npm run release:candidate -- --check` | `Status: complete`, `Matrix: 8/8`, `Commands: 20/20`, `Validation errors: 0` |
| `npm run release:freeze -- --check` | `Status: complete`, `Checklist: 8/8`, `Gates: 7/7`, `Validation errors: 0` |
| `npm run deployment:runbook -- --check` | `Status: complete`, `Environments: 5/5`, `Commands documented: 16/16`, `Rollback steps: 4`, `Validation errors: 0` |
| `npm run platform:release-readiness-control-plane -- --check` | `Status: ready_for_release_readiness_control_plane`, `Ready for P13001 handoff: true`, `Deployment allowed: false` |
| `npm run platform:release-bundle-provenance -- --check` | `Status: ready`, `Bundle hash requirements: 5/5`, `Manifest rows: 5/5`, `Verification rows: 5/5` |
| `npm run factory:gate-opening-readiness -- --check` | `Status: ready_factory_gate_opening_readiness`, `Gate open now: 0` |
| `npm run factory:stage6-7-execution-readiness -- --check` | `Status: ready_stage6_stage7_contract_development`, `Runtime authority open: false` |
| `npm run platform:production-governance-hardening -- --check` | `Status: ready_for_production_governance_hardening`, `Deployment allowed: false`, `Production PASS enabled: false` |
| `npm run platform:p16800-platform-freeze -- --check` | `Status: ready_for_p16800_platform_freeze`, `Enterprise trust claim allowed: false` |

### GitHub Evidence

| Item | Result |
|---|---|
| PR #2 | merged into `main` |
| PR #2 merge commit | `5e332b1c6327b255cf9bf418bc455b7965172658` |
| PR #2 CI | `Hermes Verification Trust`, success |
| Latest push CI on `main` | run `27494810403`, success |
| PR review decision | `REVIEW_REQUIRED` on historical PR record; do not treat as independent approval |

## Authority Boundary

The following remain false and must stay false unless the named authority explicitly changes them:

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

## Owner Decision Template

Copy this block into the owner decision channel when ready.

```text
Hermes release decision.

Candidate commit: 5e332b1c6327b255cf9bf418bc455b7965172658
Repository: Gonyak-cell/Hermes
Decision selected: [A release-candidate freeze / B staging rehearsal / C production launch / D hold]

I have reviewed:
- local validation evidence
- GitHub CI evidence
- release candidate and freeze checks
- release readiness control plane
- release bundle provenance
- production governance and P16800 freeze boundaries
- GitHub final reviewer packet
- release note/tag draft

Decision notes:
[free text]

This decision does not grant enterprise PASS, enterprise trust, GitHub independent approval, or human-gate bypass unless explicitly stated in a separate authority receipt.
```

## Next Required Human Inputs

| Input | Required for | Current status |
|---|---|---|
| Owner release-candidate freeze decision | release-candidate evidence baseline | observed |
| External / GitHub independent approval | independent / enterprise trust | not pursued for this single-owner local RC |
| Owner production launch approval | production deployment | missing |
| Deployment target | staging or production launch | missing |
| Secrets/environment owner | staging or production launch | missing |
| Monitoring and incident owner | production launch | missing |
| Final tag policy | GitHub release | local RC tag created; push not approved |
