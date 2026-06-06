# Hermes Long Range Roadmap P4001-P8000

This roadmap extends the post-P4000 Hermes plan with the operating-loop requirements from `Hue_Keynote.pdf`. The governing rule is:

```text
conversation < memory < hard gate < verification loop < Work OS
```

The deck does not merely say that conversation should be stored. It says the conversation, corrections, failed runs, blocked tools, review disagreements, and user pushback must become structured evidence for changing the next execution condition. A plan is not improved because the assistant says it learned; a plan is improved when the prior conversation creates a traceable rule, test, receipt, hook, reviewer lane, or plan amendment candidate.

## Fixed Premise After P4000

```text
P4000까지: review authority and single-owner lower-trust contracts are frozen
P4001-P4300: local Codex and Claude conversation sources become governed source material
P4301-P4600: conversation becomes improvement signals, not only archive
P4601-P6200: UI, verification runtime, multi-engine QA, and trust lanes become product surfaces
P6201-P8000: SaaS factory, controlled execution, memory/event/recall, governance, and Work OS freeze
```

Current boundary:

- Codex remains the primary implementation worker.
- Claude Code Opus max remains the independent review lane until superseded by a newer reviewed model choice.
- The current milestone process excludes human adjudication. Protected closeout and protected final decisions therefore remain disabled.
- Single-owner plus Claude-reviewed mode remains lower-trust readiness, not enterprise independent review.
- No Work OS production claim is allowed until closed-loop evidence, memory recall, hard hooks, reviewer lanes, and operator UI all pass.

## Milestone Review Process Contract

Every major milestone from P5000 through P8000 uses the same review process. This is the review process the UI, artifacts, validators, and roadmap must show:

```text
Codex implementation packet
Harness deterministic validation
Claude Code Opus max independent review receipt
Finding loop and revalidation
Receipt registration
Single-owner trust classification
```

Role boundaries:

| Role | Authority | Boundary |
|---|---|---|
| `Codex` | Primary developer, planner, implementer, test runner, review-packet preparer | Cannot approve Codex-created work, cannot claim enterprise trust, cannot bypass Harness gates |
| `Harness` | Deterministic validator, evidence normalizer, gate engine, trust-tier classifier | Cannot invent missing evidence, cannot treat local PASS as enterprise trust |
| `Claude Code Opus max` | Independent reviewer lane for review receipts and findings | Cannot mutate source, cannot become final approver, cannot replace protected final decision |

The milestone gate intentionally excludes human adjudication in the current P8000 plan. That means the plan can reach `single-owner + Claude-reviewed` lower-trust readiness, but protected closeout, protected final decision, enterprise trust, live production release, and Work OS production claims remain blocked unless a later plan explicitly opens a new approval lane.

## Hue-Keynote Anchors For P8000

| Anchor | P8000 consequence |
|---|---|
| Completion claim is not evidence | Every phase must keep `claim -> evidence -> reviewer -> hard_gate -> verdict -> next_allowed_action` |
| Soft instruction is not a gate | Repeated misses or high-risk rules become deterministic hooks |
| Apology is not state change | A correction must alter a condition, scaffold, receipt, rule, hook, test, or rollback path |
| Memory is not storage | Memory changes the next execution context and must cite its source |
| Prior conversation is a signal | User corrections, disagreements, and repeated confusion become improvement candidates |
| Conversation UI is not raw chat | The first P4001-P4300 surface is Conversation Source Queue, not a chat transcript viewer |
| Queue-first beats KPI theater | KPI cards are not the home surface; source, review, blocker, and next action queues come first |
| One model cannot approve itself | Codex implementation and Claude review remain separate lanes; no-human mode cannot claim protected final approval |
| PASS needs an owner | PASS requires an owner; Personal, peer, team, organization QA, and operating-system levels have different PASS owners |
| Scale is not tool cloning | Domain, goal, workflow, review role, and evidence rules must be pack-level contracts |
| Rule growth creates conflicts | Conflict, duplication, stale gates, and interaction cost become visible governance rows |
| Work OS requires L6/L7 proof | No L6 closed loop means no Work OS claim |

## Whole Roadmap

| Range | Program | Goal | Keynote integration |
|---|---|---|---|
| `P4001-P4300` | Local Conversation and Session Archive Foundation | Capture Codex conversation source, Claude Code transcript source, tool lineage, goals, plans, validations, review packets, trust boundaries, and Conversation Source Queue UI contracts as local source material | Conversation becomes governed raw transcript evidence, not vanishing chat context |
| `P4301-P4600` | Conversation Improvement Signal Mining | Convert user correction, assistant miss, blocked run, review conflict, repeated plan drift, and forgotten context into improvement signal rows | Existing conversation becomes the clue that changes rules, tests, plans, and next execution |
| `P4601-P5000` | Development Control Console and Jira-Inspired Evidence UI | Register plans, phase progress, engines, verification gates, evidence refs, review status, and next allowed actions in the Harness UI | The UI shows why work is blocked and which loop is active |
| `P5001-P5400` | Verification Orchestration Runtime | Run standard validators, dual-run checks, CI-required checks, attestation verification, and independent review completion receipts | Completion is doubted through an orchestration layer, not trusted as prose |
| `P5401-P5800` | Multi-Engine Orchestration and Cross-Model QA | Configure primary engine, reviewer engine, planner, evidence summarizer, and adjudication boundaries for Codex, Claude Code, and later model upgrades | Single-model completion cannot self-approve |
| `P5801-P6200` | Review and Enterprise Trust Hardening | Harden GitHub review lanes, single-owner exceptions, signed attestations, branch/ruleset evidence, Claude review receipts, and no-human trust boundaries | Lower-trust modes are explicit and never sold as enterprise trust |
| `P6201-P6600` | Product and Domain SaaS Factory | Use Hermes to govern multiple SaaS builds, including HR, law-firm, personal-dev, creative-document, connector/resource, and trading read-only packs | Harness governs SaaS development without becoming every SaaS product itself |
| `P6601-P7000` | Controlled Execution Write and Deploy | Prepare allowlisted execution, patch generation, receipt-gated apply candidates, deploy receipts, rollback binding, and post-apply validation while no-human mode keeps protected apply disabled | Hard hooks stop unsafe execution rather than merely warning |
| `P7001-P7300` | Memory Bank Storage Event and Observability Plane | Build append-only events, object store, source lineage, trace/audit/cost, transcript references, and goal-level observability | Memory is durable, bounded, searchable, and citation-bearing |
| `P7301-P7600` | Retrieval Ontology and Context Recall Layer | Implement Sync, Index, Search, Extract, Consolidate, Relate, Recall across projects, domains, workflows, owners, and gates | The seven-step memory lifecycle becomes the next-run context compiler |
| `P7601-P7800` | Security Governance Compliance and Rule Conflict Plane | Govern secrets, privileged data, prompt injection, domain walls, rule conflicts, stale gates, policy drift, and incident response | Rule growth becomes visible governance, not hidden fragility |
| `P7801-P8000` | Full Work OS UI and Production Freeze | Freeze L6 closed-loop proof, declare any L7 Work OS surfaces, publish handbook/API/dashboard alignment, and block unsupported trust claims | Full Work OS UI and Production Freeze must prove closed-loop operation |

## P4001-P4300 Detailed Plan

| Range | Name | Detailed goal | Hard boundary |
|---|---|---|---|
| `P4001-P4040` | Engine Conversation Source Contract | Define `conversation_source_id`, engine, project, thread, goal, commit, branch, artifact, and source boundary fields | Raw transcript is source material, not final truth |
| `P4041-P4080` | Local Transcript Archive | Store local transcript envelopes, tool-call metadata, command summaries, attachment refs, and redaction status | No raw secret, privileged, or cross-domain leakage |
| `P4081-P4120` | Codex Conversation Adapter | Capture Codex conversation source, plan changes, tool evidence, validation summaries, and final answer refs | Codex cannot self-approve Codex work |
| `P4121-P4160` | Claude Code Transcript Adapter | Capture Claude Code transcript source, review findings, verification evidence, and reviewer limitations | Claude review cannot mutate source or replace protected final approval |
| `P4161-P4200` | Transcript Redaction and Classification | Classify confidential, privileged, secret, legal, client, domain, and public transcript spans | Raw transcript access remains gated |
| `P4201-P4240` | Conversation-to-Artifact Extractor | Extract goals, decisions, blockers, claims, evidence refs, review refs, and plan amendment candidates | Extracted summary is a claim until reviewed |
| `P4241-P4280` | Context Recovery Bundle | Build compact restart bundles with citations, unresolved questions, next allowed actions, and current gates | No ungrounded memory recall |
| `P4281-P4300` | Transcript UI v0 | Show transcript sources, redaction state, extracted facts, and linked artifacts in read-only UI | No transcript mutation from UI |

Completion criteria:

```text
raw transcript = source material
summary = claim
plan change = candidate until reviewed
Codex/Claude done = evidence candidate
Harness UI status = source of truth
```

## P4001-P4300 UI and IA Contract

P4001-P4300 is not an AI memory viewer. It is a conversation-grounded evidence console. The first screen is `Conversation Source Queue`, placed before the broader operator queue.

Primary IA:

| Surface | Purpose |
|---|---|
| `Queue` | Today's source, review, and blocker work |
| `Conversations` | Codex and Claude session source material |
| `Transcript Archive` | Raw, redacted, and classified transcript inventory |
| `Extracted Claims` | Summary, done claim, blocker, decision, and plan-change candidates |
| `Plan Candidates` | Plan changes that are not adopted yet |
| `Context Recovery` | Citation-bearing next-session recovery bundles |
| `Review Gates` | Codex, Harness, Claude, GitHub, attestation, and no-human trust boundaries |
| `Evidence` | Artifacts, command output, receipts, and validation results |
| `Domain Packs` | personal-dev, law-firm, creative-document, resource, and connectors |
| `Audit` | Owner, timestamp, source, and status history |
| `Settings` | Source, adapter, and review-process contracts |

`Conversation Source Queue` table columns:

```text
source_id
engine
thread_or_session
project_or_goal
source_status
redaction_status
claim_count
plan_candidate_count
reviewer
next_allowed_action
```

The detail panel must show raw transcript boundary, source citation refs, redaction/classification result, extracted claims, linked artifacts, context recovery readiness, blocked claims, and next command. It must not expose raw transcript body by default.

Required component contracts:

```text
ConversationSourceRow
EngineBadge
RawSourceRef
TranscriptBoundaryBadge
RedactionStatePill
ClassificationLabel
ClaimCandidateRow
PlanChangeCandidateRow
SourceCitationPanel
ContextBundlePreview
AdapterLineageTimeline
NoSourceNoClaimNotice
```

State enums:

```text
source: ARCHIVED, REDACTION_REQUIRED, REDACTED, CLASSIFIED, EXTRACTED, REVIEW_PENDING, REVIEWED, BLOCKED
claim: CANDIDATE, NEEDS_SOURCE, NEEDS_REVIEW, ACCEPTED, REJECTED, STALE
plan: PROPOSED, REVIEWED_CANDIDATE, ADOPTED, BLOCKED
context: DRAFT, CITATION_MISSING, READY_FOR_NEXT_SESSION, BLOCKED
```

Allowed copy:

```text
Conversation archived as source material
Summary is a claim, pending review
Plan change candidate, not adopted
No transcript source; context claim blocked
No source citation; memory recall blocked
Redaction hold: privileged/client/secret span
```

Forbidden copy and UI framing:

```text
AI가 기억했습니다
스마트하게 요약
자동 인사이트
완료됨 as truth without evidence
AI confidence score
context health score
```

KPI cards are not the home surface. Counts such as archived transcript totals may appear only as table summaries or filters needed for operation. The product shape is a Jira-inspired evidence console, not a productivity dashboard.

The P4001-P4300 UI invariant is:

```text
source -> claim -> citation -> review -> Harness truth
```

## P4301-P4600 Detailed Plan

| Range | Name | Detailed goal | Keynote requirement |
|---|---|---|---|
| `P4301-P4340` | Improvement Signal Schema | Define `improvement_signal_id`, source turn refs, symptom, root cause, affected gate, and owner | Existing conversation is an improvement clue |
| `P4341-P4380` | User Correction Classifier | Classify pushback, correction, scope drift, forgotten context, trust objection, and planning mismatch | User correction changes the next execution condition |
| `P4381-P4420` | Assistant Miss Classifier | Capture overclaim, missing evidence, premature PASS, tool failure, incomplete validation, and stale memory | Completion claims are suspected by default |
| `P4421-P4460` | Plan Amendment Candidate Lane | Turn conversation signals into phase edits, gate edits, test candidates, reviewer changes, or UI requirements | no changed next condition = no learning claim |
| `P4461-P4500` | Soft Rule Promotion Queue | Promote repeated misses to hook candidates with deterministic check descriptions | Soft rule miss becomes hard gate candidate |
| `P4501-P4540` | Self-Improvement Review Packet | Bundle signal, source, proposed rule, expected effect, rollback, reviewer, and Claude Code Opus max review receipt requirement | Self-improvement cannot silently rewrite policy |
| `P4541-P4580` | Next-Session Context Injection | Inject reviewed signals into future planning, validation, and UI status | Memory must affect future execution |
| `P4581-P4600` | Improvement Signal Freeze | Freeze signal intake, PASS/BLOCK rows, and unresolved governance questions | No unreviewed self-modification |

Completion criteria:

```text
conversation improvement signal exists
user correction has source_turn_ref
assistant miss has root_cause
plan amendment candidate has reviewer_ref
soft rule promotion has hook_candidate_ref
next execution condition changes only after review
```

## P4601-P6200 Detailed Direction

| Range | Name | Required buildout | Must not happen |
|---|---|---|---|
| `P4601-P5000` | Development Control Console | Plan registry, goal cards, engine choice, live phase status, gate cards, evidence cards, review cards, transcript links, next actions | Treating Codex or Claude chat as the system of record |
| `P5001-P5400` | Verification Orchestration Runtime | Standard validators, dual-run comparison, CI checks, signed attestation verification, independent review completion receipts | Local-only PASS presented as enterprise trust |
| `P5401-P5800` | Multi-Engine Orchestration and Cross-Model QA | Primary engine selection, Claude Code Opus max reviewer lane, model upgrade receipts, role separation, cross-review packets | One engine approving itself |
| `P5801-P6200` | Review and Enterprise Trust Hardening | GitHub branch protection evidence, ruleset observation, single-owner exception receipts, Claude review receipts, no-human protected-closeout BLOCK rows, enterprise trust boundaries | Single-owner mode treated as independent approval |

## P4601-P5000 Detailed Plan

| Range | Name | Detailed goal | Review process requirement |
|---|---|---|---|
| `P4601-P4640` | Plan Registry | Register the full P4001-P8000 roadmap as source-cited rows with phase status, review process refs, milestone refs, and next allowed action | Every plan row binds to Codex/Harness/Claude review process |
| `P4641-P4680` | Goal Cards and Engine Role Setup | Show active goal cards, current milestone, Codex primary developer, Harness validator, and Claude Code Opus max reviewer roles | Codex cannot finally approve Codex-created work |
| `P4681-P4720` | Phase Progress Board | Display phase lanes, ready/blocked status, evidence refs, gate refs, and review refs | Phase movement needs Harness validation and Claude review receipt at milestone closeout |
| `P4721-P4760` | Gate and Evidence Cards | Show each gate, block reason, evidence card, source citation, and next repair action | Completion claim remains blocked without evidence |
| `P4761-P4800` | Review Process Lane | Encode Codex implementation packet, Harness deterministic validation, Claude review, finding loop, receipt registration, and trust classification | Human adjudication is excluded from this milestone gate |
| `P4801-P4840` | Transcript and Source Links | Link Codex/Claude conversation source rows, redaction state, claim candidates, and plan candidates | Raw transcript body stays hidden by default |
| `P4841-P4880` | Next Action Queue | Show the next validation, packet, review, finding-loop, receipt, or trust-label action | Next action is operational state, not assistant prose |
| `P4881-P4920` | Milestone Claude Review Packet | Register Claude review receipt requirements for P5000, P5400, P5800, P6200, P6600, P7000, P7300, P7600, P7800, and P8000 | Every major milestone requires Claude Code Opus max review receipt |
| `P4921-P4960` | Single-Owner Trust Classification | Show `single-owner + Claude-reviewed` lower-trust state and blocked enterprise-trust state | No human adjudication means no protected final decision |
| `P4961-P5000` | Console Freeze | Freeze console schema, artifacts, tests, summary, gate cards, and no-runtime/no-write/no-Work-OS boundary | Console is not runtime execution, write permission, or production Work OS |

Completion criteria:

```text
plan registry rows exist for P4001-P8000
active goal cards bind Codex and Claude roles
phase status rows cite gates and evidence
review process lane follows Codex -> Harness -> Claude -> finding loop -> receipt -> trust classification
major milestones require Claude Code Opus max review receipt
human adjudication is not part of milestone gate
single-owner + Claude-reviewed is lower trust
enterprise trust and protected closeout remain blocked
```

## P5001-P5400 Detailed Plan

| Range | Name | Detailed goal | Verification requirement |
|---|---|---|---|
| `P5001-P5040` | Standard Validator Adapter Registry | Register P4001-P5400 validators as standard command adapters with `--check` mode and validate-chain presence | Validators must be command-addressable, not prose checklists |
| `P5041-P5080` | Dual-Run Result Contract | Compare schema validation, summary validation, boundary validation, review process rows, and milestone gates | A single green path is not enough when a second result disagrees |
| `P5081-P5120` | Negative Fixture Expansion | Add fixtures for local-only enterprise PASS, missing Claude raw JSON, self-review approval, attestation summary without verify, and assumed human gate | Unsafe trust states must be blocked as expected |
| `P5121-P5160` | CI Required Check Contract | Define required checks for targeted node tests, platform validate chain, GitHub Actions, attestation verify, and Claude review receipt | Required checks must be visible before closeout |
| `P5161-P5200` | GitHub Actions Evidence Binding | Bind workflow run id, workflow conclusion, commit SHA, and required check name into evidence rows | CI summary text alone is not external evidence |
| `P5201-P5240` | Signed Attestation Verify Contract | Require signed attestation presence, verification pass, and subject digest binding | Attestation prose is not verification |
| `P5241-P5280` | Claude Review Receipt Completion Contract | Require Claude Code Opus max review completion, durable raw JSON, normalized findings, scope, model alias/id, and reviewer no-mutation boundary | Lost stdout, partial review, or hung process is not review evidence |
| `P5281-P5320` | Verification Result Normalization | Normalize validator, dual-run, negative fixture, CI, attestation, and review states into PASS/BLOCK/PENDING rows | Mixed states must stay visible |
| `P5321-P5360` | Milestone Trust Decision Rows | Separate contract readiness, lower-trust readiness, P5400 closeout readiness, and enterprise trust | Local-only readiness cannot become enterprise trust |
| `P5361-P5400` | Verification Orchestration Freeze | Freeze schemas, artifacts, tests, gates, and open external evidence rows | Runtime ready does not mean P5400 closeout ready |

Completion criteria:

```text
standard validators registered
dual-run rows have zero mismatch
negative fixtures block unsafe states
CI required check contracts exist
GitHub Actions evidence pending state is visible
attestation verify pending state is visible
Claude review receipt pending state is visible
durable Claude raw JSON is required
P5400 closeout remains blocked until external evidence exists
enterprise trust remains disabled
```

## P5401-P5800 Detailed Plan

| Range | Name | Detailed goal | QA requirement |
|---|---|---|---|
| `P5401-P5440` | Primary Engine Selection Registry | Register Codex, Harness, Claude Code Opus max, external evidence observer, and future reviewer model candidate | Engine roles must be explicit before orchestration |
| `P5441-P5480` | Reviewer Engine Lane | Keep Claude Code Opus max as independent reviewer with reviewer no-mutation and no-final-approval boundaries | Reviewer cannot mutate source or approve itself |
| `P5481-P5520` | Planner and Evidence Role Split | Separate planner, implementer, validator, reviewer, evidence summarizer, and conflict resolver roles | One role cannot collapse into final authority |
| `P5521-P5560` | Cross-Model QA Packet Contract | Route Codex-created work, validation summaries, normalized results, source refs, and rollback refs into Claude review packets | Cross-model QA needs packet evidence, not chat memory |
| `P5561-P5600` | Model Upgrade Receipt Contract | Require reviewer model alias/id, compatibility review, rollback model, and receipt evidence before replacing Claude Code Opus max | Latest model adoption cannot be implicit |
| `P5601-P5640` | Engine Conflict Resolution | Define BLOCK policies for Codex/Claude findings, validator/reviewer disagreement, stale source context, unclear model upgrade, and self-approval attempts | Conflict is a gate state, not a prose caveat |
| `P5641-P5680` | Reviewer No-Mutation Boundary | Freeze no source mutation, no final approval, no self-approval, no enterprise trust, and no protected final decision boundaries | Independent reviewer stays reviewer-only |
| `P5681-P5720` | Cross-Review Finding Loop | Keep findings open until completed Claude review receipt, normalized findings, and revalidation evidence exist | Incomplete Claude review cannot close the loop |
| `P5721-P5760` | Multi-Engine Trust Decision Rows | Separate local contract readiness, lower-trust readiness, P5800 closeout readiness, and enterprise trust | Single-owner Claude-reviewed mode remains lower trust |
| `P5761-P5800` | Multi-Engine QA Freeze | Freeze engine registry, role assignment, QA packet, model upgrade, conflict, reviewer boundary, finding loop, trust, and gate rows | P5800 ready does not mean protected or enterprise closeout |

Completion criteria:

```text
primary engine is registered
reviewer engine is registered
planner/evidence/reviewer roles are split
cross-model QA packet is ready for Claude review
model upgrade requires receipt
engine conflicts block auto PASS
reviewer mutation is false
self approval is false
P5800 closeout remains blocked until completed review receipt and revalidation exist
enterprise trust remains disabled
```

## P5801-P6200 Detailed Plan

This range makes the Codex and Claude review process enforceable as a trust contract. The repeated milestone rule is:

```text
Codex implementation packet
Harness deterministic validation
Claude Code Opus max independent review receipt
Finding loop and revalidation
Receipt registration
Single-owner trust classification
```

Claude Code Opus max is the reviewer lane, not a final approver. Codex remains the primary developer, not an approver of its own work. Human adjudication is excluded from the current milestone gate, so protected closeout and protected final decisions stay disabled.

| Range | Name | Detailed goal | Review process requirement |
|---|---|---|---|
| `P5801-P5840` | GitHub Review Lane Evidence Contract | Define GitHub PR review evidence, independent reviewer identity, same-account self-approval block, review state, and evidence refs | Self GitHub approval cannot satisfy independent review |
| `P5841-P5880` | Branch Ruleset and Protection Evidence | Require branch protection/ruleset receipt, force-push block state, admin bypass state, and branch binding | CI PASS without branch/ruleset evidence cannot become enterprise trust |
| `P5881-P5920` | Required Status Check Hardening | Bind required check names, commit SHA, workflow run, and conclusion into status-check rows | Required checks are evidence rows, not a green summary sentence |
| `P5921-P5960` | Signed Attestation Hardening | Require signed attestation presence, verification result, subject digest binding, and verifier source | Attestation text without verify result remains BLOCK |
| `P5961-P6000` | Claude Review Receipt Hardening | Require completed Claude Code Opus max review receipt, durable raw JSON, normalized findings, scope, model alias, and no-mutation boundary | Hung, partial, or lost Claude output is not review evidence |
| `P6001-P6040` | Single-Owner Exception Classification | Encode single-owner exception as `LOWER_TRUST_INTERNAL_ONLY` with independent GitHub approval false | Single-owner + Claude-reviewed is not enterprise trust |
| `P6041-P6080` | No-Human Protected Closeout Boundary | Make no-human mode visible and block protected closeout, protected final decision, and human-derived trust claims | Removing human does not create a final approval lane |
| `P6081-P6120` | Enterprise Trust Decision Matrix | Separate contract readiness, external evidence readiness, lower-trust readiness, P6200 closeout readiness, and enterprise trust | Trust tiers must not collapse into one PASS |
| `P6121-P6160` | Trust Claim Negative Fixtures | Block self review, no-human-as-final, Claude-as-enterprise, unverified attestation, CI-without-ruleset, and local-only release claims | Unsafe trust claims must fail closed |
| `P6161-P6200` | Review and Enterprise Trust Freeze | Freeze schema, artifacts, tests, gate rows, summary, and no-runtime/no-write/no-Work-OS boundary | P6200 hardening ready does not mean P6200 protected closeout ready |

Completion criteria:

```text
Codex implementation packet is the build source
Harness deterministic validation is required before review packet closeout
Claude Code Opus max receipt is required at milestone review points
Claude durable raw JSON is required
Claude mutation is false
Codex self approval is false
independent GitHub review remains false in single-owner mode
single-owner + Claude-reviewed = LOWER_TRUST_INTERNAL_ONLY
human adjudication is excluded from current milestone gate
protected final decision remains disabled
enterprise trust remains disabled
```

## P6201-P8000 Detailed Direction

| Range | Name | Required buildout | Must not happen |
|---|---|---|---|
| `P6201-P6600` | Product and Domain SaaS Factory | Project templates, domain packs, SaaS control-plan intake, HR/law-firm/creative/dev connector pack governance, requirement traceability | Turning Hermes into a single vertical SaaS instead of a control harness |
| `P6601-P7000` | Controlled Execution Write and Deploy | Allowlisted command execution, generated patch lane, deploy receipts, rollback target, post-apply validation, hook-enforced BLOCK, and no-human protected-closeout disabled rows | Free-form execution, direct write, protected closeout, or deploy without receipt |
| `P7001-P7300` | Memory Bank Storage Event and Observability Plane | Append-only event store, object references, run traces, transcript refs, evidence refs, cost and latency telemetry | Ungrounded memory or mutable audit history |
| `P7301-P7600` | Retrieval Ontology and Context Recall Layer | Sync, Index, Search, Extract, Consolidate, Relate, Recall; domain ontology; conflict resolution; cited recall | Memory recall without source, confidence, owner, and review status |
| `P7601-P7800` | Security Governance Compliance and Rule Conflict Plane | Secret handling, privileged data walls, prompt-injection boundary, stale-gate detection, rule conflict graph, incident drills | Rule sprawl hidden under automation success |
| `P7801-P8000` | Full Work OS UI and Production Freeze | Multi-project Work OS UI, operator handbook, API freeze, closed-loop maturity evidence, L6/L7 declaration, production readiness review | Work OS claim without L6 loop proof |

## P6201-P6600 Detailed Plan

This range answers the SaaS question directly: Hermes should govern multiple SaaS development efforts, but it should not collapse into one vertical SaaS product. HR Solution, Law Firm OS, Zendd bridge, and Hermes itself become governed control plans with requirement traceability, phase progress, evidence, review receipts, and next allowed actions.

The factory review process remains:

```text
Codex implementation packet
Harness deterministic validation
Claude Code Opus max independent review receipt
Finding loop and revalidation
Receipt registration
Single-owner trust classification
```

| Range | Name | Detailed goal | Product boundary |
|---|---|---|---|
| `P6201-P6240` | SaaS Project Intake Contract | Register HR Solution, Law Firm OS, Hermes Harness, Zendd Bridge, and future SaaS projects with stable project ids, domain, owner, source, phase, gate, and review refs | Intake is control-plan only, not product launch |
| `P6241-P6280` | Requirement Traceability Matrix | Bind requirement source, requirement ids, acceptance criteria, phase mapping, evidence mapping, reviewer refs, and launch blockers | No requirement trace means no release claim |
| `P6281-P6320` | Domain Pack Factory Registry | Register personal-dev, law-firm, creative-document, connectors/resource, and trading-read-only packs as reusable domain-goal-workflow contracts | Domain pack registration does not enable runtime/write |
| `P6321-P6360` | HR SaaS Control Plan Pack | Create HR SaaS control-plan rows for recruiting, onboarding, policy, performance, compensation, labor-compliance evidence, and automation review | No raw employee/applicant data ingestion |
| `P6361-P6400` | Law-Firm SaaS Control Plan Pack | Create matter-first control-plan rows for matter, VDR, LDD, citation, permission, audit, and review packets | No legal final advice or filing authority |
| `P6401-P6440` | Personal-Dev SaaS Control Plan Pack | Create issue, plan, worktree, diff, test, PR draft, rollback, and technical-debt control-plan rows | No merge/release authority from Codex alone |
| `P6441-P6480` | Creative-Document SaaS Control Plan Pack | Create template, style, asset, DOCX/PPTX/PDF/HTML, layout, and output review control-plan rows | No client delivery or final export authority |
| `P6481-P6520` | Connector and Resource SaaS Control Plan Pack | Create connector/resource ingestion, classification, quarantine, evidence, and source-span control-plan rows | No connector write, raw export, or secret read |
| `P6521-P6560` | Factory Review and Trust Lane | Attach the Codex-Harness-Claude process, Claude receipt requirement, negative fixtures, lower-trust badges, and next action rows to every project | Claude review is not product approval |
| `P6561-P6600` | Product Domain SaaS Factory Freeze | Freeze schema, artifacts, tests, UI surfaces, trust boundary, and no-runtime/no-write/no-launch/no-Work-OS claims | Factory ready does not mean SaaS launch ready |

Completion criteria:

```text
multi-SaaS project intake exists
HR Solution control plan exists
Law Firm OS control plan exists
domain pack factory registry exists
requirement traceability contract exists
Codex-Harness-Claude review lane applies to every factory project
Hermes vertical SaaS claim is false
SaaS product launch is false
external project write is false
raw sensitive data ingestion is false
human adjudication is excluded from current milestone gate
enterprise trust remains disabled
Work OS claim remains disabled
```

## P6601-P7000 Detailed Plan

This range prepares controlled execution, generated patch, and deploy receipt contracts. In the current no-human milestone mode, the contracts can become ready, but command execution, patch apply, deploy, external project write, protected action, and Work OS production claims remain disabled.

| Range | Name | Detailed goal | Execution boundary |
|---|---|---|---|
| `P6601-P6640` | Execution Allowlist Contract | Define allowlisted command patterns, command purpose, receipt requirement, output capture, timeout, redaction, rollback, and evidence refs | Allowlist contract does not execute commands |
| `P6641-P6680` | Sandbox and Timeout Policy | Define repo-local scope, timeout, cancellation, network default, secret env boundary, and execution owner | Sandbox policy does not open runtime |
| `P6681-P6720` | Redaction and Secret Scanner | Require stdout/stderr, artifact, and review packet scanning for secrets and raw sensitive data | Secret or raw data leak blocks execution/apply |
| `P6721-P6760` | Patch Candidate Lane | Allow generated patch candidates, diff review packets, Claude review receipts, rollback refs, and validation refs | Generated patch is not direct apply |
| `P6761-P6800` | Receipt-Gated Apply Boundary | Define apply receipt fields and no-human disabled state for protected apply | No-human mode blocks apply |
| `P6801-P6840` | Deploy Receipt Contract | Define preview/production deploy receipt, environment binding, commit SHA, rollback, and post-deploy validation | Deploy receipt contract does not deploy |
| `P6841-P6880` | Rollback Binding and Recovery Plan | Bind rollback target, restore instructions, owner, and rollback validation to every apply/deploy candidate | No rollback means no write/deploy candidate |
| `P6881-P6920` | Post-Apply Validation Matrix | Bind node checks, targeted tests, affected platform validators, diff check, and rollback verification | Post-apply validation cannot be skipped |
| `P6921-P6960` | Execution Trust Negative Fixtures | Block free-form command, direct apply, no-human-as-apply, deploy-without-receipt, secret logs, raw data, external write, and missing rollback | Unsafe execution claims fail closed |
| `P6961-P7000` | Controlled Execution Write Deploy Freeze | Freeze schema, artifacts, tests, gate rows, boundary, and no-command/no-apply/no-deploy/no-Work-OS state | P7000 ready does not mean execution is open |

Completion criteria:

```text
allowlist contract ready
sandbox and timeout policy ready
redaction and secret scanner ready
patch candidate lane ready
receipt-gated apply boundary ready
deploy receipt contract ready
rollback binding ready
post-apply validation matrix ready
command execution is false
patch apply is false
deploy is false
external project write is false
human adjudication is excluded from current milestone gate
enterprise trust remains disabled
Work OS claim remains disabled
```

## P7001-P7300 Detailed Plan

This range makes Codex/Claude conversations, validation results, review receipts, artifacts, gates, blockers, and next execution conditions durable. It is storage and observability only; runtime recall and retrieval stay disabled until P7301-P7600.

| Range | Name | Detailed goal | Memory boundary |
|---|---|---|---|
| `P7001-P7030` | Append-Only Event Store Contract | Define event ids, event types, source refs, timestamps, owner, domain, phase, claim, evidence, review, gate, and next-condition refs | Events cannot be mutated in place |
| `P7031-P7060` | Object Artifact Reference Store | Store artifact, transcript, validation, review receipt, patch, and rollback object refs with hash, path, source event, and redaction state | Raw bodies are not embedded by default |
| `P7061-P7090` | Transcript Source Event Binding | Bind Codex and Claude transcript source envelopes to append-only events with local archive, redaction, classification, and extraction status | Raw transcript access stays gated |
| `P7091-P7120` | Review Receipt Event Binding | Bind Claude Code Opus max review receipts, durable raw JSON object refs, normalized findings, model alias, scope, and no-mutation boundary | Review receipt is not final approval |
| `P7121-P7150` | Gate and Verdict Event Ledger | Record PASS/BLOCK/PENDING verdict events with evidence ref, reviewer ref, hard gate ref, owner, block reason, and next action | PASS without evidence is blocked |
| `P7151-P7180` | Trace Audit Cost Observability | Record trace id, actor, owner, duration, cost/token, validation error count, unsafe flag count, and gate counts | Missing observability blocks closeout |
| `P7181-P7210` | Retention Backup Restore Boundary | Bind retention policy, legal hold, backup snapshot, restore drill, deletion/redaction request, and domain partition | Delete without policy is blocked |
| `P7211-P7240` | Memory Bank Storage Index | Prepare archive, sync, index, extract, consolidate, and relate operations with source status and citations | Runtime recall remains disabled |
| `P7241-P7270` | Event Observability Negative Fixtures | Block mutable events, raw transcript default access, uncited memory, cross-domain leak, missing review event, no trace/cost, retention bypass, and premature recall | Unsafe memory claims fail closed |
| `P7271-P7300` | Memory Event Observability Freeze | Freeze schema, artifacts, tests, gate rows, summary, and storage-only/no-recall/no-Work-OS boundary | P7300 ready does not mean retrieval ready |

Completion criteria:

```text
append-only event store ready
object artifact reference store ready
Codex transcript event binding ready
Claude transcript event binding ready
Claude review receipt event binding ready
gate verdict event ledger ready
trace/audit/cost observability ready
retention/backup/restore boundary ready
memory storage index ready
raw transcript default access is false
mutable event update is false
runtime recall is false
retrieval layer is false
cross-domain memory leak is false
Work OS claim remains disabled
```

## P7301-P7600 Detailed Plan

This range turns storage and observability into a cited recall layer. It does not make memory automatically true. A recalled fact remains a sourced claim with citation, source status, conflict status, domain boundary, and review status.

The retrieval review process remains:

```text
Codex implementation packet
Harness deterministic validation
Claude Code Opus max independent review receipt
Finding loop and revalidation
Receipt registration
Single-owner trust classification
```

| Range | Name | Detailed goal | Recall boundary |
|---|---|---|---|
| `P7301-P7330` | Retrieval Ontology Contract | Define project, domain, workflow, phase, gate, evidence, review, transcript, and next-condition ontology rows | Ontology is not recalled truth |
| `P7331-P7360` | Source-Cited Search Contract | Index searchable source refs with citation, redaction status, source status, and reviewer refs | Search result without citation is blocked |
| `P7361-P7390` | Extracted Fact and Claim Recall Contract | Extract fact and claim recall candidates from transcript, validation, review, and plan events | Extracted recall is not accepted as truth |
| `P7391-P7420` | Consolidation and Conflict Resolution | Deduplicate and mark conflicts across claim, evidence, validation, and review records | Conflict cannot auto-resolve |
| `P7421-P7450` | Relation Graph Context Compiler | Relate claim, evidence, gate, review, plan, transcript, and next-condition rows | Relation graph cannot cross domain walls |
| `P7451-P7480` | Next-Session Recall Bundle | Build citation-bearing next-session context bundles with blocked/stale/conflict rows visible | Auto context injection remains disabled |
| `P7481-P7510` | Domain and Project Boundary Filters | Enforce project, domain, matter, HR, resource, trading, and connector memory boundaries | Cross-domain recall leak is blocked |
| `P7511-P7540` | Staleness and Freshness Policy | Mark stale memory, freshness windows, revalidation requirements, and currentness claims | Stale memory cannot auto PASS |
| `P7541-P7570` | Recall Negative Fixtures | Block uncited recall, raw transcript recall, stale-as-current, cross-domain leak, conflict auto-resolve, missing review receipt, and auto mutation | Unsafe recall claims fail closed |
| `P7571-P7600` | Retrieval Ontology Context Recall Freeze | Freeze schema, artifacts, tests, gate rows, summary, and no-runtime/no-auto-injection/no-Work-OS boundary | Retrieval ready does not mean autonomous memory |

Completion criteria:

```text
retrieval ontology ready
source-cited search ready
fact and claim recall candidates ready
consolidation conflict rows ready
relation graph context compiler ready
next-session recall bundle ready
domain boundary filters ready
staleness policy ready
negative fixtures block unsafe recall
Claude review receipt requirement is visible for milestone review
auto context injection is false
raw transcript recall is false
runtime recall execution is false
cross-domain memory leak is false
enterprise trust remains disabled
Work OS claim remains disabled
```

## P7601-P7800 Detailed Plan

This range governs the cost of rule growth. The goal is not to add more rules forever; it is to expose conflicts, stale gates, and unsafe interactions as first-class rows.

The governance review process remains:

```text
Codex implementation packet
Harness deterministic validation
Claude Code Opus max independent review receipt
Finding loop and revalidation
Receipt registration
Single-owner trust classification
```

| Range | Name | Detailed goal | Governance boundary |
|---|---|---|---|
| `P7601-P7620` | Secret and Raw Material Governance | Bind secret, client, privileged, HR, VDR, connector, and transcript raw-material gates | Secret or raw sensitive leakage blocks recall and UI display |
| `P7621-P7640` | Prompt Injection and Tool Boundary | Detect injected instructions, tool-use escalation, raw export attempts, and review bypass prompts | Prompt text cannot override Harness policy |
| `P7641-P7660` | Rule Conflict Graph | Model conflicting rules, duplicate gates, incompatible pack requirements, and stale exceptions | Conflict is BLOCK/PENDING, not hidden warning |
| `P7661-P7680` | Stale Gate and Policy Drift Detector | Mark out-of-date validators, model choices, GitHub rules, branch protections, attestations, and receipts | Stale policy cannot produce current trust |
| `P7681-P7700` | Incident and Recovery Drill Contract | Define incident rows, impact, containment, rollback, evidence preservation, and revalidation | Recovery claim requires evidence |
| `P7701-P7720` | Compliance Pack Registry | Register security, privacy, legal, HR, finance, connector, and trading compliance check packs | Compliance registration is not compliance certification |
| `P7721-P7740` | Governance UI Rows | Show conflict, stale, injection, secret, incident, and compliance rows in the operator UI | UI cannot bury hard blockers in KPI cards |
| `P7741-P7760` | Governance Negative Fixtures | Block policy override, stale PASS, secret leak, rule conflict auto-resolve, prompt injection, and compliance theater | Unsafe governance states fail closed |
| `P7761-P7780` | Claude Governance Review Packet | Require Claude Code Opus max review receipt for governance changes, conflict policy, and fixture coverage | Reviewer cannot mutate policy |
| `P7781-P7800` | Security Governance Freeze | Freeze schema, artifacts, tests, gate rows, summary, and no-runtime/no-enterprise/no-Work-OS boundary | Governance ready does not mean production trust |

Completion criteria:

```text
secret/raw material governance ready
prompt injection boundary ready
rule conflict graph ready
stale gate detection ready
incident recovery drill contract ready
compliance pack registry ready
governance UI rows ready
Claude governance review packet required
policy override is blocked
stale PASS is blocked
enterprise trust remains disabled
Work OS claim remains disabled
```

## P7801-P8000 Detailed Plan

This range freezes the full Work OS UI only if the closed-loop proof exists. The UI can be substantial before this point, but a Work OS production claim needs L6/L7 evidence, not a good-looking dashboard.

The final freeze review process remains:

```text
Codex implementation packet
Harness deterministic validation
Claude Code Opus max independent review receipt
Finding loop and revalidation
Receipt registration
Single-owner trust classification
```

| Range | Name | Detailed goal | Work OS boundary |
|---|---|---|---|
| `P7801-P7820` | Full Work OS Navigation Freeze | Freeze Queue, Plans, Conversations, Evidence, Reviews, Gates, Memory, Security, Domains, Runs, Settings, and Audit navigation | UI navigation is not production readiness |
| `P7821-P7840` | Closed-Loop Maturity Evidence | Prove source, claim, evidence, review, gate, verdict, next condition, and later recall changed execution state | No L6 loop proof means no Work OS claim |
| `P7841-P7860` | Operator Action Inbox | Show next allowed actions, blocked actions, review receipts, stale gates, and repair packets | Action inbox cannot execute protected actions |
| `P7861-P7880` | Domain Pack Rollout Matrix | Show per-project/domain rollout level, trust tier, capability, evidence, review, and block reason | Pack ready does not mean product launch |
| `P7881-P7900` | API and Handbook Alignment | Freeze read-only API projections, operator handbook, dashboard IA, evidence schemas, and command map | Docs cannot claim capabilities validators block |
| `P7901-P7920` | Milestone Claude Review Completion Ledger | Require Claude Code Opus max review receipt rows for P5000 through P8000 with durable raw JSON and normalized findings | Missing review receipt blocks final freeze |
| `P7921-P7940` | Trust Tier Publication | Publish local, single-owner lower-trust, external-evidence, enterprise-blocked, and production-blocked trust tiers | Lower trust cannot be renamed enterprise |
| `P7941-P7960` | Work OS Negative Fixtures | Block no-source context, no-evidence PASS, no-review closeout, no-human-as-final, Claude-as-approver, no-L6 Work OS, and UI-only production claim | Unsafe final claims fail closed |
| `P7961-P7980` | Production Readiness Freeze Packet | Bundle validation matrix, review receipts, unresolved blockers, boundary states, rollback, and next phase recommendations | Freeze packet is not production release |
| `P7981-P8000` | P8000 Work OS Freeze | Freeze schema, artifacts, tests, dashboard/API/handbook alignment, and explicit trust limits | P8000 cannot overclaim beyond evidence |

Completion criteria:

```text
full Work OS UI contract ready
closed-loop maturity evidence ready or Work OS claim blocked
operator action inbox ready
domain rollout matrix ready
API and handbook alignment ready
Claude review completion ledger required
trust tiers published without overclaim
unsafe final claim fixtures block
production readiness freeze packet ready
Codex cannot self-approve
Claude cannot final approve
human adjudication is excluded from this milestone gate
single-owner + Claude-reviewed remains lower trust
protected closeout remains disabled
enterprise trust remains disabled
Work OS production claim remains disabled unless L6/L7 proof passes
```

## Development Surface Rule

Hermes does not replace Codex or Claude Code. Hermes becomes the durable operating surface around them:

- Codex plans, implements, tests, and prepares packets.
- Claude Code Opus max reviews independently and produces findings or verification evidence.
- Human adjudication is excluded from the current milestone gate. As a consequence, Hermes must not claim protected final approval or enterprise trust in this mode.
- Hermes stores the conversation, extracts signals, requires evidence, shows gates, and decides what can move next within `single-owner + Claude-reviewed` trust limits.

The product target is not "a better chat window." The target is a project operating system where plans, conversations, evidence, reviews, hooks, and next actions survive across sessions.

## P8000 Final Freeze Tests

```text
no transcript source = no context claim
no source citation = no memory recall
no improvement signal review = no self-improvement claim
no changed next condition = no learning claim
no evidence = no PASS
no reviewer = no protected closeout
no human adjudication = no protected final decision, and current no-human mode keeps that decision disabled
no independent review = no enterprise trust
no hard hook = no safety claim
no L6 closed loop = no Work OS claim
```

## P8001-P8080 Closeout Addendum

P8001-P8080 closes the P8000 program as a local, single-owner, Claude-reviewed lower-trust checkpoint. It does not turn P8000 into production launch or enterprise-independent trust.

| Range | Name | Detailed goal | Trust boundary |
|---|---|---|---|
| `P8001-P8020` | P8000 Closeout Packet | Bundle P7801-P8000 source freeze, Codex implementation surface, validation matrix, review lane, finding loop, trust boundary, and rollback notes | Packet alone is not PASS |
| `P8021-P8040` | Claude Review Receipt | Capture Claude Code Opus max review receipt with durable raw JSON, normalized findings, model identity, prompt/output hash, no mutation, and no final approval | Missing or unsafe receipt blocks clean checkpoint |
| `P8041-P8060` | Finding Loop And Revalidation | Convert findings into repair actions and revalidation evidence; unresolved P0/P1 findings keep the checkpoint blocked | Validation cycle alone is not trust |
| `P8061-P8080` | Clean Checkpoint | Require closeout packet, validation evidence, Claude receipt, clear finding loop, git status evidence, no human gate, no self approval, and no production/enterprise claim | Clean checkpoint remains single-owner lower trust |

Completion criteria:

```text
P8000 closeout packet ready
Claude Code Opus max review receipt observed
durable raw JSON and normalized findings captured
unresolved P0/P1 findings blocked
required validation commands pass
human adjudication remains excluded
Codex self-approval remains false
Claude final approval remains false
validator-only trust remains false
enterprise trust remains disabled
Work OS production claim remains disabled
checkpoint command does not stage, commit, push, or merge
```
