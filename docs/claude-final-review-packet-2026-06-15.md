# Hermes Desktop Claude Final Review Packet - 2026-06-15

This is the human-readable review packet for a fresh Claude Code read-only final review of the Hermes desktop RC candidate.

## Scope

| Field | Value |
|---|---|
| Repository | `Gonyak-cell/Hermes` |
| Local path | `/Users/jws/Documents/Codex/Hermes` |
| Branch | `codex/hermes-desktop-shell` |
| Prior RC baseline | `5e332b1c6327b255cf9bf418bc455b7965172658` |
| Prior desktop review head | `64ab0fe24c0cf2d8be1e5941c112138b64b99fe4` |
| Candidate head | `8200ed3b754b74900a95fe5a48875a1daf707335` |
| Review target | Verify prior desktop review findings are remediated and no new P0/P1/P2 desktop or authority-boundary regression is introduced |
| Requested engine | `Claude Code Opus 4.8 Ultracode xhigh` |
| Expected observed model | `claude-opus-4-7` or newer Opus-family equivalent |

## Evidence Already Refreshed

- `git diff --check`: pass
- `npm audit --prefix apps/desktop`: `found 0 vulnerabilities`
- `npm run desktop:local-preflight`: pass
- `npm run validate:core`: pass
- `npm run release:candidate -- --check`: pass
- `npm run release:freeze -- --check`: pass
- `npm run platform:release-readiness-control-plane -- --check`: pass, deployment remains false
- `npm run platform:release-bundle-provenance -- --check`: pass
- `npm run platform:launch-non-human-readiness -- --check`: pass, authority flags closed
- `npm test`: `2670 pass / 0 fail`

## Review Result

The first fresh Claude final review was captured under `artifacts/hermes-desktop-claude-review/final-1d98ee0d/`.

| Field | Value |
|---|---|
| Receipt status | `observed_valid_review` |
| Review status | `PASS_WITH_FINDINGS` |
| Observed model | `claude-opus-4-7` |
| Prior findings fixed | `6/6` |
| Findings | `2` |
| Blocking findings | `0` |
| Findings by severity | `P4: 2` |
| Receipt path | `artifacts/hermes-desktop-claude-review/final-1d98ee0d/review-receipt.json` |
| Raw output path | `artifacts/hermes-desktop-claude-review/final-1d98ee0d/raw-output.json` |
| Raw SHA256 | `0e689e880b1262c16da73b6d3dbec60af6854620ac0151c9ee71dda125cc9313` |

The two P4 notes are non-blocking hardening follow-ups:

- Replace a residual fail-closed dead ternary in `src/desktop-read-model.mjs`.
- Document or gate the `HERMES_REPO_ROOT` local desktop override in the desktop runbook and mirrored capture flow.

## P4 Closure Review Result

The P4 closure Claude review was captured under `artifacts/hermes-desktop-claude-review/final-8200ed3b/`.

| Field | Value |
|---|---|
| Receipt status | `observed_valid_review` |
| Review status | `PASS_WITH_FINDINGS` |
| Observed model | `claude-opus-4-7` |
| Prior/P4 findings fixed | `8/8` |
| Findings | `1` |
| Blocking findings | `0` |
| Findings by severity | `P3: 1` |
| Receipt path | `artifacts/hermes-desktop-claude-review/final-8200ed3b/review-receipt.json` |
| Raw output path | `artifacts/hermes-desktop-claude-review/final-8200ed3b/raw-output.json` |
| Raw SHA256 | `191df0f6caefa08b67034d00722153afd4f35e1e36a2fa4c10cf4c602194632b` |

The P3 finding was document-pointer drift: the release packet, production checklist, and tag draft still cited `1d98ee0d...`. This packet now points those release documents at `8200ed3b...`.

## Review Instructions

Claude must review in read-only mode. It may inspect files and run read-only commands, but must not edit source, stage files, commit, tag, push, publish releases, start deployments, mutate artifacts as review evidence, or claim final approval.

The review should focus on:

1. Whether all six findings from `artifacts/hermes-desktop-claude-review/latest/review-receipt.json` remain addressed in candidate `8200ed3b754b74900a95fe5a48875a1daf707335`.
2. Whether the candidate introduces any new P0/P1/P2 issue in:
   - `apps/desktop/src/main/read-model.mjs`
   - `apps/desktop/src/main/security-policy.mjs`
   - `apps/desktop/src/main/main.mjs`
   - `apps/desktop/src/preload/index.cjs`
   - `apps/desktop/src/renderer/`
   - `src/desktop-read-model.mjs`
   - `src/desktop-authority-boundary.mjs`
   - `src/desktop-packaging-manifest.mjs`
   - related desktop tests and schemas
3. Whether desktop source preview still fails closed for:
   - non-markdown paths;
   - path traversal;
   - symlink escape;
   - forbidden trust-copy strings;
   - denied source rows.
4. Whether production, enterprise, protected closeout, GitHub independent approval, tag push, desktop write authority, runtime execution, connector write, secret read, and raw source exposure all remain closed.
5. Whether the new 2026-06-15 release packet/checklist/tag draft accurately avoid launch or enterprise overclaims.

## Required Output Shape

The durable raw output should be a JSON object captured from `claude --output-format json` and normalized into `artifacts/hermes-desktop-claude-review/final-8200ed3b/review-receipt.json`.

The structured review payload must include:

- `review_status`: one of `PASS`, `PASS_WITH_FINDINGS`, `BLOCKED`
- `requested_engine`
- `observed_model`
- `base_commit`
- `prior_review_head`
- `head_commit`
- `summary`
- `findings`
- `prior_findings_verification`
- `validation_observed`
- `residual_risks`
- `authority_boundary`

## Boundary

This review cannot approve:

- production launch;
- production PASS;
- enterprise PASS;
- enterprise trust;
- protected closeout;
- GitHub independent approval;
- tag creation;
- tag push;
- GitHub Release publication;
- desktop write authority;
- deployment authorization.
