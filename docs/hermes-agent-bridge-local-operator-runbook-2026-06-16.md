# Hermes Agent Bridge Local Operator Runbook

Status: local operator handoff runbook only.

This runbook explains how to inspect Agent Bridge evidence inside Hermes Desktop without granting execution, write, approval, deployment, production PASS, enterprise PASS, or protected closeout authority.

## Preconditions

- `npm run platform:agent-bridge-manifest -- --check`
- `npm run platform:agent-bridge-request-receipt -- --check`
- `npm run platform:agent-bridge-execution-candidate -- --check`
- `npm run desktop:read-model -- --check`
- `npm run desktop:preflight-smokes`

## Operator Flow

1. Open Hermes Desktop locally with `npm run desktop:dev`.
2. Select `Agents`.
3. Inspect runtime identity, capability inventory, request packets, normalized receipts, candidate commands, and execution gates.
4. Treat candidate commands as display-only metadata. Do not execute them from Desktop.
5. For any real command execution, prepare a separate human-approved limited execution receipt outside Desktop and re-run the relevant check after execution.

## Authority Boundary

- Desktop is not source of truth.
- Desktop cannot execute commands.
- Desktop cannot capture command output as execution evidence.
- Desktop cannot apply receipts.
- Desktop cannot approve work.
- Desktop cannot deploy, publish, merge, push, or mutate connectors.
- Desktop cannot read secrets or raw transcripts.
- Desktop cannot create production PASS.
- Desktop cannot create enterprise PASS.
- Desktop cannot complete protected closeout.

## Closeout Meaning

`agent-bridge-closeout-readiness` means the local read-only evidence chain is inspectable and internally consistent. It is not production launch approval, enterprise approval, independent GitHub approval, protected closeout, or deployment authorization.
