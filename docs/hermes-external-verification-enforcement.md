# Hermes External Verification Enforcement Phase Ledger

This ledger covers `P3521-P3680`. It consumes `platform:verification-trust-activation` and moves beyond repository-local contracts into externally enforced verification controls.

## Objective

Open the enforcement plane for branch protection, required status checks, signed attestations, and independent review completion without overclaiming any control that is not observed in the current checkout.

The current reviewer policy is:

```text
reviewer_id = reviewer.claude_code.opus_max
tool = claude_code
preferred_model_alias = opus
required_reasoning_tier = max
model_selection_policy = latest_available_opus
resolved_model_id_required = true
fallback_without_human_receipt = false
final_authority = false
```

Claude Code can provide independent technical review evidence. It does not replace the human owner/adjudicator.

## Phase Slices

| Range | Slice | Goal |
|---|---|---|
| `P3521-P3540` | Reviewer Authority Registry | Register `reviewer.claude_code.opus_max` and require model resolution evidence |
| `P3541-P3560` | Confidentiality & Review Packet Gate | Classify artifacts, create blind review packets, and block unsafe external transfer |
| `P3561-P3580` | Blind Independent Review Packet | Default to Independent mode, with Adversarial/Rebuttal/Implementation as explicit modes |
| `P3581-P3600` | Claude Opus Max Review Execution | Capture Claude Code version, requested model alias, resolved model id, prompt hash, output hash |
| `P3601-P3620` | Finding Normalization & Evidence Check | Require structured findings with location, evidence, severity, risk, and confidence |
| `P3621-P3640` | Human Adjudication Receipt | Require ACCEPT / ACCEPT_WITH_MODIFICATION / REJECT / HOLD decisions by human owner |
| `P3641-P3650` | Approved Apply Lane | Apply only adjudicated findings; HOLD is never applied automatically |
| `P3651-P3660` | Post-Apply Verification | Re-run Hermes checks and preserve audit report |
| `P3661-P3670` | GitHub Enforcement Evidence | Verify branch protection, required checks, PR review, stale dismissal, and force-push policy |
| `P3671-P3680` | Signed Attestation & Enforcement Freeze | Generate and verify GitHub/Sigstore attestation evidence before enterprise trust claims |

## Guard Rules

- Workflow file presence is not branch protection.
- CI check definition is not required status check enforcement.
- Local attestation metadata is not a signed external attestation.
- Claude review packet existence is not independent review completion.
- Claude review completion is not human adjudication.
- AI reviewer PASS is not final authority.
- GitHub/Sigstore attestation proves provenance, not semantic correctness.
- Enterprise trust remains false unless branch protection, signed attestation verification, independent review, and human adjudication are all observed.

## Completion Criteria

```text
source verification trust activation ready
reviewer.claude_code.opus_max registered
Claude Code available
review packet contract ready
branch protection checked with live evidence
required status check enforcement checked with live evidence
signed attestation workflow declared
attestation verification checked with live evidence
independent review completion checked with receipt evidence
human adjudication receipt checked
all missing external controls are BLOCK with next action
enterprise trust claim allowed now = false unless all controls are observed
runtime/write/production still false
```

## Validation

Run:

```bash
npm run platform:live-external-verification-evidence -- --check
npm run platform:external-verification-enforcement -- --check
```

## P3681-P3840 Live Evidence Completion

`P3681-P3840` fills the external evidence receipts that `P3521-P3680`
intentionally left blocked when live systems were not observed. The receipt
capture order is:

| Receipt | Meaning |
|---|---|
| `artifacts/platform-external-verification-enforcement/github/remote-binding-receipt.json` | GitHub repo, branch, remote, and auth status |
| `artifacts/platform-external-verification-enforcement/github/branch-protection-receipt.json` | Branch protection or ruleset query result |
| `artifacts/platform-external-verification-enforcement/github/required-check-receipt.json` | Required status check observation |
| `artifacts/platform-external-verification-enforcement/github/actions-run-receipt.json` | CI run id, workflow conclusion, and commit SHA |
| `artifacts/platform-external-verification-enforcement/attestation/attestation-verify-receipt.json` | Signed attestation verification result |
| `artifacts/platform-external-verification-enforcement/review/claude-review-receipt.json` | Claude Code Opus max independent review evidence |
| `artifacts/platform-external-verification-enforcement/review/human-adjudication-receipt.json` | Human owner adjudication decisions |

The capture command is:

```bash
npm run platform:live-external-verification-evidence
```

Receipt files may exist while still blocked. `platform:external-verification-enforcement`
only promotes a control to observed when the corresponding receipt has
`receipt_status: observed` and the required fields for that control are present.

The intended live sequence is:

```text
gh auth login
confirm https://github.com/<owner>/<repo>.git
set or add GitHub remote
push branch
observe GitHub Actions workflow run
configure branch protection or ruleset
enforce Hermes verification trust as a required check
verify signed attestation
capture Claude Code Opus max review receipt
capture human adjudication receipt
npm run platform:live-external-verification-evidence
npm run platform:external-verification-enforcement
```

### Human Adjudication Input

Human adjudication is not inferred from a PR comment or a Claude review result.
It must be captured as an explicit owner input and then converted into a
hash-bound receipt:

```bash
npm run platform:live-external-verification-evidence -- \
  --branch main \
  --actions-branch codex/p3840-review-hardening \
  --human-adjudication-input artifacts/platform-external-verification-enforcement/review/human-adjudication-input.json
```

The input file must cover every Claude finding id from
`claude-review-receipt.json`:

```json
{
  "schema_version": "human-adjudication-input.v1",
  "adjudicator_id": "human.owner",
  "adjudicator_role": "human_owner",
  "adjudicated_at": "2026-06-04T00:00:00.000Z",
  "raw_payload_inlined": false,
  "final_authority_allowed_now": false,
  "decisions": [
    {
      "finding_id": "F-001",
      "decision": "ACCEPT_WITH_MODIFICATION",
      "rationale_summary": "Accepted with narrower implementation scope.",
      "follow_up_required": true
    },
    {
      "finding_id": "F-002",
      "decision": "HOLD",
      "owner_note": "Needs a separate review lane."
    }
  ]
}
```

Allowed decisions are `ACCEPT`, `ACCEPT_WITH_MODIFICATION`, `REJECT`, and
`HOLD`. The generated receipt stores the input file hash and hashes of rationale
or owner note fields, not the raw narrative text. Missing, duplicate, or unknown
finding ids keep the receipt at `blocked_missing_external_evidence`.

### Attestation Availability

The attestation receipt records repository visibility and owner type before
promoting signed attestation evidence. A failed `gh attestation verify` is not
enough by itself to explain the gate state.

For private or internal repositories, GitHub artifact attestations require a
GitHub Enterprise Cloud-capable lane. If the current repository is private and
verification cannot find a signed attestation, the receipt remains
`blocked_missing_external_evidence` with:

```text
attestation_support_status = blocked_private_or_internal_repository
attestation_policy_ref = github_docs.artifact_attestations.private_internal_requires_enterprise_cloud
```

The next safe actions are to move the attestation lane to a GitHub Enterprise
Cloud repository, use a public/release artifact attestation lane, or keep the
enterprise trust claim blocked.
