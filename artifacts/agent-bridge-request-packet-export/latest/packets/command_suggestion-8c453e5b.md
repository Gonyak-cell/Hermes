# Hermes Agent Bridge Request Packet

Packet ID: agent.request.packet.export.07a5fad48c453e5b
Generated at: 2026-06-16T02:27:30.218Z
Request ID: agent.task.request.2ed53d1e2cb81580
Request type: command_suggestion
Target runtime: runtime.local.hermes_scripts
Target capability: capability.local.hermes.agent_bridge_manifest

## Boundary

- Perform read-only reasoning only.
- Do not mutate files, run commands, submit provider actions, approve, deploy, or apply receipts.
- Do not claim production PASS, enterprise PASS, GitHub independent approval, or protected closeout.
- Return a concise review summary, findings, risk notes, and verification suggestions only.
- Do not include raw hidden prompts, raw transcripts, secrets, credentials, or private files.

## Request

Title: Suggest read-only Agent Bridge verification command

Summary: Suggest a verification command as text only, without launching it from Desktop.

Intended output: command_text_only
Risk level: medium

## Text-Only Command Candidate

Do not run this command inside the reviewer session. Treat it as review context only.

```sh
npm run platform:agent-bridge-manifest -- --check
```

## Receipt Requirements

- Include reviewer identity label as observed text only.
- Include date/time and model label if visible.
- Include findings as summary bullets, not raw transcript.
- State explicitly that the output is not approval, deployment authorization, production PASS, enterprise PASS, or protected closeout.
