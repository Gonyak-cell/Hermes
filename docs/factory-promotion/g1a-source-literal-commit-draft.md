# G1a Source-Literal Commit Draft

Status: DRAFT / implemented read-only surface.

`factory:g1a-source-literal-commit-draft` is the reviewable draft layer between
G1a source-literal preflight and any future isolated source commit. It turns a
signed, scoped owner receipt into a single-file patch artifact for
`src/factory-gate-opening-readiness.mjs`, but it never applies that patch.

Default current state is `waiting_for_signed_g1a_owner_receipt`. This is
intentional. The default owner receipt is still unsigned, so the command writes a
safe waiting artifact with no source mutation, no patch application, no first-use
audit, and no G1a opening.

In the waiting state, replacement rows and forbidden-symbol comparison rows are
explicitly marked as template-only/waiting. They must not be read as a real patch
comparison until a signed owner receipt makes source-literal preflight ready.

When a signed owner receipt path is provided and
`factory:g1a-source-literal-preflight` is ready, the command produces:

- `source-literal-opening.patch`
- `source-literal-commit-patch.json`
- `source-literal-commit-draft-rows.json`
- `verification-command-rows.json`
- `independent-review-packet.json`
- `review-request.json`
- `review-schema.json`

The patch is constrained to one target file and two required replacements:

1. `SOURCE_LITERAL_GATE_OPEN_COMMITS.G1a` from `false` to `true`.
2. `SOURCE_LITERAL_GATE_OPENING_RECEIPTS` from an empty array to exactly one
   owner receipt binding.

The draft verifies that G1b, G2, G3, connector, deployment, production, and
enterprise trust symbols remain unchanged. The patch artifact can be checked
with `git apply --check`, but this command does not run apply, does not edit
source, does not sign an owner receipt, does not perform first use, and does not
open `project_creation`.

## Commands

```bash
npm run factory:g1a-source-literal-commit-draft -- --check
npm run factory:g1a-source-literal-commit-draft -- --owner-receipt-path <signed-owner-receipt.json> --check --require-pass
node scripts/review-api.mjs --once /api/factory/g1a-source-literal-commit-draft
```

## Authority Boundary

- `patch_applied_now=false`
- `source_mutation_allowed_now=false`
- `source_literal_opening_commit_applied_now=false`
- `first_use_audit_present=false`
- `g1a_project_creation_gate_open_now=false`
- `project_creation_allowed_now=false`
- `production_pass_enabled=false`
- `enterprise_pass_enabled=false`

The layer is evidence for a future owner-reviewed isolated source-literal commit
only. It is not the commit and is not owner adjudication.
