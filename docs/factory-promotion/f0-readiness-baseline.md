# F0 Readiness Baseline

Status: F0 kickoff baseline after S0 owner adjudication, not gate approval.
Date: 2026-06-11

## Purpose

This file records the first Codex-side F0 kickoff check after the v0.1.2 package corrections and S0 owner adjudication.

FA implementation is still blocked. The package can proceed only through receipt request packets, receipt integrity preflight tooling, source handoff visibility work, and read-only blocker reporting until F0.1/F0.2 are mechanically satisfied or explicitly represented as visible waivers.

## S0 Owner Adjudication

S0 owner adjudication is complete as of 2026-06-11 and is recorded in
[s0-owner-adjudication-receipt.json](s0-owner-adjudication-receipt.json).

| Decision | Disposition |
|---|---|
| S0-1 | A then B: actual Opus-family independent receipts now; multi-engine receipt validation in FD |
| S0-2 | Corrective-baseline waiver: FCORE may repair the blocked P-chain without hiding blockers or opening authority |
| S0-3 | HRM-01/03/04 stay open; FCORE adopts review-depth/window/evidence caps |
| S0-4 | Backlog merge governance becomes Hermes dogfooding pilot |
| S0-5 | Factory now, product later; FCORE is canonical for new work |

## Local Checks Run

```bash
npm run platform:multi-engine-orchestration -- --check
npm run factory:f0-review-request-doctor -- --check
npm run factory:f0-review-dispatch-packet -- --check
npm run factory:receipt-preflight -- --check
npm run factory:f0-review-receipt-intake -- --help
npm run platform:saas-factory-mode -- --check
npm run factory:promotion-f0-gate -- --check
npm run platform:connector-external-app-governance -- --check
npm run platform:execution-write-authority-maturity -- --check
npm run platform:security-compliance-maturity -- --check
npm run platform:product-ops-automation -- --check
npm run platform:observability-cost-plane -- --check
npm run platform:enterprise-trust-hardening-control-plane -- --check
npm run platform:release-readiness-control-plane -- --check
npm run platform:human-owner-adjudication-option -- --check
npm run platform:patch-candidate-lane -- --check
npm run platform:controlled-execution-sandbox -- --check
npm run platform:domain-pack-sdk-v2 -- --check
npm run platform:saas-quality-gate-packs -- --check
npm run platform:global-ui-governance-freeze -- --check
```

All checked commands completed with validation errors 0 while preserving visible blocked status.

Current F0-specific outputs after Codex implementation:

| Command | Status | Key point |
|---|---|---|
| `npm run factory:f0-review-request-doctor -- --check` | `ready_f0_review_request_doctor` | request packet hashes and target paths are current; packets remain not evidence |
| `npm run factory:f0-review-dispatch-packet -- --check --require-pass` | `ready_f0_review_dispatch_packet` | request doctor true, reviewed commit SHA bound by live dispatch output, worktree clean true, validation errors 0 |
| `npm run factory:receipt-preflight -- --check` | `blocked_f0_1_receipt_preflight` | owner receipt visible, target receipts passed 0/2, validation errors 0 |
| `npm run factory:f0-review-receipt-intake -- --help` | help text available | raw Opus output to receipt normalization path is implemented; failed Claude CLI JSON, request packets, Fable output, and label-only model ids remain blocked |
| `npm run platform:saas-factory-mode -- --check` | `blocked_saas_factory_mode` | source handoff false, F0.2 visible waiver true, P15401 handoff false |
| `npm run factory:promotion-f0-gate -- --check` | `blocked_factory_promotion_f0_gate` | F0 rows passed 4/5, F0.1 false, F0.2 true, FA implementation allowed false, validation errors 0 |

## F0 Aggregate Gate

`factory:promotion-f0-gate` is the current machine gate for FA implementation. It composes:

- S0 owner adjudication receipt and expected S0-1~S0-5 dispositions
- F0.1 receipt-integrity preflight
- F0.2 source handoff or owner-adjudicated visible waiver
- closed authority boundary

Current live result:

```text
Status: blocked_factory_promotion_f0_gate
F0 phase pass count: 4/5
F0.1 receipt preflight passed: false
F0.2 source handoff or visible waiver: true
FA implementation allowed: false
Validation errors: 0
```

Before external Opus review dispatch, `factory:f0-review-dispatch-packet -- --check --require-pass` must pass. The exact reviewed commit SHA must be taken from the live command output or `artifacts/factory-f0-review-dispatch-packet/latest/dispatch-packet.json`, not hard-coded into this tracked document.

FA implementation may start only when:

```bash
npm run factory:promotion-f0-gate -- --check --require-pass
```

passes against current repo state.

## F0.1 Status

F0.1 remains blocked.

Missing review receipts:

- `artifacts/connector-external-app-governance/review/claude-connector-governance-review-receipt.json`
- `artifacts/execution-write-authority-maturity/review/claude-execution-write-authority-review-receipt.json`

Acceptance condition:

- both receipts must satisfy the current validator shape
- both receipts must pass [f0-receipt-integrity-preflight.md](f0-receipt-integrity-preflight.md)
- reviewer engine must match the actual resolved model id
- the Fable planning session that authored this package cannot be used as the independent implementation reviewer

Known local limitation:

- Claude CLI Opus access is authenticated and the resolved model family was observed as `claude-opus-4-7`.
- A real connector-governance review attempt on 2026-06-11T18:43 KST failed with `api_error_status: 429` and message `You're out of extra usage · resets 7:40pm (Asia/Seoul)`.
- That failed raw JSON is not a valid review receipt. `factory:f0-review-receipt-intake -- --check --require-pass` blocks it through `raw_output.completed_review`.

Prepared request packets:

- [f0-review-requests/connector-external-app-governance-opus-review-request.md](f0-review-requests/connector-external-app-governance-opus-review-request.md)
- [f0-review-requests/execution-write-authority-maturity-opus-review-request.md](f0-review-requests/execution-write-authority-maturity-opus-review-request.md)
- [f0-review-requests/review-request-index.json](f0-review-requests/review-request-index.json)

These packets are not review evidence.

## F0.2 Status

F0.2 source handoff remains false, but the owner-adjudicated corrective-baseline waiver is now machine-visible and satisfies the F0.2 aggregate gate condition without opening P15401 handoff or any authority flag.

The underlying source-chain readiness cascade is still visible and still requires later remediation; the waiver only allows FCORE to repair the blocked P-chain as a corrective baseline.

Observed chain:

| Program | Status | Immediate blocker |
|---|---|---|
| P11601-P11800 `global-ui-governance-freeze` | `blocked_global_ui_governance_freeze` | Claude receipt observed: false |
| P11801-P12000 `saas-quality-gate-packs` | `blocked_saas_quality_gate_packs` | source ready for P11801: false |
| P12001-P12200 `domain-pack-sdk-v2` | `blocked_domain_pack_sdk_v2` | source ready for P12001: false |
| P12201-P12400 `controlled-execution-sandbox` | `blocked_controlled_execution_sandbox` | source ready for P12201: false; Claude execution review receipt: false |
| P12401-P12600 `patch-candidate-lane` | `blocked_patch_candidate_lane` | source ready for P12401: false; Claude patch review receipt: false |
| P12601-P12800 `human-owner-adjudication-option` | `blocked_human_owner_adjudication_option` | source ready for P12601: false; owner adjudication receipt: false |
| P12801-P13000 `release-readiness-control-plane` | `blocked_release_readiness_control_plane` | source ready for P12801: false; signed provenance receipt: false; Claude release review receipt: false |
| P13001-P13400 `enterprise-trust-hardening-control-plane` | `blocked_enterprise_trust_hardening_control_plane` | source ready for P13001: false; Claude enterprise trust review receipt: false |
| P13401-P13800 `observability-cost-plane` | `blocked_observability_cost_plane` | source ready for P13401: false |
| P13801-P14200 `product-ops-automation` | `blocked_product_ops_automation` | source ready for P13801: false |
| P14201-P14600 `security-compliance-maturity` | `blocked_security_compliance_maturity` | source ready for P14201: false; Claude security compliance review receipt: false |
| P14601-P15000 `multi-engine-orchestration` | `blocked_multi_engine_orchestration` | source ready for P14601: false; Claude orchestration review receipt: false |
| P15001-P15400 `saas-factory-mode` | `blocked_saas_factory_mode` | source ready for P15001: false |

## F0.2 Disposition Options

Option A: strict source-chain remediation.

- Work backward from P11601-P11800 and close each source/review receipt blocker in order.
- Highest trust, highest cost.

Option B: bounded FCORE waiver.

- Owner issues a waiver specifically for using FCORE as the corrective program despite the P11601-P15000 chain being blocked.
- The waiver must include scope, expiry, blocked rows acknowledged, and a rule that no production/enterprise/write/deploy authority opens.
- `saas-factory-mode` must continue to show the blocker visibly unless and until code explicitly supports waiver display.

Option C: split plan.

- Keep P11601-P15000 remediation as a parallel historical-roadmap cleanup.
- Start FCORE FA only for seed/local store and receipt preflight primitives after owner accepts that FCORE is a new corrective baseline rather than a continuation of the blocked P-chain.

## Current Recommendation

The owner accepted Option C as S0-2 on 2026-06-11. The waiver is now visible in `saas-factory-mode` as
`f0_2_source_handoff_or_visible_waiver_now: true`, while `source_ready_for_p15001_handoff` and
`ready_for_p15401_handoff` remain false.

Do not hand-edit generated artifact JSON to make any `ready_for_*_handoff` field true.

## Authority Boundary

This baseline does not open project creation, repo write, connector write, command execution, deployment, protected action, production PASS, enterprise PASS, or any AI final approval.
