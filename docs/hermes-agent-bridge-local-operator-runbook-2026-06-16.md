# Hermes Agent Bridge Local Operator Runbook

Status: local operator handoff runbook only.

This runbook explains how to inspect Agent Bridge evidence inside Hermes Desktop without granting execution, write, approval, deployment, production PASS, enterprise PASS, or protected closeout authority.

## Preconditions

- `npm run platform:agent-bridge-manifest -- --check`
- `npm run platform:agent-bridge-request-receipt -- --check`
- `npm run platform:agent-bridge-execution-candidate -- --check`
- `npm run platform:agent-bridge-limited-runtime-plan -- --check`
- `npm run desktop:read-model -- --check`
- `npm run desktop:preflight-smokes`

## Operator Flow

1. Open Hermes Desktop locally with `npm run desktop:dev`.
2. Select `Agents`.
3. Inspect runtime identity, capability inventory, request packets, normalized receipts, candidate commands, dry-run traces, provider adapter requests, owner gates, and execution gates.
4. Treat candidate commands and dry-run traces as display-only metadata. Do not execute them from Desktop.
5. Treat Agbrowse, Claude, and Codex adapter rows as request-packet projections only. Desktop cannot submit prompts automatically in this local-only handoff.
6. For any real command execution, prepare a separate human-approved limited execution receipt outside Desktop and re-run the relevant check after execution.

## Authority Boundary

- Desktop is not source of truth.
- Desktop cannot execute commands.
- Desktop cannot capture command output as execution evidence.
- Desktop cannot submit Agbrowse, Claude, or Codex prompts automatically.
- Desktop cannot apply receipts.
- Desktop cannot approve work.
- Desktop cannot deploy, publish, merge, push, or mutate connectors.
- Desktop cannot read secrets or raw transcripts.
- Desktop cannot create production PASS.
- Desktop cannot create enterprise PASS.
- Desktop cannot complete protected closeout.

## Closeout Meaning

`agent-bridge-closeout-readiness` means the local read-only evidence chain is inspectable and internally consistent. It is not production launch approval, enterprise approval, independent GitHub approval, protected closeout, or deployment authorization.

## L9/L10 Troubleshooting

- If `agent-bridge-limited-runtime-plan` is blocked, inspect `artifacts/agent-bridge-limited-runtime-plan/latest/validation-report.json`.
- If provider adapters are blocked, regenerate request packets with `npm run platform:agent-bridge-request-packet-export` before rerunning the limited runtime plan.
- If Desktop Agents does not show dry-run rows, regenerate in order: limited runtime plan, desktop read model, then closeout readiness.
- If a protected command appears unblocked, stop. Do not run it. Add a negative fixture before continuing.
- If an owner wants actual execution, create a separate owner limited-execution receipt with command scope, cwd, timeout, redaction, rollback, and expiry. This runbook does not grant that approval.
