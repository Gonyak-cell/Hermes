# FB.3 Claude Opus Max Invalid Attempt 001

Status: invalid, not review evidence.
Date: 2026-06-11

## Command Contract Used

```bash
claude --model opus --effort max --tools "" --no-session-persistence --output-format json -p "$REVIEW_PROMPT" \
  | tee artifacts/factory-promotion/fb3-review/claude-opus-max-review.raw.json
```

## Raw Artifact

- Raw artifact: `artifacts/factory-promotion/fb3-review/claude-opus-max-review.raw.json`
- Prompt artifact: `artifacts/factory-promotion/fb3-review/claude-opus-max-review.prompt.md`
- Raw SHA-256: `e64428b28cef073c580595e88d30c9737ca21651d563ad38c0c88731cf912245`
- Prompt SHA-256: `a17c7b9c27e80e5c89fddd6c9e65797d239ac81c16c0a9a5e8764e6a7c9e77b3`
- Session id: `2cdf8ca1-2315-4d16-9336-24075ef2c74e`
- Result uuid: `1027082c-efbb-40cb-b469-ca5fd16a4f95`

## Rejection Reason

The raw output was valid JSON but was not a review verdict:

- `is_error: true`
- `api_error_status: 429`
- result: extra usage exhausted, reset at `12:40am (Asia/Seoul)`
- no embedded review verdict
- no blocking/non-blocking finding adjudication

This attempt must not be cited as independent review evidence and must be
superseded by a later valid Opus Max raw artifact before FB.3 can be committed
under the current review policy.

## Deterministic Evidence Validation

Validator command:

```bash
npm run factory:claude-review-evidence -- \
  --review-id fb3-opus-max-invalid-attempt-001 \
  --program-range FCORE-FB.3 \
  --raw-review artifacts/factory-promotion/fb3-review/claude-opus-max-review.raw.json \
  --prompt artifacts/factory-promotion/fb3-review/claude-opus-max-review.prompt.md \
  --out-dir artifacts/factory-promotion/fb3-review/invalid-attempt-001-validation
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
