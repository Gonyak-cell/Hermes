# Development Control Console

Program: `P4601-P5000`

This program turns the P4001-P4600 source and improvement layers into the first durable development operating surface. The console is not a chat window and not a KPI dashboard. It is the Harness source of truth for plans, phases, gates, evidence, review process state, milestone review receipts, and next actions.

## Operating Contract

```text
Codex = primary developer
Harness = deterministic validator and source of truth
Claude Code Opus max = independent reviewer
human adjudication = excluded from the current milestone gate
single-owner + Claude-reviewed = lower trust, not enterprise trust
```

The current P8000 process intentionally excludes human adjudication. That means protected closeout, protected final decisions, and enterprise-trust claims remain disabled even when Claude review passes.

## Required Review Process

Every major milestone from `P5000` through `P8000` uses this process:

```text
Codex implementation packet
Harness deterministic validation
Claude Code Opus max independent review
Finding loop and revalidation
Review receipt registration
Single-owner trust classification
```

Claude review receipts must record scope, model alias or resolved model id when available, findings, limitations, evidence refs, and whether the review completed. A partial, hung, or lost-output Claude run is not a completed receipt.

## Phase Scope

| Range | Name | Buildout |
|---|---|---|
| `P4601-P4640` | Plan Registry | Register the full P4001-P8000 plan as rows with source citations, review process refs, and next milestone gates |
| `P4641-P4680` | Goal Cards and Engine Role Setup | Bind active goals to Codex, Harness, and Claude roles |
| `P4681-P4720` | Phase Progress Board | Show phase status lanes with gate and evidence refs |
| `P4721-P4760` | Gate and Evidence Cards | Show why a phase can move or why it is blocked |
| `P4761-P4800` | Review Process Lane | Display Codex/Harness/Claude steps and receipt requirements |
| `P4801-P4840` | Transcript and Source Links | Link Codex and Claude conversation sources without exposing raw transcript bodies by default |
| `P4841-P4880` | Next Action Queue | Show the next command, packet, review, receipt, or revalidation action |
| `P4881-P4920` | Milestone Claude Review Packet | Prepare required Claude review gate rows for P5000, P5400, P5800, P6200, P6600, P7000, P7300, P7600, P7800, and P8000 |
| `P4921-P4960` | Single-Owner Trust Classification | Show lower-trust availability and enterprise-trust BLOCK rows |
| `P4961-P5000` | Console Freeze | Freeze the console contract, summary, boundary, schema, tests, and artifacts |

## Required Components

```text
PlanRegistryRow
GoalCard
EngineRoleBadge
PhaseStatusLane
GateCard
EvidenceCard
ReviewProcessLane
ClaudeReviewReceiptCard
TranscriptSourceLink
NextActionCard
TrustTierBadge
SingleOwnerBoundaryNotice
MilestoneReviewPacketRow
```

## Safety Boundary

P5000 keeps these false:

```text
chat_system_of_record_allowed
human_adjudication_in_milestone_gate
protected_closeout_enabled
protected_final_decision_enabled
enterprise_trust_claim_enabled
raw_transcript_body_default_visible
runtime_execution_enabled
write_action_enabled
protected_action_enabled
work_os_claim_enabled
```

## Validation

```bash
npm run platform:development-control-console -- --check
```

Outputs are written under:

```text
artifacts/development-control-console/latest/
```
