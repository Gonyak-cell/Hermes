---
name: law-firm-litigation-evidence-matrix
description: "Build litigation chronology and claim-evidence matrices with unverified fact and missing evidence flags."
version: 0.1.0
author: Local
license: MIT
platforms: [macos, linux]
metadata:
  hermes:
    tags: [Law-Firm, Litigation, Evidence, Chronology]
    related_skills: [law-firm-matter-ops]
    requires_toolsets: [terminal]
---

# Litigation Evidence Matrix

Use this skill for disputes, lawsuits, investigations, chronology, evidence mapping, and pleading support.

## Goal

Build a structured map connecting facts, evidence, claims, defenses, deadlines, and unanswered questions.

## Workflow

1. Confirm matter ID, court or forum if known, parties, and procedural stage.
2. Build or update chronology.
3. For each claim or defense, map:
   - asserted fact
   - supporting evidence
   - contrary evidence
   - missing evidence
   - source document
   - owner
4. Separate factual uncertainty from legal argument.
5. Highlight filing or court deadlines.
6. Produce an internal evidence matrix or briefing note.

## Deterministic Command

When a structured litigation matter JSON is available, run:

```bash
cd "${HERMES_LAW_HARNESS_DIR:-/Users/jws/Documents/Codex/Hermes}" && node scripts/litigation-matrix.mjs <matter-json-path>
```

Use that output as the factual matrix before drafting arguments or chronology prose.

## Guardrails

- Do not draft final pleadings without attorney review.
- Do not cite nonexistent cases or evidence.
- If a fact has no source document, label it as unverified.
- Treat witness summaries as interview notes, not established facts.
- If evidence contradicts a claim, present the contradiction rather than resolving it.
