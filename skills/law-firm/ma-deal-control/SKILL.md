---
name: law-firm-ma-deal-control
description: "Track M&A VDR requests, Q&A, negotiation points, CPs, and closing deliverables."
version: 0.1.0
author: Local
license: MIT
platforms: [macos, linux]
metadata:
  hermes:
    tags: [Law-Firm, M&A, Due-Diligence, Closing, VDR]
    related_skills: [law-firm-matter-ops]
    requires_toolsets: [terminal]
---

# M&A Deal Control

Use this skill for M&A, investment, SPA, SHA, VDR, due diligence, CP, and closing checklist work.

## Goal

Maintain deal control. The valuable output is not a free-form legal answer; it is a current map of open issues, missing materials, negotiation points, conditions precedent, and closing deliverables.

## Workflow

1. Confirm matter ID and transaction role.
2. Split inputs into:
   - due diligence requests
   - VDR documents
   - Q&A items
   - SPA/SHA negotiation issues
   - CP and closing deliverables
   - client questions
3. Identify owner, due date, source, and review status for each item.
4. Flag items that block signing, closing, or client reporting.
5. Prepare a concise deal-control brief.

## Deterministic Command

When a structured matter JSON is available, run:

```bash
cd "${HERMES_LAW_HARNESS_DIR:-/Users/jws/Documents/Codex/Hermes}" && node scripts/deal-control.mjs <matter-json-path>
```

Use that output as the factual control layer before drafting prose.

## Preferred Tables

- Open DD issues
- Pending client questions
- SPA/SHA negotiation points
- CP checklist
- Closing deliverables
- Risk flags

## Guardrails

- Do not invent fallback clauses without saying they need attorney drafting review.
- Do not mark a CP complete without source evidence.
- Do not treat VDR absence as factual non-existence; label it as missing from reviewed source.
- Do not tell the client that closing is ready unless every CP item is complete and partner approval is recorded.
