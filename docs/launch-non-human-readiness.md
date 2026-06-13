# Launch Non-Human Readiness

Status: Codex-executable launch readiness plan. This is not human approval, release approval, production PASS, enterprise PASS, deployment authorization, or protected closeout.

`platform:launch-non-human-readiness` creates the launch plan for work Codex can complete before human approval. It consumes the existing release, factory, Stage6/7, Work OS UI, and Amplitude UI evidence artifacts and emits a single read-only plan that separates:

- human-only approval blockers
- non-human workstreams Codex may continue
- CI runtime upgrade rows for Node 24-capable GitHub Actions
- PR review packet rows
- release readiness gap rows
- UI productization rows
- gate readiness cross-reference rows
- next-work queue rows
- commands that can be run in check mode
- authority flags that must remain closed
- detailed execution rows for the remaining pre-approval work

## Command

```bash
npm run platform:launch-non-human-readiness
npm run platform:launch-non-human-readiness -- --check
```

Outputs are written under:

```text
artifacts/launch-non-human-readiness/latest
```

## Human Approval Exclusions

The following are explicitly excluded from Codex execution:

| Exclusion | Reason |
|---|---|
| Human owner adjudication | protected closeout requires owner decision |
| Final release approval | release approval cannot be self-issued by Codex |
| Signed provenance receipt | signature or attestation must come from the authorized signer |
| Production PASS / enterprise trust | requires protected approval and independent trust evidence |

Codex may prepare packets, validation evidence, UI/API surfaces, and review prompts. Codex must not mark these rows approved.

## Non-Human Workstreams

| Workstream | Codex Work |
|---|---|
| `ui.product_shell` | Bind the read-only Work OS shell to the Global Operator Console model, Korean/English selector, Korean typography contract, and browser smoke rows. |
| `factory.g_series_contracts` | Preserve G1b/G2/G3 source evidence while keeping repo write, command execution, and deployment authority closed. |
| `factory.stage6_stage7_contracts` | Preserve Stage6/Stage7 contract development evidence while keeping runtime and staging deployment closed. |
| `release.evidence_packet` | Keep release candidate, migration, rollback, incident, and production-checklist rows visible without marking client-facing readiness. |
| `release.review_packet_prep` | Prepare independent review packet material and adjudication templates without treating review as human approval. |
| `ci.pr_observability` | Keep local validation and PR/CI status visible while preserving the review-required state. |

## Added Testable Units

| Row Collection | Purpose |
|---|---|
| `ci_runtime_upgrade_rows` | Verifies `actions/checkout`, `actions/setup-node`, and `actions/upload-artifact` are on Node 24-capable majors. |
| `pr_review_packet_rows` | Records the review scope, authority boundary, evidence matrix, finding loop, CI status, and human blockers without claiming approval. |
| `release_readiness_gap_rows` | Splits remaining gaps into human/external blockers and non-human closed gaps. |
| `ui_productization_rows` | Records the locale selector, Korean typography, Global Operator Queue, Review Evidence Trace, and Launch Readiness Console. |
| `gate_readiness_cross_ref_rows` | Binds G1b, G2, G3, Stage6, Stage7, and release control readiness evidence to still-closed authority flags. |
| `next_work_queue_rows` | Summarizes the executable queue for CI cleanup, review packet refresh, gap report, UI productization, gate refs, and validation. |

## Boundary

The plan is valid only while these flags remain closed:

- `release_approval_allowed_now: false`
- `deployment_allowed_now: false`
- `protected_action_allowed_now: false`
- `runtime_authority_open_now: false`
- `production_pass_enabled: false`
- `enterprise_pass_enabled: false`
- `codex_final_approval_allowed: false`

The artifact is useful exactly because it lets Codex keep building without pretending that human approval happened.

## Validation Scope

The non-human closeout path is valid only when:

- Node 20 GitHub Actions annotations are addressed by Node 24-capable action majors.
- The PR review packet is prepared but not marked approved.
- Release gaps are classified honestly.
- UI productization remains read-only and does not expose protected action controls.
- Gate readiness evidence is complete while real gate opening remains blocked.
- The next-work queue contains only Codex-executable, non-human work.
