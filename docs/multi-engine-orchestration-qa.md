# Multi-Engine Orchestration and Cross-Model QA

Program: `P5401-P5800`

This program turns Codex, Harness, Claude Code Opus max, external evidence observers, and future reviewer models into explicit engine roles. Its purpose is to prevent a single model, one account, or one chat transcript from becoming both implementer and approver.

## Operating Contract

```text
primary engine required
reviewer engine required
planner and evidence role split required
cross-model QA packet required
model upgrade receipt required
engine conflict resolution required
reviewer no-mutation boundary required
finding loop required
one engine self-approval allowed = false
```

The current reviewer lane is `Claude Code Opus max`. A newer model may replace it only after a model upgrade receipt records the model alias or resolved model id, compatibility review, rollback model, and updated receipt evidence.

## Phase Scope

| Range | Name | Buildout |
|---|---|---|
| `P5401-P5440` | Primary Engine Selection Registry | Register Codex as primary developer, Harness as validator, Claude as reviewer, external evidence observer, and future reviewer candidate |
| `P5441-P5480` | Reviewer Engine Lane | Keep Claude Code Opus max as independent reviewer and block reviewer mutation/final approval |
| `P5481-P5520` | Planner and Evidence Role Split | Separate planner, implementer, validator, reviewer, evidence summarizer, and conflict resolver |
| `P5521-P5560` | Cross-Model QA Packet Contract | Build QA packet rows that route Codex-created work to Claude review with source and validation refs |
| `P5561-P5600` | Model Upgrade Receipt Contract | Require model upgrade receipts before changing reviewer model |
| `P5601-P5640` | Engine Conflict Resolution | Define block policies for Codex/Claude, validator/reviewer, source drift, model upgrade, and self-approval conflicts |
| `P5641-P5680` | Reviewer No-Mutation Boundary | Freeze reviewer no-mutation, no-final-approval, no-enterprise-trust, and no-human-gate-assumption boundaries |
| `P5681-P5720` | Cross-Review Finding Loop | Keep finding loop open until completed Claude review receipt, normalized findings, and revalidation exist |
| `P5721-P5760` | Multi-Engine Trust Decision Rows | Separate local contract readiness, P5800 closeout readiness, lower-trust readiness, and enterprise trust |
| `P5761-P5800` | Multi-Engine QA Freeze | Freeze schema, artifacts, tests, gates, and boundary rows |

## P5800 Boundary

These may be ready:

```text
multi_engine_orchestration_qa_ready
primary_engine_registered
reviewer_engine_registered
role_split_ready
cross_model_qa_packet_ready
model_upgrade_receipt_contract_ready
reviewer_no_mutation_boundary_ready
lower_trust_readiness_allowed
```

These stay false until actual review evidence exists:

```text
completed_cross_model_review_ready
p5800_milestone_closeout_ready
self_approval_allowed
codex_final_approval_allowed
claude_final_approval_allowed
reviewer_mutation_allowed
enterprise_trust_claim_enabled
protected_closeout_enabled
```

## Validation

```bash
npm run platform:multi-engine-orchestration-qa -- --check
```

Outputs are written under:

```text
artifacts/multi-engine-orchestration-qa/latest/
```
