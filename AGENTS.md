# Project Context

This repository is a Hermes Agent starter harness for law-firm matter operations.

## Mission

Build a matter operating layer for a law firm. The harness should preserve matter context, extract tasks and deadlines, organize documents and communications, and produce attorney-reviewable operational briefs.

The harness must not present itself as a substitute for a lawyer. Treat legal analysis, filing decisions, client advice, and final work product as human-approved outputs.

## Architecture

- `docs/` contains the law-firm architecture, rollout plan, and governance model.
- `configs/hermes/` contains example Hermes configuration snippets.
- `skills/law-firm/` contains Hermes-compatible skill packs.
- `schemas/` defines the stable matter data contract.
- `examples/` contains safe demo matter data.
- `src/` contains the deterministic matter operations library.
- `scripts/` contains CLI entry points that Hermes skills can call.
- `test/` contains Node test files.

## Operating Rules

- Keep matter data structured by `matter_id`.
- Never mix client-confidential, privileged, or restricted data across matters.
- Every generated legal or client-facing output needs an explicit human review note.
- Prefer deterministic scripts for extraction, validation, and brief assembly before asking an LLM to draft prose.
- Keep audit trails: source, timestamp, confidence, responsible owner, and review status.
- Use `node --test` for the local harness tests.

## Commands

- `npm run brief` creates a demo daily matter brief.
- `npm run validate` checks the demo matter data contract.
- `npm test` runs local tests.

## Style

- Use clear Korean-facing documentation for the law-firm workflow.
- Keep code dependency-light and boring.
- Do not add external services or API keys to this repository.
