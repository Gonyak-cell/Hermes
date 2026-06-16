# Hermes Agent Bridge L9-L10 Execution Plan

Status: local-only implementation plan and evidence map.

This plan refines TUW 091-110 into testable implementation slices. It does not approve production launch, production PASS, enterprise PASS, protected closeout, deployment, GitHub independent approval, connector writes, receipt application, or final agent approval.

## Goal

Hermes Desktop can inspect the Agent Bridge limited-runtime chain as evidence:

1. dry-run executor traces show the command that would run;
2. owner limited-execution gates stay pending;
3. Agbrowse, Claude, and Codex adapter requests stay packet-only;
4. protected runtime commands are blocked by fixtures;
5. L10 preflight commands are listed as manual candidates;
6. Desktop projects the full chain without execution or transport authority.

## Pyramid

```text
Release class
  L10 release hardening
    TUW 101-110 preflight, smoke, docs, review packet, owner packet, closeout
Runtime class
  L9 limited runtime execution
    TUW 091 dry-run executor
    TUW 092 owner limited-execution gates
    TUW 093-095 provider adapter request projections
    TUW 096-099 protected runtime block fixtures
    TUW 100 L9 review packet
Evidence class
  L8 controlled execution candidate
    Existing execution candidate queue remains candidate-only
Desktop class
  L7 read-only Agents projection
    Desktop displays L9 evidence but cannot execute
```

## Testable Units

| TUW | Implementation Unit | Files | Required Check |
|---:|---|---|---|
| 091 | No-spawn dry-run executor rows | `src/agent-bridge-limited-runtime-plan.mjs` | `node --test test/agent-bridge-limited-runtime-plan.test.mjs` |
| 092 | Owner limited-execution gate rows | `src/agent-bridge-limited-runtime-plan.mjs` | owner gate rows all `owner_approval_observed: false` |
| 093 | Agbrowse request adapter projection | `provider_adapter_request_rows` | transport false |
| 094 | Claude read-only review adapter projection | `provider_adapter_request_rows` | transport false |
| 095 | Codex task request adapter projection | `provider_adapter_request_rows` | execution false |
| 096 | Git write/merge block fixtures | `blocked_runtime_command_fixture_rows` | all blocked |
| 097 | Deploy/release/publish/tag block fixtures | `blocked_runtime_command_fixture_rows` | all blocked |
| 098 | Approval/apply/receipt-apply block fixtures | `blocked_runtime_command_fixture_rows` | all blocked |
| 099 | Secret/raw transcript block fixtures | `blocked_runtime_command_fixture_rows` | all blocked |
| 100 | L9 closeout review packet | later review packet doc | independent review receipt required |
| 101 | Full local preflight candidates | `l10_preflight_candidate_rows` | listed, not executed |
| 102 | Agents visual smoke | Desktop smoke command | `npm run desktop:smoke:render -- --screen=agents` |
| 103 | Malicious runtime fixture coverage | block fixture rows | all blocked |
| 104 | Safe operation runbook | `docs/hermes-agent-bridge-local-operator-runbook-2026-06-16.md` | closeout runbook terms |
| 105 | Adapter troubleshooting | runbook troubleshooting section | docs check through closeout |
| 106 | Independent review packet | future packet artifact | not current approval |
| 107 | Owner decision packet | future owner packet | not deployment approval |
| 108 | Closeout packet | `agent-bridge-closeout-readiness` | 8/8 sources |
| 109 | Commit discipline | planning and implementation can be reviewed separately | git history |
| 110 | Release decision separation | release remains separate | production/enterprise false |

## Current Implementation Boundary

Implemented now:

- `platform:agent-bridge-limited-runtime-plan`
- `agent-bridge-limited-runtime-plan.v1` schema
- dry-run executor rows
- owner limited-execution gate rows
- provider adapter request rows for Agbrowse, Claude, and Codex
- protected runtime command fixtures
- L10 preflight candidate rows
- Desktop read-model projection
- closeout readiness source binding

Still not implemented:

- actual provider prompt submission;
- actual command execution;
- owner-approved command-run receipt application;
- production release, enterprise PASS, or protected closeout.

## Verification Envelope

Run in order:

```bash
npm run platform:agent-bridge-manifest
npm run platform:agent-bridge-request-receipt
npm run platform:agent-bridge-request-packet-export
npm run platform:agent-bridge-receipt-import-workspace
npm run platform:agent-bridge-review-finding-workbench
npm run platform:agent-bridge-execution-candidate
npm run platform:agent-bridge-limited-runtime-plan
npm run desktop:read-model
npm run platform:agent-bridge-closeout-readiness

npm run platform:agent-bridge-limited-runtime-plan -- --check
npm run desktop:read-model -- --check
npm run platform:agent-bridge-closeout-readiness -- --check
node --test test/agent-bridge-limited-runtime-plan.test.mjs test/desktop-read-model.test.mjs apps/desktop/test/read-model.test.mjs test/agent-bridge-closeout-readiness.test.mjs
npm run desktop:build
npm run desktop:smoke:render -- --screen=agents
git diff --check
```

## Stop Conditions

Stop and request owner action before:

- any command spawn from Hermes Desktop;
- any Agbrowse/Claude/Codex automatic submission;
- any git commit, push, merge, tag, release, deploy, approve, apply, or receipt application;
- any raw transcript, raw provider output, secret-like path, or credential read;
- any production PASS, enterprise PASS, or protected closeout claim.
