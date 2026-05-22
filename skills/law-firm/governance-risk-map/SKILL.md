---
name: law-firm-governance-risk-map
description: "Map board, shareholder, disclosure, and governance review candidates for attorney review."
version: 0.1.0
author: Local
license: MIT
platforms: [macos, linux]
metadata:
  hermes:
    tags: [Law-Firm, Governance, Board, Disclosure]
    related_skills: [law-firm-matter-ops]
    requires_toolsets: [terminal]
---

# Governance Risk Map

Use this skill for board minutes, shareholder meetings, director duties, disclosure review, shareholder derivative actions, and corporate governance risk mapping.

## Goal

Detect operational review points across governance documents. The skill should find inconsistencies, missing approvals, unresolved conflicts, and follow-up questions.

## Workflow

1. Confirm entity, matter ID, time period, and transaction or dispute context.
2. Gather board minutes, shareholder meeting materials, disclosures, internal memos, and communication summaries.
3. Extract:
   - decision date
   - attendees
   - agenda and resolution
   - interested parties
   - dissent or abstention
   - approval threshold
   - follow-up action
4. Compare documents for inconsistent dates, attendees, approvals, or risk disclosures.
5. Produce a governance risk map for attorney review.

## Guardrails

- Do not state that a director breached a duty as a final conclusion.
- Phrase findings as review candidates unless a lawyer has approved the conclusion.
- Preserve source references for every inconsistency.
