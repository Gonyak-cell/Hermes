# Hermes Long Range Roadmap P1200-P3200

This roadmap incorporates the `Hue_Keynote.pdf` operating-loop requirements into the Hermes plan. The guiding rule is:

```text
tool < structure < verification loop
```

Hermes should become a Harness-native control plane only when completion claims are doubted, evidence is captured, PASS has an owner, unsafe actions are blocked by hard gates, failures change future execution conditions, and memory is recalled with citations.

## Fixed Premise

```text
P1200까지: Agent runtime pilot readiness freeze
P1201-P1500: Agent activation + no-write pilot + operator visibility
P1501-P2040: Platform Kernel & Harness-native cutover
P2041-P2120: Nous non-adoption reversal + Hermes-native restore decision
P2121 이후: Hermes-native runtime governance, limited execution, controlled write, storage/event, connectors, domain ecosystem, production freeze
```

Current operating boundary after P2040:

- Nous is not adopted.
- `platform:nous-overlap-audit` remains historical evidence, but its adapter-only future policy is superseded.
- P2041 is reopened only as Hermes-native restoration planning.
- No runtime execution is enabled by the Kernel cutover.
- No write action is enabled by the Kernel cutover.
- No protected action, receipt application, raw material access, legal final authority, release final authority, live trading action, or Agent final PASS is enabled.
- Codex can still implement repository changes, but Harness should increasingly define work orders, evidence, gates, and closeout criteria before mutation.

## Keynote-Derived Design Anchors

| Anchor | Roadmap consequence |
|---|---|
| Completion claim is not evidence | Every phase gets claim/evidence/reviewer/hard gate rows |
| Completion is a contract | DONE requires evidence, review, gate, verdict, and next allowed action |
| Soft rule is not a gate | Repeated or risky misses become deterministic hard checks |
| Apology is not state change | FAIL must change a scaffold, rule, memory, receipt, rollback, or gate |
| Memory is next execution condition | Storage/event work must support grounded recall into the next run |
| Closed loop beats one-shot generation | Programs must prove execute, verify, correct, and recall loops |
| PASS requires an owner | Domain rollout must declare who owns PASS criteria |
| Scale is not tool cloning | Domain, goal, and workflow must be pack-level contracts |
| Rule growth creates conflicts | Operator surfaces must show duplicated, conflicting, or stale gates |
| The target is L6/L7 | L6 closed loop is required before L7 Work OS claims |

## Whole Roadmap

| Range | Program | Goal | Keynote integration |
|---|---|---|---|
| `P1200` | Agent Runtime Pilot Readiness Freeze | Freeze P1122-P1198 as pilot-ready but blocked | Claims are frozen separately from enablement; runtime/write stay BLOCK |
| `P1201-P1320` | Agent Runtime Activation Bridge | Receipt intake, approved install lane, doctor evidence, L0 read-only adapter, Zendd no-write pilot | `receipt 없음 = 실행 없음`; doctor/smoke evidence is required before runtime claims |
| `P1321-P1440` | Domain Agent No-Write Pilot Expansion | Extend no-write Agent pilots across personal-dev, law-firm, creative-document, resource, trading, Zendd | Every domain declares capability, evidence, reviewer, PASS owner, human gate, and blocked authority |
| `P1441-P1500` | Agent Operator Console v0 | Show capability, missing receipt, block reason, next action, dry-run/real-run boundary | Operator sees why a PASS is blocked instead of trusting Agent completion text |
| `P1501-P1640` | Kernel Manifest and Contract Baseline | Extract common manifest, spec, status, source status, and phase contracts | DONE becomes a Kernel contract, not a prose status |
| `P1641-P1760` | Spec/Status Reconciliation and Hard Gate Promotion | Reconcile declared specs with actual status and identify soft rules that must become hard gates | `AGENTS.md`/`SKILL.md` rules are mapped to deterministic gate candidates |
| `P1761-P1880` | Claim/Evidence/Gate and Artifact/Check/Receipt Kernel | Commonize claim, evidence, gate, artifact, check, receipt primitives | Completion claim cannot pass without evidence, reviewer, and hard gate |
| `P1881-P2040` | Harness-Native Cutover Freeze | Bind Kernel rows to Harness-native lanes and suspend P2041 pending overlap review | Kernel becomes the control plane, but execution remains closed until restoration is explicitly planned |
| `P2041-P2120` | Nous Non-Adoption Reversal | Supersede adapter-only future policy and restore Hermes-native runtime/API/MCP/tool/job/memory/dashboard planning | Removed or blocked features are revived as Hermes-owned plans, not enabled execution |
| `P2121-P2240` | Hermes Runtime Governance Restore | Restore runtime API control-plane, MCP registry, tool gateway policy, job ledger, install/doctor evidence, and hard hook scaffold | Runtime governance returns to Hermes while execution remains receipt-gated |
| `P2241-P2400` | Human-Approved Limited Execution | Open only allowlisted commands behind receipt, sandbox, redaction, timeout, rollback, closeout | First real action lane proves hard gate behavior, including exit 2 style BLOCK semantics |
| `P2401-P2560` | Controlled Write and Operator Console v2 | Generate patch candidates, review diff packets, apply only with human receipt, and show PASS owner/action inbox | Agent proposes patches; humans authorize application; FAIL changes next conditions |
| `P2561-P2720` | Memory Bank, Storage/Event, and Observability Plane | Move from JSON artifacts to append-only events, object store, trace/audit/cost, grounded recall | Archive, sync, index, search, extract, consolidate, relate, recall become platform features |
| `P2721-P2880` | Connectors and Data Governance | Safe ingestion for GitHub, issues, mail/calendar, files, resources, quarantine, classification | Connectors feed evidence references and memory, not uncontrolled raw material |
| `P2881-P3040` | Domain Pack Ecosystem | Pack SDK, compatibility gate, contribution model, registry, domain ontology | Packs encode domain, goal, workflow, PASS owner, and review criteria |
| `P3041-P3200` | Production Governance and Work OS Freeze | AI risk, supply chain, backup/restore, incident, release readiness, L6/L7 freeze | Freeze closed-loop maturity and declare which surfaces reach Work OS level |

## P1200-P1500 Detailed Plan

| Range | Name | Detailed goal | Hard boundary |
|---|---|---|---|
| `P1200` | Runtime Pilot Freeze Anchor | Rejudge P1122-P1198 claims, freeze unsafe invariants false, and define `ready_for_human_approved_agent_runtime_pilot` | Pilot readiness does not enable runtime |
| `P1201-P1220` | Runtime Human Receipt Intake | Define install/runtime/MCP/API/cron/secret/Zendd action receipt schema, queue, validation, expiry, revocation | No receipt, no execution |
| `P1221-P1240` | Approved Install Lane | Permit only receipt-backed repo-local install candidates such as venv, pipx, or isolated container | No global install or raw secret |
| `P1241-P1260` | Doctor/Smoke Evidence Capture | Capture version, doctor, config, help, tool policy, and smoke summaries as redacted evidence refs | No raw stdout with secrets; no evidence, no runtime |
| `P1261-P1280` | L0 Runtime Adapter Pilot | Attach Agent only as read-only planner and evidence summarizer | No terminal execution, write, MCP mutation, or protected action |
| `P1281-P1300` | Zendd No-Write Pilot | Generate Zendd work order, diff review packet, rollback plan candidate | No direct Zendd file mutation |
| `P1301-P1320` | Activation Bridge Freeze | Rejudge P1201-P1300 as PASS/BLOCK rows and freeze remaining receipt/block/rollback conditions | PASS requires evidence/reviewer/gate |
| `P1321-P1340` | Personal-Dev Agent Pilot | Plan issue, diff, tests, rollback, and PR draft candidates | No PR create, merge, release, or direct push |
| `P1341-P1360` | Law-Firm Agent Pilot | Prepare VDR/LDD/citation/review packet candidates | No legal PASS, advice, filing, or client-final output |
| `P1361-P1380` | Creative-Document Agent Pilot | Prepare template, style, layout, artifact review candidates | No client delivery or export finalization |
| `P1381-P1400` | Resource/Connector Agent Pilot | Prepare ingestion, classification, quarantine, evidence candidates | No raw export, connector write, or secret read |
| `P1401-P1420` | Trading Agent Pilot | Prepare read-only safety, evidence, backtest-review candidates | No live action, order intent, broker, or exchange write |
| `P1421-P1440` | Domain Pilot Freeze | Freeze all domain pilots into capability, evidence, reviewer, human gate, PASS/BLOCK rows | Domain rollout without PASS owner remains BLOCK |
| `P1441-P1460` | Agent Operator Surface v0 | Show capability registry, rollout level, source status, block reason, missing receipt | No mutation routes |
| `P1461-P1480` | Agent API Projection v0 | Add read-only route contracts for capabilities, blocks, next actions, receipts | GET-only projection |
| `P1481-P1500` | Agent Console Freeze | Freeze "why blocked, what needed, next allowed action" as operator-visible rows | Console visibility is not action enablement |

P1500 completion criteria:

```text
receipt 없음 = 실행 없음
install evidence 없음 = runtime 없음
doctor evidence 없음 = tool enablement 없음
domain pilot 없음 = rollout 없음
review/gate 없음 = PASS 없음
raw secret/client/VDR 노출 없음
Zendd write 없음
legal/release/final approval을 Agent가 만들 수 없음
```

## P1501-P2040 Detailed Kernel Plan

| Range | Name | Detailed goal | Keynote requirement |
|---|---|---|---|
| `P1501-P1560` | Kernel Manifest Baseline | Define phase manifest, source status, ownership, status vocabulary, invariant rows | Structure is explicit and reviewable |
| `P1561-P1640` | Kernel Contract Baseline | Bind domain packs to common contracts and compatibility checks | Domain differences are contracts, not exceptions |
| `P1641-P1720` | Spec/Status Reconciliation | Detect divergence between declared spec and actual status | Completion claims are doubted |
| `P1721-P1760` | Soft Rule Promotion Registry | Track which instructions should become deterministic checks | Soft rules are not treated as gates |
| `P1761-P1840` | Claim/Evidence/Gate Engine | Commonize claim, evidence, reviewer, gate, verdict, block reason, next action | DONE is a contract |
| `P1841-P1880` | Artifact/Check/Receipt Engine | Commonize artifacts, checks, receipts, closeout, expiry, revocation | Evidence and human approval are first-class |
| `P1881-P1960` | Harness-Native Cutover Adapter | Bind Kernel primitives into Harness development lanes, APIs, and domain handoffs | Harness becomes the operating surface |
| `P1961-P2040` | Kernel Cutover Freeze | Freeze Kernel completion and keep execution/write/protected authority closed | No execution is enabled by structure alone |

P2040 completion criteria:

```text
Kernel primitives commonized
read-only projection frozen
Harness-native lanes bound
domain rollout rows frozen no-execution
protected blocks preserved
P2041 closed until explicit Hermes-native restoration decision
runtime/write/protected/final authority still false
```

## P2041-P3200 Detailed Direction

| Range | Name | Required buildout | Must not happen |
|---|---|---|---|
| `P2041-P2120` | Nous Non-Adoption Reversal | Supersede prior Nous adapter-only policy, restore Hermes-native runtime-adjacent feature plan, and freeze P2121 handoff | Treating the prior overlap audit as active future policy |
| `P2121-P2240` | Runtime Governance Restore | Runtime API contracts, MCP registry, tool gateway policy, job scheduler ledger, install/doctor/health evidence, hard hook scaffold | Starting live runtime or worker execution |
| `P2241-P2400` | Limited Execution | Allowlisted command lane, sandbox, redaction, timeout, rollback binding, execution receipt closeout | Free terminal execution, secret exposure, unreviewed protected action |
| `P2401-P2560` | Controlled Write and Operator Console v2 | Generated patch lane, diff review packet, rollback target, human receipt apply, post-apply validation, action inbox, PASS owner | Direct Agent write by default or dashboard-hidden PASS |
| `P2561-P2720` | Memory Bank and Event Plane | Append-only event store, object store, trace/audit/cost, Archive/Sync/Index/Search/Extract/Consolidate/Relate/Recall | Ungrounded memory or cross-domain leakage |
| `P2721-P2880` | Connectors and Governance | Connector preflight, ingestion quarantine, classification, evidence spans, retrieval-first recall | Raw uncontrolled export or connector write without gate |
| `P2881-P3040` | Domain Pack Ecosystem | Pack SDK, domain ontology, goal/workflow contracts, compatibility gate, contribution model, registry | Pack install that bypasses Kernel gates |
| `P3041-P3200` | Production Governance and Work OS Freeze | L6 closed-loop proof, L7 surface declaration, AI risk, supply chain, incident, backup/restore, release readiness | Production-ready claim without closed-loop evidence |

## When Hermes Becomes the Development Surface

From `P2041` onward, Hermes should increasingly be used to define the work before Codex or another worker mutates files. The practical split is:

- `P1201-P2040`: Codex can implement, but Harness defines receipts, claims, evidence, gates, and freeze criteria.
- `P2041-P2120`: Harness supersedes the prior Nous adapter-only policy and restores Hermes-native ownership as plan.
- `P2121-P2240`: Harness restores runtime governance contracts before any live runtime execution.
- `P2241-P2400`: Harness should create work orders, evidence requirements, reviewer assignments, and rollback targets before limited execution.
- `P2401-P2560`: Harness may produce patch candidates and apply them only after human receipt.
- `P2401+`: Operator console and Memory Bank become the normal control surface for deciding what can move.

So the answer is not "stop using Codex." The answer is: start using Harness as the authority for PASS, evidence, and next allowed action after P2040; keep Codex as an implementation worker until Hermes-native controlled write has human-approved gates.

## Final Freeze Tests

The P3200 production freeze must prove:

```text
no evidence = no PASS
no PASS owner = no rollout
no receipt = no execution or write
no reviewer = no protected action
no rollback = no controlled write
no grounded recall = no memory claim
no hard gate = no safety claim
no L6 closed loop = no Work OS claim
```
