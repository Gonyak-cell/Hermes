# FB.3 Claude Opus Max Invalid Attempt 003 App CLI Empty Raw

Status: invalid, not review evidence.
Date: 2026-06-11

## Command Contract Used

```bash
"$HOME/Library/Application Support/Claude/claude-code/2.1.170/claude.app/Contents/MacOS/claude" \
  --model opus --effort max --tools "" --no-session-persistence --output-format json \
  -p "$(cat artifacts/factory-promotion/fb3-review/claude-opus-max-final.prompt.md)" \
  | tee artifacts/factory-promotion/fb3-review/claude-opus-max-final-app.raw.json
```

## Raw Artifact

- Raw artifact: `artifacts/factory-promotion/fb3-review/claude-opus-max-final-app.raw.json`
- Prompt artifact: `artifacts/factory-promotion/fb3-review/claude-opus-max-final.prompt.md`
- Raw SHA-256: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- Prompt SHA-256: `4ffe135d305fc4359e506cacb3e011d0893839cc85d3bbfbbc592e542f606e5f`

## Rejection Reason

The app-bundled Claude Code process remained alive with a zero-byte raw artifact
for several minutes and was stopped by the Codex lane. Because no raw JSON was
captured, this attempt is not review evidence.

## Deterministic Evidence Validation

Validator command:

```bash
npm run factory:claude-review-evidence -- \
  --review-id fb3-opus-max-invalid-attempt-003-app-cli-empty \
  --program-range FCORE-FB.3 \
  --raw-review artifacts/factory-promotion/fb3-review/claude-opus-max-final-app.raw.json \
  --prompt artifacts/factory-promotion/fb3-review/claude-opus-max-final.prompt.md \
  --out-dir artifacts/factory-promotion/fb3-review/invalid-attempt-003-app-validation
```

Validator status:

- evidence status: `invalid_not_review_evidence`
- evidence valid: `false`
- validation errors: `9`
- invalid reasons:
  - `raw.available`
  - `raw.non_empty`
  - `raw.wrapper_json_valid`
  - `raw.sha256_bound`
  - `raw.wrapper_success`
  - `raw.model_usage_observed`
  - `payload.extracted`
  - `payload.verdict_present`
  - `payload.blocking_findings_array`

This attempt must not be cited as independent review evidence.
