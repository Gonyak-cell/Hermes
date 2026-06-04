# Hermes Connectors and Data Governance Phase Ledger

This ledger covers `P2721-P2880`. It consumes `platform:memory-event-observability-plane` and defines the connector governance contract.

## Objective

Define connector preflight, source registry, ingestion quarantine, classification, evidence spans, retrieval-first recall, connector write blocks, and the `P2881-P3040` domain pack handoff. This program does not connect services, ingest resources, export raw material, read secrets, write back to connectors, or install domain packs.

## Phase Slices

| Range | Slice | Goal |
|---|---|---|
| `P2721-P2740` | Connector Registry | Define GitHub, issue, mail/calendar, drive/files, resource upload, and external checkout connector rows |
| `P2741-P2760` | Connector Preflight | Define auth handle, scope, rate limit, raw material policy, domain boundary, and health check rows |
| `P2761-P2780` | Ingestion Quarantine | Define raw capture handle, redacted summary, quarantine bucket, dedupe hash, source status, and release gate rows |
| `P2781-P2800` | Classification Policy | Define domain, sensitivity, retention, privilege, PII/secret, and actionability classification rows |
| `P2801-P2820` | Evidence Spans | Define source span, excerpt hash, citation, confidence, freshness, and owner rows |
| `P2821-P2840` | Retrieval-First Policy | Define retrieval-first, grounded recall, no bulk export, redaction, and reviewer gate rows |
| `P2841-P2860` | Connector Action Blocks | Block connector write, raw export, secret lookup, destructive sync, and cross-domain transfer |
| `P2861-P2880` | Domain Pack Handoff | Freeze P2881 handoff with domain pack install, connector write, and production authority still closed |

## Source

- Source command: `platform:memory-event-observability-plane`
- Source phase: `P2561-P2720`
- Required status: `ready_for_platform_memory_event_observability_plane`
- Required boundary: connector ingestion and raw material access are still false

## Guard Rules

- Connector registry rows do not open connections.
- Preflight rows are required but not run by this program.
- Ingestion quarantine rows do not ingest or release raw material.
- Classification rows are required before retrieval or memory recall.
- Evidence spans must use citations, freshness, confidence, and owner notes without raw excerpt exposure.
- Retrieval is retrieval-first, redacted, and review-gated; bulk raw export is blocked.
- Connector write, raw export, secret lookup, destructive sync, and cross-domain transfer are blocked by default.
- Handoff to `P2881-P3040` does not enable domain pack install, connector write, or production readiness.

## Completion Criteria

```text
source memory event observability ready
connector registry rows defined
connector preflight rows defined
ingestion quarantine rows defined
classification rows defined
evidence span rows defined
retrieval-first rows defined
connector action block rows defined
P2881 handoff ready
connector connected now = false
ingestion started now = false
raw export performed now = false
connector write/secret/cross-domain authority false
unsafe flag count = 0
ready_for_platform_connectors_data_governance
```

## Validation

Run:

```bash
npm run platform:connectors-data-governance -- --check
```
