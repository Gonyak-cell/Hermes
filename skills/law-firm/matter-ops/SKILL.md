---
name: law-firm-matter-ops
description: "Create law-firm matter briefs, task/deadline registers, and review-gated operational summaries."
version: 0.1.0
author: Local
license: MIT
platforms: [macos, linux]
metadata:
  hermes:
    tags: [Law-Firm, Matter-Management, Legal-Ops, Briefing]
    requires_toolsets: [terminal]
---

# Law Firm Matter Ops

Use this skill when asked to produce a matter brief, organize matter context, extract task/deadline candidates, or summarize law-firm operational status.

## Core Rule

This skill supports lawyers and legal staff. It does not make final legal judgments. Any client-facing output, legal conclusion, filing, contract markup, or billing decision needs attorney review.

## Inputs

Prefer a structured matter JSON file matching `schemas/matter.schema.json`.

If the user gives raw notes, create a draft matter JSON first and mark uncertain fields as pending review.

## Workflow

1. Identify the matter ID, client, practice area, confidentiality level, and authorized team.
2. Validate structured data before summarizing.
3. Run the deterministic brief generator:

```bash
cd "${HERMES_LAW_HARNESS_DIR:-/Users/jws/Documents/Codex/Hermes}" && node scripts/matter-brief.mjs <matter-json-path>
```

4. Use the brief as the factual operating layer.
5. If asked for prose, draft only internal attorney-reviewable language.
6. End with a review gate note naming what requires human approval.

## KakaoTalk and Outlook Intake

For KakaoTalk exports:

```bash
cd "${HERMES_LAW_HARNESS_DIR:-/Users/jws/Documents/Codex/Hermes}" && node scripts/intake-kakao.mjs <matter-json-path> <kakaotalk-export.txt>
```

For Outlook `.eml`, Outlook JSON, or a folder of `.eml` files:

```bash
cd "${HERMES_LAW_HARNESS_DIR:-/Users/jws/Documents/Codex/Hermes}" && node scripts/intake-outlook.mjs <matter-json-path> <email-or-folder-path>
```

Treat all extracted items as review candidates.

## Output Format

- Matter snapshot
- Urgent tasks and deadlines
- Missing/requested documents
- High or critical open risks
- Pending client/team questions
- Billing/WIP notes if present
- Review gate

## Escalation Triggers

Escalate to the responsible partner if any of these appear:

- deadline due within 48 hours
- high or critical risk without owner
- client question older than 3 business days
- missing document needed for closing or filing
- request to send external communication directly
- request to make legal conclusion without cited source and reviewer
