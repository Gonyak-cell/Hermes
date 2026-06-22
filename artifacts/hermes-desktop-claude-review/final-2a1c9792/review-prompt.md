You are the independent Claude Code read-only reviewer for the Hermes desktop RC evidence packet.

Requested engine label: Claude Code Opus 4.8 Ultracode xhigh.

Repository path:

```text
/Users/jws/Documents/Codex/Hermes
```

Scope:

- Base commit: `5e332b1c6327b255cf9bf418bc455b7965172658`
- Prior review head: `8200ed3b754b74900a95fe5a48875a1daf707335`
- Candidate/evidence packet head: `2a1c9792fc162c5904d6c68eb9a32b3a3efc51bc`
- Prior P4 closure receipt: `artifacts/hermes-desktop-claude-review/final-8200ed3b/review-receipt.json`
- Release decision packet: `docs/release-decision-packet-2026-06-15.md`
- Production checklist: `docs/production-launch-checklist-2026-06-15.md`
- Release note/tag draft: `docs/release-note-tag-draft-2026-06-15.md`

You must not mutate source, stage files, commit, tag, push, publish, deploy, edit artifacts, or claim final approval. Use read-only inspection and read-only commands only.

Focus:

1. Verify the two P4 fixes from candidate `8200ed3b754b74900a95fe5a48875a1daf707335` are still present:
   - `src/desktop-read-model.mjs` projection row authority is hardcoded false without a dead ternary.
   - `HERMES_REPO_ROOT` is gated through `apps/desktop/src/main/repo-root.mjs` and documented in `docs/hermes-desktop-local-launch-runbook-2026-06-14.md`, with `apps/desktop/scripts/capture-render.mjs` using the same resolver.
2. Verify the P3 document-pointer drift reported in `artifacts/hermes-desktop-claude-review/final-8200ed3b/review-receipt.json` is resolved:
   - the release decision packet, production checklist, and release-note/tag draft now use `8200ed3b754b74900a95fe5a48875a1daf707335` as the desktop code candidate;
   - any remaining `1d98ee0d` references are clearly historical review or prior full-suite evidence, not the active candidate/tag target.
3. Check for any new P0/P1/P2 issue in the desktop shell, read model, authority boundary, packaging manifest, renderer, preload, scripts, tests, or release docs.
4. Check that the release docs do not overclaim production PASS, enterprise PASS, protected closeout, GitHub independent approval, tag push, GitHub Release publication, desktop write authority, runtime execution, connector write, secret read, raw source exposure, or deployment authorization.
5. Treat `npm run platform:release-check -- --check` as not passing because it was interrupted after a long-running `project:zendd-active-operator-dashboard --check` substep.

Return structured JSON only, matching the supplied JSON schema. Use:

- `review_status`: `PASS` only if no P0/P1/P2/P3 finding remains; `PASS_WITH_FINDINGS` for non-blocking P4 findings; `BLOCKED` for any P0/P1/P2/P3 or invalid review conditions.
- `requested_engine`: exactly `Claude Code Opus 4.8 Ultracode xhigh`
- `observed_model`: the actual model you used if visible.
- `base_commit`: `5e332b1c6327b255cf9bf418bc455b7965172658`
- `prior_review_head`: `8200ed3b754b74900a95fe5a48875a1daf707335`
- `head_commit`: `2a1c9792fc162c5904d6c68eb9a32b3a3efc51bc`

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
