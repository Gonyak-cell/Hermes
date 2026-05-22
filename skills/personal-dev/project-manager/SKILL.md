---
name: personal-dev-project-manager
description: "Manage the user's software projects: daily focus, blockers, reviews, milestones, and release readiness."
version: 0.1.0
author: Local
license: MIT
platforms: [macos, linux]
metadata:
  hermes:
    tags: [Personal-Dev, Project-Management, Software, Daily-Brief]
    requires_toolsets: [terminal, file]
---

# Personal Dev Project Manager

Use this skill when the user wants Hermes to manage software projects they are building.

## Purpose

Keep the user moving. The output should answer:

- What should I work on today?
- What is blocked?
- What needs review?
- Which project is at risk?
- What is the smallest next action?
- What has to be true before release?

## Source of Truth

Prefer a structured developer project portfolio JSON:

```text
examples/dev-projects.json
```

Schema:

```text
schemas/dev-projects.schema.json
```

## Deterministic Commands

Validate the portfolio:

```bash
cd "${HERMES_LAW_HARNESS_DIR:-/Users/jws/Documents/Codex/Hermes}" && node scripts/validate-dev-projects.mjs examples/dev-projects.json
```

Generate the daily developer project brief:

```bash
cd "${HERMES_LAW_HARNESS_DIR:-/Users/jws/Documents/Codex/Hermes}" && node scripts/dev-project-brief.mjs examples/dev-projects.json
```

## Workflow

1. Read the portfolio.
2. Validate it.
3. Generate the deterministic brief.
4. Ask one clarifying question only if the next action cannot be inferred.
5. Keep recommendations concrete and small enough for a 30-90 minute work block.
6. If a project is blocked, reduce the blocker to one command, file, decision, or message.
7. If a project has no next task, create a candidate task rather than doing broad planning.

## Output Shape

- Today's focus
- Blocked items
- Review queue
- Project risk
- Next 30-90 minute work block
- Release checklist gaps

## Guardrails

- Do not turn the brief into a giant productivity essay.
- Do not invent repository state. If code state matters, inspect the repository.
- Do not mark a task done unless the user confirms or a command verifies it.
- Preserve the user's actual priorities over generic productivity advice.
