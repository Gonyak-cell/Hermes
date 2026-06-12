# G1a Owner Candidate Selection Docket Claude Opus 4.8 Review Receipt

Status: valid review evidence

Scope: `G-SERIES.1a.owner-candidate-selection-docket`

Reviewer lane: Claude Code Opus Max, model `claude-opus-4-8`, effort `max`

## Result

- Verdict: `APPROVE_WITH_FINDINGS`
- Blocking findings: 0
- Nonblocking findings: 2
- Changes required before commit: false
- Final approval claimed: false
- Production PASS claimed: false
- Enterprise PASS claimed: false
- Source mutation claimed: false
- Owner signature claimed: false
- Owner selection claimed: false

## Law Firm OS-Style Receipt Chain

1. Auth/model preflight succeeded and was not counted as review evidence.
2. One canonical read-only Opus Max review run was executed with `Read,Grep,Glob`.
3. The raw output was stored at
   `artifacts/factory-g1a-owner-candidate-selection-docket/latest/raw-output.json`.
4. Direct validation of that raw output was invalid because the result contained
   leading prose before the JSON payload. This invalid attempt is preserved at
   `artifacts/factory-g1a-owner-candidate-selection-docket/latest/evidence-validation/`.
5. The JSON payload was deterministically extracted into
   `artifacts/factory-g1a-owner-candidate-selection-docket/latest/raw-output-normalized-from-raw.json`.
6. Final evidence validation passed at
   `artifacts/factory-g1a-owner-candidate-selection-docket/latest/evidence-validation-final/`.

## Artifact Hashes

- Raw output SHA-256:
  `26b6ea8df7d0b038cc36bf82aa78566002ee2df94b6f9e10980592538bfffaff`
- Normalized raw output SHA-256:
  `2ac686a444f1167bb07feedada812f91883a70ff1769a9c2164e98ac2834af08`
- Prompt SHA-256:
  `337c40f285d4daa63f8601c7987297c4b425c97d13628b11bfb7b2fb202de576`
- Direct invalid validation SHA-256:
  `1cac1b6d15778ad7d5f74c92923c162be47788e134944fcc78cff755df3ac792`
- Final evidence validation SHA-256:
  `a8014869efd3855d4368a9b967feb8af932c739722e3c27aa866d27af78c2f60`
- Extracted review payload SHA-256:
  `9f9ce0a2ed4e6a4397a03c68f3485c6fc7fa437af1fb8cff80ab8642d46745bd`

## Validation Command

```bash
npm run factory:claude-review-evidence -- --review-id g1a-owner-candidate-selection-docket-opus-4-8-lawos-style-final --program-range G-SERIES.1a.owner-candidate-selection-docket --raw-review artifacts/factory-g1a-owner-candidate-selection-docket/latest/raw-output-normalized-from-raw.json --prompt artifacts/factory-g1a-owner-candidate-selection-docket/latest/review-prompt.md --out-dir artifacts/factory-g1a-owner-candidate-selection-docket/latest/evidence-validation-final --check --require-valid
```

## Nonblocking Findings

1. Selection binding currently computes row selection from hash equality and
   relies on the all-rows-eligible validation invariant for mixed eligibility
   safety. Suggested future tightening: gate `selected_now` on row eligibility
   directly if mixed eligible/ineligible rows are ever allowed.
2. `selection_policy` echoes both packet and manifest hashes from the selected
   row. Suggested future clarity change: add or surface the selected hash kind
   so readers do not confuse the row's companion hash with the explicit owner
   selection key.

## Boundary

This review is independent review evidence only. It is not owner adjudication,
not protected closeout, not production readiness, not enterprise trust, and not
permission to open G1a. Human owner selection and signed owner receipt remain
required before any source-literal opening path can proceed.
