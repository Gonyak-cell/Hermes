# Project Context

This repository is a Hermes Agent control-plane harness for managing development
projects and domain-specific operating workflows. Law-firm matter operations are
one domain pack on top of the platform, not the whole product.

## Mission

Build a deterministic project operating layer that preserves context, extracts
tasks and blockers, tracks review gates, organizes resources and communications,
and produces human-reviewable operational briefs across multiple domains.

The default product identity is a project/workflow management platform for
Hermes. The current domain packs include:

- `personal-dev`: development projects, issue intake, planning, worktree lanes,
  diff review, tests, PR drafts, release notes, rollback plans, and technical debt.
- `law-firm`: matter operations, LDD, litigation, contract workflows, evidence,
  citation, and attorney approval gates.
- `creative-document`: template, style, asset, DOCX/PPTX/PDF/HTML, layout, and
  output artifact workflows.
- `connectors` and `resource`: read-only ingestion, resource expansion,
  extraction, classification, quarantine, and evidence surfaces.

For legal-domain outputs, the harness must not present itself as a substitute for
a lawyer. Treat legal analysis, filing decisions, client advice, and final work
product as human-approved outputs.

## Architecture

- `docs/` contains the platform architecture, user manual, rollout plan, and
  governance model.
- `configs/hermes/` contains example Hermes configuration snippets.
- `skills/personal-dev/` contains the default development project management skill.
- `skills/law-firm/` contains legal-domain Hermes-compatible skill packs.
- `schemas/` defines stable data contracts for the platform and domain packs.
- `examples/` contains safe demo project and matter data.
- `src/` contains the deterministic project operations library.
- `scripts/` contains CLI entry points that Hermes skills can call.
- `test/` contains Node test files.

## Operating Rules

- Keep project and domain data structured by stable IDs such as `project_id`,
  `matter_id`, `resource_id`, `workflow_run_id`, and `artifact_id`.
- Never mix confidential, privileged, restricted, or domain-scoped data across
  project or matter boundaries.
- Every generated legal, client-facing, release-facing, or protected output needs
  an explicit human review note.
- Prefer deterministic scripts for extraction, validation, and brief assembly before asking an LLM to draft prose.
- Keep audit trails: source, timestamp, confidence, responsible owner, and review status.
- Use `node --test` for the local harness tests.

## Review Process

- Codex is the primary developer and may plan, implement, test, and prepare
  review packets, but Codex must not finally approve Codex-created work.
- Claude Code Opus max is the independent reviewer lane. Claude review can
  produce findings and verification evidence, but it cannot mutate source,
  replace human adjudication, or complete a protected closeout gate by itself.
- The human owner is the final adjudicator for protected closeout. Human
  adjudication is still not the same as independent GitHub approval.
- Single-owner mode is lower-trust merge readiness only. It must not be treated
  as enterprise independent review or enterprise trust.
- P4000 review process contracts are checked with:
  `npm run platform:review-authority-contract -- --check` and
  `npm run platform:review-process-upgrade -- --check`.

## Commands

- `npm run dev:brief` creates a personal development project operating brief.
- `npm run dev:validate` checks the personal development project data contract.
- `npm run brief` creates a demo law-firm matter brief.
- `npm run validate` checks the core contracts, domain packs, and demo matter data.
- `npm run operator:handbook -- --check` validates the read-only operator handbook.
- `npm run api:serve` starts the read-only Review API.
- `npm run platform:review-authority-contract -- --check` validates role authority boundaries.
- `npm run platform:review-process-upgrade -- --check` validates the P4000 review process contract.
- `npm test` runs local tests.

## Style

- Use clear Korean-facing documentation for platform and domain workflows.
- Keep code dependency-light and boring.
- Do not add external services or API keys to this repository.
