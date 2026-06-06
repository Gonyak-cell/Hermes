# Retrieval Ontology Context Recall Layer

P7301-P7600 turns the P7001-P7300 memory event plane into a cited recall layer.

The point is not to say Hermes "remembers." A recall bundle is only useful when it carries source citations, source status, freshness state, conflict state, domain boundary filters, review refs, and next allowed actions.

The milestone review process is:

```text
Codex implementation packet
Harness deterministic validation
Claude Code Opus max independent review receipt
Finding loop and revalidation
Receipt registration
Single-owner trust classification
```

Claude Code Opus max is the independent reviewer lane. It cannot mutate source, approve protected closeout, or convert recall into final truth. Human adjudication is excluded from this milestone gate, so protected closeout, protected final decision, enterprise trust, runtime execution, write, and Work OS production claims remain disabled.

## Phase Coverage

| Range | Name | Contract |
|---|---|---|
| `P7301-P7330` | Retrieval Ontology Contract | Project, domain, workflow, phase, gate, evidence, review, transcript, and next-condition ontology |
| `P7331-P7360` | Source-Cited Search Contract | Search results require source citation and source status |
| `P7361-P7390` | Extracted Fact and Claim Recall Contract | Recall facts remain candidates until cited and reviewed |
| `P7391-P7420` | Consolidation and Conflict Resolution | Conflicts require visible conflict notes |
| `P7421-P7450` | Relation Graph Context Compiler | Claim, evidence, review, gate, plan, transcript, and next-condition edges |
| `P7451-P7480` | Next-Session Recall Bundle | Cited next-session bundles without auto mutation |
| `P7481-P7510` | Domain and Project Boundary Filters | Project, domain, matter, sensitivity, and tenant walls |
| `P7511-P7540` | Staleness and Freshness Policy | Freshness notes and revalidation requirements |
| `P7541-P7570` | Recall Negative Fixtures | Unsafe recall claims blocked as expected |
| `P7571-P7600` | Retrieval Ontology Context Recall Freeze | Schema, artifacts, tests, gates, and boundary freeze |

## Boundary

The layer may produce cited next-session recall bundles. It must not:

- expose raw transcript bodies by default
- recall uncited facts
- present stale facts as current
- cross project, matter, HR, connector, or domain boundaries
- hide conflicting facts
- mutate plans or policies automatically
- treat recall as protected final approval
- claim enterprise trust or Work OS production readiness

## Validation

```bash
npm run platform:retrieval-ontology-context-recall-layer -- --check
```
