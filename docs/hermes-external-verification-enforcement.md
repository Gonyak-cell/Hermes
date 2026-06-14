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
| `artifacts/platform-external-verification-enforcement/review/single-owner-exception-receipt.json` | Single-owner exception evidence when GitHub independent approval is structurally unavailable |

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
  --human-adjudication-template artifacts/platform-external-verification-enforcement/review/human-adjudication-input.json
```

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

The template command only writes a draft. Empty decisions are intentionally not
valid receipt evidence and must remain blocked until a human owner completes
every finding decision.

### Single-Owner Mode

If the repository is owned and authored by the same individual account, GitHub
does not allow the pull request author to approve their own pull request. Hermes
must not treat admin bypass, relaxed branch protection, or self-approval failure
as an independent GitHub review.

In that case, the live evidence command writes:

```text
artifacts/platform-external-verification-enforcement/review/single-owner-exception-receipt.json
```

The receipt may become `observed` only when:

- branch protection still requires at least one approving review
- the PR review query is available
- the PR author matches the user repository owner
- `pull_request_review_completed_now = false`
- `independent_github_review_completed_now = false`
- `enterprise_trust_claim_allowed_now = false`

This receipt opens only a lower-trust signal:

```text
single_owner_merge_readiness_now = true
```

It does not satisfy:

```text
pull_request_review_completed_now
independent_github_review_completed_now
independent_review_completed_now
p3680_external_controls_complete
enterprise_trust_claim_allowed_now
```

Single-owner readiness means the human owner can proceed with a consciously
lower-trust merge path after CI, signed attestation, Claude review, and human
adjudication are all observed. It is not an enterprise-ready independent review.

## P3841-P4000 Review Process Upgrade

`P3841-P4000` productizes the Codex-primary, Claude-independent, human-authority
review process instead of relying on ad hoc prompts.

| Range | Slice | Goal |
|---|---|---|
| `P3841-P3860` | Role Authority Contract | Codex is primary developer, Claude Code is independent reviewer, human owner is final authority |
| `P3861-P3880` | Work Intake Spec | Capture purpose, success criteria, non-goals, forbidden areas, risk tier, test bar, rollback needs |
| `P3881-P3900` | Codex Plan-Only Lane | Codex submits related files, change candidates, non-change targets, test plan, risk points, split recommendation without editing files |
| `P3901-P3920` | Claude Plan Review Lane | Claude reviews Codex's plan as `proceed`, `revise`, or `block` before implementation |
| `P3921-P3940` | Codex Implementation Packet | Codex implementation must include changed files, reasons, tests, failures, risks, PR description, rollback notes |
| `P3941-P3960` | Codex Self-Review Non-Authority | Codex self-review removes obvious noise but cannot approve or complete a gate |
| `P3961-P3970` | Claude Multi-Pass Review | Claude passes are split into full-context, security, test, migration, fix verification, and regression review |
| `P3971-P3980` | Finding Fix Loop | Codex applies minimal fixes; Claude verifies fixed, partially fixed, not fixed, or false positive |
| `P3981-P3990` | PR Type Policy | Feature, bugfix, refactor, security/auth, dependency, and large AI-generated PRs use different evidence bars |
| `P3991-P4000` | Review Instruction Freeze | `AGENTS.md`, `CLAUDE.md`, `REVIEW.md`, prompt templates, PR description contract, and single-owner mode policy freeze |

### P3841-P3860 Role Authority Contract

The first P4000 slice is implemented by:

```text
npm run platform:review-authority-contract -- --check
```

The command writes deterministic authority evidence to:

```text
artifacts/platform-review-authority-contract/latest/
```

It freezes these authority boundaries:

- `actor.codex.primary_developer` can plan and implement, but cannot finally
  approve, self-approve, or complete enterprise trust.
- `actor.claude_code.opus_max_reviewer` can review findings, but cannot mutate
  source, replace human adjudication, or finally approve.
- `actor.human.owner_adjudicator` can make final adjudication, but still cannot
  turn single-owner mode into enterprise independent review.
- `actor.github.independent_reviewer` is the only role that can satisfy the
  independent GitHub review portion of enterprise trust when observed.
- `actor.github.single_owner_exception` can expose lower-trust merge readiness,
  but cannot complete independent GitHub review or enterprise trust.

### P3861-P4000 Review Process Upgrade

The remaining P4000 slices are implemented by:

```text
npm run platform:review-process-upgrade -- --check
```

The command writes deterministic process evidence to:

```text
artifacts/platform-review-process-upgrade/latest/
```

It freezes the work intake fields, Codex plan-only lane, Claude plan review
lane, Codex implementation packet, Codex self-review non-authority rule, Claude
multi-pass review modes, finding fix loop, PR type policy, and instruction
sources (`AGENTS.md`, `CLAUDE.md`, `REVIEW.md`, prompt templates, and PR
template).

The invariant is:

```text
Codex-created implementation cannot be finally approved by Codex.
Claude review cannot replace human adjudication.
Single-owner exception cannot replace independent GitHub approval for enterprise trust.
```

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
