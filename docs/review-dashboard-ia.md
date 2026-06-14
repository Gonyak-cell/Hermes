# Review Dashboard Information Architecture

Phase 288 adds `review_dashboard_ia`, a read-only information architecture map for the Review Dashboard.

It uses the Phase 287 API Route Inventory as its source and maps every Review API route into these navigation sections:

- Overview
- Domain Packs
- Capabilities
- Runs
- Approvals
- Evidence
- Policies
- Cost
- Diagnostics

Command:

```bash
npm run dashboard:ia -- --check
```

Outputs are written under `artifacts/review-dashboard-ia/latest`:

- `review-dashboard-ia.json`
- `review-dashboard-ia-sections.json`
- `review-dashboard-navigation-items.json`
- `review-dashboard-ia-route-bindings.json`
- `review-dashboard-ia-boundary.json`
- `review-dashboard-ia-checks.json`
- `validation-report.json`
- `summary.md`

The IA artifact is inventory-only. It does not build the dashboard, execute routes, start a server, mutate state, execute protected actions, generate legal advice, or create client-facing output.

## P4001-P4300 Conversation Source Addendum

The P4001-P4300 Work OS roadmap adds a future read-only source-plane surface on top of the existing dashboard IA. This does not replace the Phase 288 route inventory map. It defines the first P4001-P4300 operating surface:

```text
Conversation Source Queue
```

The queue is not a KPI home and not a raw chat transcript viewer. It is a Jira-inspired evidence console for:

- Codex and Claude source envelopes
- redaction and classification status
- extracted claim candidates
- plan change candidates
- source citation refs
- context recovery readiness
- reviewer and next allowed action

The invariant is:

```text
source -> claim -> citation -> review -> Harness truth
```

The source-plane contract is validated with:

```bash
npm run platform:conversation-source-plane -- --check
```

## P4601-P5000 Development Control Console Addendum

The Development Control Console is the first P8000 plan-control surface. It must show the full plan registry, goal cards, engine role badges, phase status lanes, gate cards, evidence cards, the Codex/Harness/Claude review process lane, Claude review receipt cards, transcript source links, next action cards, trust tier badges, and single-owner boundary notices.

The required milestone review process is:

```text
Codex implementation packet
Harness deterministic validation
Claude Code Opus max independent review
Finding loop and revalidation
Review receipt registration
Single-owner trust classification
```

Human adjudication is excluded from the current milestone gate. The UI must therefore display `single-owner + Claude-reviewed` as lower trust and keep protected closeout, protected final decision, and enterprise trust claims blocked.

The console contract is validated with:

```bash
npm run platform:development-control-console -- --check
```

## P5001-P5400 Verification Orchestration Addendum

The Verification Orchestration Runtime adds a verification lane to the console. It must show standard validator adapters, dual-run comparisons, negative fixtures, CI required check contracts, GitHub Actions evidence, signed attestation verify state, Claude Code Opus max review receipt completion, normalized result rows, and milestone trust decision rows.

The UI must distinguish:

```text
verification orchestration runtime ready
P5400 milestone closeout ready
enterprise trust claim enabled
```

The first can be true while the second and third remain false. In that state, the UI should display the missing external evidence: GitHub Actions run receipt, signed attestation verify receipt, and completed Claude review receipt with durable raw JSON.

The runtime contract is validated with:

```bash
npm run platform:verification-orchestration-runtime -- --check
```

## P5401-P5800 Multi-Engine Orchestration Addendum

The Multi-Engine Orchestration and Cross-Model QA lane must show engine registry rows, role assignment rows, cross-model QA packet rows, model upgrade receipt rows, engine conflict resolution rows, reviewer boundary rows, finding loop rows, and multi-engine trust decision rows.

The UI must distinguish:

```text
multi-engine QA contract ready
completed cross-model review ready
P5800 milestone closeout ready
enterprise trust claim enabled
```

The first can be true while the remaining values are false. In that state, the UI should show the missing completed Claude Code Opus max review receipt, normalized findings, and revalidation evidence.

The multi-engine contract is validated with:

```bash
npm run platform:multi-engine-orchestration-qa -- --check
```

## P5801-P6200 Review and Enterprise Trust Hardening Addendum

The Review and Enterprise Trust Hardening lane must show GitHub review lane rows, branch/ruleset evidence rows, required status check rows, signed attestation rows, Claude review receipt rows, single-owner exception rows, no-human protected-closeout boundary rows, enterprise trust decision rows, and trust negative fixtures.

The required review process shown in the UI is:

```text
Codex implementation packet
Harness deterministic validation
Claude Code Opus max independent review receipt
Finding loop and revalidation
Receipt registration
Single-owner trust classification
```

The UI must distinguish:

```text
review enterprise trust hardening ready
single-owner lower-trust mode
independent GitHub review completed now
branch/ruleset enforced now
required status checks passed now
attestation verification passed now
Claude review completed now
P6200 milestone closeout ready
enterprise trust claim enabled
```

The first two can be true while the remaining values are false. In that state, the UI should show that the current mode is `LOWER_TRUST_INTERNAL_ONLY`, that no human milestone gate is active, and that protected closeout, protected final decision, and enterprise trust remain blocked.

The review trust hardening contract is validated with:

```bash
npm run platform:review-enterprise-trust-hardening -- --check
```

## P6201-P6600 Product and Domain SaaS Factory Addendum

The Product and Domain SaaS Factory lane must show project intake rows, requirement traceability rows, domain pack factory rows, control plan rows, review process binding rows, factory UI surface rows, trust boundary rows, and factory negative fixtures.

The UI must make this distinction visible:

```text
Hermes governs many SaaS development control plans
Hermes is not the HR SaaS or law-firm SaaS itself
HR Solution control plan ready
Law Firm OS control plan ready
requirement traceability contract ready
SaaS product launch enabled
external project write enabled
raw sensitive data ingestion enabled
```

The first five can be true while the last three remain false. Project rows should show domain pack, requirement source, phase, evidence, Claude review receipt requirement, trust tier, block reason, and next allowed action. The UI must not present a control-plan-ready SaaS project as launched, enterprise-ready, or externally writable.

The product factory contract is validated with:

```bash
npm run platform:product-domain-saas-factory -- --check
```

## P6601-P7000 Controlled Execution Write and Deploy Addendum

The Controlled Execution Write and Deploy lane must show execution allowlist rows, sandbox/timeout policy rows, redaction and secret scanner rows, patch candidate lane rows, receipt-gated apply boundary rows, deploy receipt contract rows, rollback binding rows, post-apply validation rows, execution negative fixtures, and no-execution boundary state.

The UI must distinguish:

```text
allowlist contract ready
patch candidate lane ready
deploy receipt contract ready
command execution enabled
patch apply enabled
deploy enabled
external project write enabled
```

The first three can be true while the last four remain false. A generated patch candidate may have review packets, Claude receipt requirements, rollback refs, and post-apply validation refs, but it must not be shown as applied. A deploy receipt contract may be ready, but it must not be shown as a deploy run.

The controlled execution contract is validated with:

```bash
npm run platform:controlled-execution-write-deploy -- --check
```

## P7001-P7300 Memory Bank Storage Event and Observability Plane Addendum

The Memory Bank Storage Event and Observability Plane lane must show append-only event rows, object artifact reference rows, transcript source event bindings, review receipt event bindings, gate verdict event ledger rows, trace/audit/cost observability rows, retention/backup/restore rows, memory storage index rows, and memory negative fixtures.

The UI must distinguish:

```text
append-only event store ready
object artifact reference store ready
transcript source event binding ready
review receipt event binding ready
memory storage index ready
runtime recall enabled
retrieval layer enabled
raw transcript default access enabled
```

The first five can be true while the last three remain false. The UI may show source envelopes, object refs, hashes, redaction status, review receipt refs, and gate verdict refs, but it must not expose raw transcript bodies by default or present storage-index readiness as recalled memory truth.

The memory event plane contract is validated with:

```bash
npm run platform:memory-bank-event-observability-plane -- --check
```

## P7301-P7600 Retrieval Ontology and Context Recall Layer Addendum

The Retrieval Ontology and Context Recall Layer lane must show retrieval ontology rows, source-cited search rows, extracted fact and claim recall rows, consolidation/conflict rows, relation graph rows, next-session recall bundle rows, domain boundary filter rows, staleness/freshness rows, recall negative fixtures, and the Codex/Harness/Claude milestone review requirement.

The UI must distinguish:

```text
retrieval ontology ready
source-cited search ready
next-session recall bundle ready
Claude review receipt required
uncited recall allowed
raw transcript recall allowed
auto context mutation enabled
recall as final approval enabled
Work OS claim enabled
```

The first four can be true while the remaining values stay false. A recall bundle may help restart a session, but the UI must display it as cited context material, not final truth or approval. Missing Claude Code Opus max review receipt remains a visible milestone blocker.

The retrieval recall contract is validated with:

```bash
npm run platform:retrieval-ontology-context-recall-layer -- --check
```

## P7601-P7800 Security Governance Compliance and Rule Conflict Plane Addendum

The Security Governance Compliance and Rule Conflict Plane lane must show secret/raw material rows, prompt-injection rows, rule conflict graph rows, stale gate/policy drift rows, incident recovery rows, compliance pack rows, governance UI queues, negative fixtures, and Claude governance review packet rows.

The UI must distinguish:

```text
secret raw material governance ready
prompt injection boundary ready
rule conflict graph ready
stale gate detector ready
Claude governance review receipt required
policy override allowed
secret leak allowed
stale PASS allowed
rule conflict auto-resolve allowed
compliance theater allowed
```

The first five can be true while the last five remain false. The governance UI should make blockers more visible, not turn them into passive KPI summaries.

The security governance contract is validated with:

```bash
npm run platform:security-governance-compliance-rule-conflict-plane -- --check
```

## P7801-P8000 Full Work OS UI and Production Freeze Addendum

The Full Work OS UI and Production Freeze lane must show navigation freeze rows, closed-loop maturity evidence rows, operator action inbox rows, domain rollout rows, API/handbook alignment rows, milestone Claude review ledger rows, trust tier rows, negative fixtures, production freeze packets, and final freeze rows.

The UI must distinguish:

```text
full Work OS navigation ready
closed-loop evidence contract ready
operator action inbox ready
milestone Claude review ledger ready
single-owner lower trust ready
L6 closed-loop proof passed now
Work OS production claim enabled
enterprise trust claim enabled
```

The first five can be true while the last three remain false. The UI may look like a Work OS, but it must label P8000 as contract/freeze readiness until L6/L7 proof and enterprise-independent evidence exist.

The Work OS freeze contract is validated with:

```bash
npm run platform:work-os-ui-production-freeze -- --check
```
