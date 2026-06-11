# FB.3 Claude Opus Max Invalid Attempt 002

Status: invalid, not review evidence.
Date: 2026-06-11

## Command Contract Used

```bash
claude --model opus --effort max --tools "" --no-session-persistence --output-format json \
  -p "$(cat artifacts/factory-promotion/fb3-review/claude-opus-max-final.prompt.md)" \
  | tee artifacts/factory-promotion/fb3-review/claude-opus-max-final.raw.json
```

## Raw Artifact

- Raw artifact: `artifacts/factory-promotion/fb3-review/claude-opus-max-final.raw.json`
- Prompt artifact: `artifacts/factory-promotion/fb3-review/claude-opus-max-final.prompt.md`
- Raw SHA-256: `c7f78843916453844152fc30ab836011a8bf0ceee013d8f7a7710ea3017b4008`
- Prompt SHA-256: `4ffe135d305fc4359e506cacb3e011d0893839cc85d3bbfbbc592e542f606e5f`
- Session id: `9a9e3154-54d3-468e-91d1-e7091d912b62`
- Result uuid: `1e66a221-226a-4db7-9f82-04b0f68bd930`

## Rejection Reason

The raw output was valid JSON but was not a review verdict:

- `is_error: true`
- `api_error_status: 429`
- result: extra usage exhausted, reset at `12:40am (Asia/Seoul)`
- no embedded review verdict
- no blocking/non-blocking finding adjudication

## Deterministic Evidence Validation

Validator command:

```bash
npm run factory:claude-review-evidence -- \
  --review-id fb3-opus-max-invalid-attempt-002 \
  --program-range FCORE-FB.3 \
  --raw-review artifacts/factory-promotion/fb3-review/claude-opus-max-final.raw.json \
  --prompt artifacts/factory-promotion/fb3-review/claude-opus-max-final.prompt.md \
  --out-dir artifacts/factory-promotion/fb3-review/invalid-attempt-002-validation
```

Validator status:

- evidence status: `invalid_not_review_evidence`
- evidence valid: `false`
- validation errors: `6`
- invalid reasons:
  - `raw.wrapper_success`
  - `raw.not_quota_limited`
  - `raw.model_usage_observed`
  - `payload.extracted`
  - `payload.verdict_present`
  - `payload.blocking_findings_array`

This attempt must not be cited as independent review evidence.
