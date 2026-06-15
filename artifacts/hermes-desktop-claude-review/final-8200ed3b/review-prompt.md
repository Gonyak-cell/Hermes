You are the independent Claude Code read-only reviewer for the Hermes desktop RC candidate.

Requested engine label: Claude Code Opus 4.8 Ultracode xhigh.

Repository path:

```text
/Users/jws/Documents/Codex/Hermes
```

Scope:

- Base commit: `5e332b1c6327b255cf9bf418bc455b7965172658`
- Prior desktop review head: `1d98ee0d0744cd419d9762bb98f4aad90a24d362`
- Candidate head: `8200ed3b754b74900a95fe5a48875a1daf707335`
- Prior initial review receipt: `artifacts/hermes-desktop-claude-review/latest/review-receipt.json`
- Prior final review receipt: `artifacts/hermes-desktop-claude-review/final-1d98ee0d/review-receipt.json`
- Human-readable packet: `docs/claude-final-review-packet-2026-06-15.md`

You must not mutate source, stage files, commit, tag, push, publish, deploy, edit artifacts, or claim final approval. Use read-only inspection and read-only commands only.

Focus:

1. Verify all six initial findings from `artifacts/hermes-desktop-claude-review/latest/review-receipt.json` remain fixed in candidate head:
   - missing redaction for `desktop write authority enabled`;
   - symlink/realpath repository containment for preview;
   - CSP `style-src 'unsafe-inline'`;
   - dead ternaries for tag/release publish projection;
   - factory stage6/7 ordering dependency;
   - permissive CLI parser unknown flags in desktop scripts.
2. Verify both P4 notes from `artifacts/hermes-desktop-claude-review/final-1d98ee0d/review-receipt.json` are fixed in candidate head:
   - residual dead ternary in `src/desktop-read-model.mjs` projection rows;
   - `HERMES_REPO_ROOT` override not gated or documented in desktop runbook/capture flow.
3. Check for any new P0/P1/P2 issue in the desktop shell, read model, authority boundary, packaging manifest, renderer, preload, schemas, scripts, and tests.
4. Check that the release decision packet, production checklist, and tag draft do not overclaim production PASS, enterprise PASS, protected closeout, GitHub independent approval, tag push, GitHub Release publication, desktop write authority, runtime execution, connector write, secret read, raw source exposure, or deployment authorization.
5. Confirm that local validation evidence listed below is consistent with the code and does not imply authority beyond local readiness:
   - `git diff --check`: pass
   - `npm audit --prefix apps/desktop`: found 0 vulnerabilities before candidate hardening
   - `npm run test:desktop`: 19 pass / 0 fail
   - `node --test test/desktop-read-model.test.mjs`: 7 pass / 0 fail
   - `npm run desktop:local-preflight`: pass
   - `npm run validate:core`: pass
   - `npm run release:candidate -- --check`: pass
   - `npm run release:freeze -- --check`: pass
   - `npm run platform:release-readiness-control-plane -- --check`: pass, deployment allowed false
   - `npm run platform:release-bundle-provenance -- --check`: pass
   - `npm run platform:launch-non-human-readiness -- --check`: pass, authority flags closed
   - `npm run platform:release-check -- --check`: optional umbrella run was interrupted after a long-running `project:zendd-active-operator-dashboard --check` substep, so do not treat it as passing.

Return structured JSON only, matching the supplied JSON schema. Use:

- `review_status`: `PASS` only if no P0/P1/P2 finding remains; `PASS_WITH_FINDINGS` for non-blocking findings; `BLOCKED` for any P0/P1/P2 or invalid review conditions.
- `requested_engine`: exactly `Claude Code Opus 4.8 Ultracode xhigh`
- `observed_model`: the actual model you used if visible.
- `base_commit`: `5e332b1c6327b255cf9bf418bc455b7965172658`
- `prior_review_head`: `1d98ee0d0744cd419d9762bb98f4aad90a24d362`
- `head_commit`: `8200ed3b754b74900a95fe5a48875a1daf707335`

The `authority_boundary` booleans must all remain false:

- production_pass
- enterprise_pass
- protected_closeout
- deployment_authorization
- github_independent_approval
- desktop_write_authority
- tag_push_authorization
- release_publication_authorization

Do not include markdown fences. Return one JSON object.
