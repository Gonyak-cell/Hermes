# Hermes Agent Bridge Request Packet

Packet ID: agent.request.packet.export.39cfccfc1ce5af2e
Generated at: 2026-06-16T02:27:30.218Z
Request ID: agent.task.request.5422f546b93b019e
Request type: code_review
Target runtime: runtime.claude_code.opus_max
Target capability: capability.claude.review_lane

## Boundary

- Perform read-only reasoning only.
- Do not mutate files, run commands, submit provider actions, approve, deploy, or apply receipts.
- Do not claim production PASS, enterprise PASS, GitHub independent approval, or protected closeout.
- Return a concise review summary, findings, risk notes, and verification suggestions only.
- Do not include raw hidden prompts, raw transcripts, secrets, credentials, or private files.

## Request

Title: Read-only review of Agent Bridge source diff

Summary: Ask Claude Code to review source, schema, tests, and artifacts without mutating files.

Intended output: read_only_review_receipt
Risk level: medium


## Receipt Requirements

- Include reviewer identity label as observed text only.
- Include date/time and model label if visible.
- Include findings as summary bullets, not raw transcript.
- State explicitly that the output is not approval, deployment authorization, production PASS, enterprise PASS, or protected closeout.
