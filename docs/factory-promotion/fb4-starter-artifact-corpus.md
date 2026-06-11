# FB.4 Starter Artifact Corpus

Status: ready after Law Firm OS-style Claude Opus 4.8 max review.
Date: 2026-06-11

## Scope

FB.4 materializes the starter artifact corpus required before candidate
instantiation:

```bash
npm run factory:starter-artifacts -- --check --require-pass
node scripts/review-api.mjs --once /api/factory/starter-artifacts
```

The corpus combines:

- template refs declared by `packs/*/pack.json`
- factory candidate refs for law-firm, personal-dev, platform, human-resources,
  connector, and trading packs
- tracked starter files under `templates/`

## Boundary

FB.4 is still read-only at runtime. It validates tracked starter files and binds
them by SHA-256, but it does not create products, append ledgers, advance PS
state, write candidate manifests, apply diffs, call connectors, deploy, or grant
production/enterprise trust.

Review API rows intentionally omit host-local `resolved_path` values. The
internal corpus artifact may retain them for deterministic local debugging, but
the read-only API surface only exposes stable artifact ids, template paths,
hashes, status, and authority flags.

These remain false:

- `source_file_write_allowed_now`
- `ledger_append_allowed_now`
- `ps3_transition_append_allowed_now`
- `candidate_manifest_write_allowed_now`
- `apply_allowed_now`
- all project/repo/connector/deploy/protected-action/production/enterprise
  authority flags

## Negative Fixtures

The executable missing-template fixture runs the corpus/resolver against an
empty template root. It must block with missing starter artifacts and produce 0
candidate manifests.

The regression suite also blocks unsafe template paths, sensitive marker
templates, and malformed JSON starter templates.

Mutation methods on `/api/factory/starter-artifacts` return
`405 method_not_allowed`.

## Review Receipt

FB.4 was reviewed with the Law Firm OS closeout pattern:

- model: `claude-opus-4-8`
- effort: `max`
- tools: `Read,Grep,Glob`
- permission mode: `dontAsk`
- prompt shape: compact repo-local review request plus JSON schema, not full
  source pasted over stdin
- verdict: `PASS_WITH_FINDINGS`
- P0/P1 blockers: 0
- P2 findings: fixed in this tranche

The resolver keeps `FCORE-FB.3` / `.fb3` candidate manifest identity because
FB.4 extends the FB.3 resolver by materializing starter artifacts before
candidate instantiation; it does not rename the resolver capability.

## Verification

```bash
node --check src/factory-starter-artifact-catalog.mjs
node --check src/factory-starter-artifact-corpus.mjs
node --check scripts/factory-starter-artifact-corpus.mjs
node --check src/factory-candidate-manifest-resolver.mjs
node --check src/review-api.mjs
node --test test/factory-starter-artifact-corpus.test.mjs test/factory-candidate-manifest-resolver.test.mjs
npm run factory:starter-artifacts -- --check --require-pass
npm run factory:candidate-manifests -- --check --require-pass
npm run api:smoke
npm run contracts:validate -- --check
git diff --check
```

Expected local result:

- starter corpus command: 19 required refs, 19 materialized, 0 missing
- targeted FB.4/FB.3 tests: 16/16 pass
- Review API smoke: pass
- contracts validation: 214/214 pass
