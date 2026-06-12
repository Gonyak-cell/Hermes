# G1a Source-Literal Commit Draft Claude Opus 4.8 Review Receipt

Status: valid independent review evidence after deterministic normalization.

Review scope: `G-SERIES.1a.source-literal-commit-draft`

Reviewer lane: Claude Code Opus max
Model requested: `claude-opus-4-8`
Effort: `max`
Tools: `Read,Grep,Glob` only
Permission mode: `dontAsk`

## Verdict

- Verdict: `APPROVE_WITH_FINDINGS`
- Blocking findings: `0`
- Non-blocking findings: `3`
- Changes required before commit: `false`
- Final approval claimed: `false`
- Production PASS claimed: `false`
- Enterprise PASS claimed: `false`
- Source mutation claimed: `false`
- Owner signature claimed: `false`
- G1a opened: `false`

## Evidence Chain

Prompt:

- `artifacts/factory-g1a-source-literal-commit-draft/latest/review-prompt.md`
- SHA-256: `f0fae8df7c3288e737f44b02e67933a497e6b73f09815fef794b68aa911c3e15`

Substantive raw Claude wrapper:

- `artifacts/factory-g1a-source-literal-commit-draft/latest/raw-output.json`
- SHA-256: `6babc1b81341cb7ae80cefe73a8e646e9a91612cde082d5486666ccda0d5190f`
- stderr bytes: `0`
- wrapper session id: `4067f2f0-fa7d-40ea-983d-1388277604d8`
- wrapper result uuid: `afca9160-752e-4fd3-949e-e3ce50f1ad3d`
- model usage keys included `claude-opus-4-8`

Direct raw validation:

- `artifacts/factory-g1a-source-literal-commit-draft/latest/evidence-validation-direct/claude-review-evidence-validation.json`
- SHA-256: `e2b6392c594560737959f2b7ad50d52b516f265aa59e7d1d9bdbfb7526301184`
- Status: `invalid_not_review_evidence`
- Invalid reasons: `payload.extracted`, `payload.verdict_present`, `payload.blocking_findings_array`
- Reason: the Claude wrapper succeeded, but `result` contained leading prose before the JSON payload.

Normalized final raw:

- `artifacts/factory-g1a-source-literal-commit-draft/latest/raw-output-normalized-from-raw.json`
- SHA-256: `ef987eaa06eb2879dde4dcd73af7fcd4d349769b65ebdd20e7b1102a1f4ed6c1`
- Normalization: first JSON object extracted from `raw.result`; wrapper/session/modelUsage preserved.

Final evidence validation:

- `artifacts/factory-g1a-source-literal-commit-draft/latest/evidence-validation-final/claude-review-evidence-validation.json`
- SHA-256: `50a56b76d1b03e92a5c7e1018f03a376d860b1fcc4a5abbcbd9a9d0584ab3d36`
- Extracted payload: `artifacts/factory-g1a-source-literal-commit-draft/latest/evidence-validation-final/extracted-review-payload.json`
- Extracted payload SHA-256: `2046ae68e8d1198dcde21376986af9a2b80f2ce167dee8831ab5f02b1fc6aff6`
- Status: `valid_review_evidence`
- Invalid reasons: none

## Non-Blocking Findings

1. Robustness: the source-literal patch uses exact literal replacement. Current source has exactly one match for each required replacement and the implementation now fails closed unless the exact-one invariant holds.
2. Robustness: forbidden text-symbol checks compare whole-file occurrence counts. This is acceptable under the current two-replacement constraint; broadened replacement sets should use location-aware comparison.
3. Integrity: `patch_sha256` and `unified_diff_sha256` must be checked together when a real patch is available because the patch object hash intentionally omits the diff body while `unified_diff_sha256` covers it.

## Remediation Note

The prior waiting-state observability finding was remediated before this review:
replacement rows now use `template_only_waiting_for_signed_owner_receipt`,
`replacement_ready=false`, and forbidden-symbol rows use `current_verdict=wait`
until a signed owner receipt materializes the patch preview.

## Boundary

This review is not owner adjudication and is not final approval. It does not
open G1a, does not apply a source patch, does not sign an owner receipt, does
not perform first use, and does not enable production or enterprise trust.
