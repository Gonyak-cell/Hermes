# Hue Keynote Harness Operating Loop

Source: `Hue_Keynote.pdf`, reviewed from the image-based 50 page deck on 2026-06-04.

This note does not treat the deck as a marketing story. It turns the keynote into Hermes operating requirements. The central point is simple: a good structure does not guarantee a good result unless the structure doubts completion claims, demands evidence, blocks unsafe PASS, and changes the next execution condition after failure.

## Core Question

The keynote asks whether good structure guarantees good results. Hermes should answer no. Structure is only useful when it makes results observable, reviewable, repeatable, recoverable, memorable, and scalable.

The platform therefore treats every completion message as a claim, not as truth. A claim becomes a PASS only when it is tied to evidence, reviewed by an owner, and accepted by a hard gate.

## Harness Invariants

| Invariant | Hermes meaning |
|---|---|
| Good structure does not guarantee good results | Every phase must produce evidence, not only a status sentence |
| Completion claim is not evidence | `current_verdict=pass` requires `evidence_ref`, `reviewer_ref`, and `hard_gate_ref` |
| Completion is a contract | DONE means claim plus evidence plus reviewer plus gate plus next action |
| Soft instruction is not a gate | `AGENTS.md`, `SKILL.md`, and docs guide behavior; deterministic scripts enforce behavior |
| Apology is not state change | After a failed loop, Hermes must change a condition, rule, scaffold, receipt, or gate |
| Memory is the next execution condition | Memory is not archive alone; it changes future task selection, validation, and review context |
| Failure must teach the system | FAIL leads to correction, rollback, rule extraction, or hard gate promotion |
| Harness reliability belongs around the model | Better models reduce variance, but external verification creates operational consistency |
| PASS criteria must have an owner | Scaling fails when nobody owns the definition of PASS |
| A demo proves a loop, not a feature | The important proof is doubt, evidence, gate, correction, and next-condition change |

## Claim Evidence Gate Contract

Hermes should model every significant result as:

```text
claim -> evidence -> reviewer -> hard_gate -> verdict -> next_allowed_action
```

Required evidence classes:

- build and typecheck evidence
- real interaction or smoke evidence
- database, file, or artifact consistency evidence
- screenshot or visual confirmation evidence when UI is involved
- cross-agent or cross-model review evidence for risky changes
- regression test evidence
- doctor and configuration evidence for runtime enablement
- receipt evidence for protected action approval

This is why the Kernel extraction work must keep `claim`, `evidence`, `gate`, `artifact`, `check`, and `receipt` as common platform primitives instead of domain-specific conventions.

## Hard Gate Promotion

Natural-language rules are soft. They can be forgotten, deprioritized, or skipped under tool pressure. Hermes should keep them, but must promote repeated or high-risk misses into deterministic gates.

Promotion rule:

```text
soft rule miss -> repeated miss or high risk -> hard gate candidate -> deterministic check -> exit 2 style BLOCK -> memory update
```

Hard gates should be machine-checkable, deterministic, and unskippable for the protected action they guard. Examples include QA cycle evidence before push, secret scan before release, no raw client material in public artifacts, no direct Zendd write without receipt, no legal/release final authority by Agent, and no command execution without the approved lane.

## Closed Loop

The operating loop from the deck maps directly to Hermes:

```text
execute -> completion claim -> evidence capture -> gate judgment
  -> PASS: acknowledge and preserve evidence
  -> FAIL: correct, rollback if needed, extract rule, change next execution condition
```

The critical distinction is that FAIL must not only ask the Agent to try again. It must alter the operating surface: a receipt requirement, a checklist item, a scaffold, a reviewer assignment, a hard gate, a memory entry, or a rollback target.

## Memory Bank Requirement

The deck's Memory Bank idea should become the storage and retrieval shape for Hermes after the Kernel cutover. The lifecycle is:

1. Archive raw run metadata and tool-call lineage without mixing domain boundaries.
2. Sync new events into an indexed store.
3. Search before planning or declaring readiness.
4. Extract facts, failures, decisions, rules, and evidence references.
5. Consolidate duplicates, conflicts, and evolution.
6. Relate facts by domain, project, workflow, owner, and gate.
7. Recall with citations into the next execution context.

Hermes memory must be retrieval-first and grounded. A recalled fact should carry source, timestamp, confidence, owner, and review status. Memory that does not affect the next action is only storage; it is not yet a Harness feature.

## Conversation Improvement Signal Requirement

Codex and Claude conversations are source material for the Harness, not the Harness itself. The local archive must preserve a Codex conversation source, a Claude Code transcript source, raw transcript boundaries, tool-call lineage, review findings, validation summaries, review receipt refs, and trust boundary refs.

The important upgrade is that prior conversation becomes a conversation improvement signal. A user correction, assistant overclaim, missing evidence objection, forgotten context, repeated planning drift, review conflict, blocked command, or failed validation can become:

- a plan amendment candidate
- a rule extraction candidate
- a hard hook candidate
- a validation fixture candidate
- a reviewer lane change
- a next execution condition update

This is the deck's self-improvement loop applied to Hermes. The system must not say it learned merely because a chat ended with an apology or a revised answer. A learning claim needs a reviewed signal, a source turn reference, a proposed change, a reviewer, and an observable next execution condition.

For risky work, cross-model QA should remain explicit. Claude Code review can inspect Codex-created work, and Codex cross-review can inspect another engine's completion. In the current no-human milestone mode, protected closeout and protected final decisions remain disabled; a single model's completion message does not become PASS by itself.

## Conversation Source UI Requirement

The P4001-P4300 UI must be a Conversation Source Queue, not a raw chat viewer and not a KPI dashboard. Its job is to show which transcript was archived, whether source citation exists, whether redaction and classification passed, which summaries are only claims, which plan changes are reviewed candidates, and which context bundle can be used in the next session.

The UI must preserve this boundary:

```text
source -> claim -> citation -> review -> Harness truth
```

The first screen should be queue-first. It should show `source_id`, engine, thread or session, project or goal, source status, redaction status, claim count, plan candidate count, reviewer, and next allowed action. The detail panel should show raw transcript boundary, source citation refs, redaction/classification result, extracted claims, linked artifacts, context recovery readiness, blocked claims, and next command.

KPI cards are not the home surface. Counts can be filters or table summaries, but Hermes should not present "AI productivity", "memory score", "AI confidence score", or "context health score" as trust signals. The correct framing is a Jira-inspired evidence console where source, review, blocker, and next action queues drive operator judgment.

Required UI language includes:

- `Conversation archived as source material`
- `Summary is a claim, pending review`
- `Plan change candidate, not adopted`
- `No transcript source; context claim blocked`
- `No source citation; memory recall blocked`
- `Redaction hold: privileged/client/secret span`

## Harness Maturity Levels

| Level | Operating meaning |
|---|---|
| `L0` | Manual prompt and manual review |
| `L1` | Reusable instructions and templates |
| `L2` | Skills, scripts, and partial automation |
| `L3` | Completion claims require evidence |
| `L4` | Memory prevents repeated failures |
| `L5` | Soft rules become hard, checkable gates |
| `L6` | Signal, patch, verify, acknowledge, or rollback forms a closed loop |
| `L7` | User, project, plugin, MCP, domain, and trend workflows become a Work OS |

Hermes should not call itself Harness-native merely because Agents or MCP tools exist. The minimum target is `L6` closed-loop operation, with `L7` as the long-range Work OS direction.

## Enterprise Scaling Constraint

The deck's organization-level warning is important: scaling a personal harness is not tool cloning. The hard part is PASS ownership.

Hermes must represent three things per domain pack:

- `DOMAIN`: the field-specific context and risk surface
- `GOAL`: the team or organization-specific definition of success
- `WORKFLOW`: the order, review lane, evidence, rollback, and gate sequence

The operator console and domain pack registry must answer:

```text
Whose PASS standard is this?
Who can review it?
What evidence is required?
What action is blocked until that evidence exists?
What changes after a FAIL?
```

The deck also points out the interaction cost of many rules and teams. Hermes should therefore treat rule growth as a governance problem, not only as automation coverage. Rule conflicts, duplicated checks, inconsistent PASS standards, and distributed rollback risk must be visible first-class rows.

PASS ownership also changes by scope. Personal, Peer, Team, Org QA, and Operating OS levels cannot share one vague PASS standard. Each level needs a declared owner, evidence class, reviewer lane, and blocked action.

## Product Updates Required

- P1201-P1500 Agent activation must stay focused on safe enablement conditions, not autonomy.
- P1501-P2040 Kernel must keep claim/evidence/gate/artifact/check/receipt as common primitives.
- P2041-P2120 must supersede the prior Nous adapter-only policy when Nous is not adopted and restore Hermes-native feature ownership as planning input.
- P2121-P2240 runtime governance must restore API/MCP/tool/job policy and hard hook scaffolding before execution opens.
- P2241-P2400 limited execution must begin with allowlists, redaction, timeout, rollback binding, and receipt closeout.
- P2401-P2560 controlled write and operator console must generate patches first, require an explicit approval receipt before any protected apply lane is reopened, and show PASS owner, missing evidence, blocked reason, next action, and maturity level.
- P2561-P2720 storage/event plane must implement Memory Bank lifecycle and grounded recall.
- P2721-P2880 connectors must ingest through quarantine and evidence references, not raw uncontrolled material.
- P2881-P3040 domain packs must ship domain, goal, workflow, PASS owner, and compatibility gates.
- P3041-P3200 production freeze must prove `L6` closed loop and declare which surfaces, if any, reach `L7` Work OS maturity.

## P4001-P8000 Product Updates Required

- P4001-P4300 must create local Codex/Claude transcript source contracts and archive sessions as governed source material.
- P4301-P4600 must mine conversation improvement signals from user corrections, misses, review conflict, failed validation, and repeated context loss.
- P4601-P5000 must make plans, phase progress, evidence, reviews, transcript links, and next actions visible in the Harness UI.
- P5001-P5400 must orchestrate standard validators, dual-run checks, CI evidence, attestations, and independent review receipts without converting pending external evidence into PASS.
- P5401-P5800 must separate primary engine, reviewer engine, cross-model QA, model upgrade receipts, reviewer no-mutation boundaries, and no-human protected-closeout boundaries.
- P5801-P6200 must preserve single-owner lower-trust mode, require GitHub branch/ruleset evidence, required status checks, signed attestation verification, and Claude Code Opus max durable review receipts, and prevent any of those partial signals from becoming enterprise trust by themselves.
- P6201-P6600 must let Hermes govern multiple SaaS projects through project intake, requirement traceability, domain pack control plans, Codex-Harness-Claude review receipts, and trust-tier rows without becoming a single vertical SaaS product.
- P6601-P7000 must prepare execution, write, and deploy contracts behind receipts, rollback, redaction, timeout, and hard hooks while current no-human mode keeps command execution, patch apply, deploy, and external writes disabled.
- P7001-P7300 must implement append-only storage, object references, transcript/review/gate event bindings, observability, retention, and a storage-only memory index while keeping runtime recall disabled until the P7301-P7600 retrieval layer.
- P7301-P7600 must implement retrieval, ontology, and cited recall around the seven-step Memory Bank lifecycle. Its milestone review gate must keep the Codex implementation packet, Harness deterministic validation, Claude Code Opus max review receipt, finding loop, receipt registration, and single-owner trust classification visible while excluding human adjudication from the current gate.
- P7601-P7800 must make rule conflict, stale gates, security boundaries, and governance drift visible.
- P7801-P8000 must freeze the full Work OS UI only when L6 closed-loop proof exists; no L6 closed loop means no Work OS claim.

## Final Rule

Hermes should never trust an LLM result just because the model, Agent, or tool says it is complete. The platform exists to require evidence, review, gates, rollback, and a changed next execution condition before the result can move forward.
