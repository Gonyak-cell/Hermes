# Hermes Agent Runtime Activation Bridge Phase Ledger (P1201-P1320)

P1201 starts after the P1199-P1200 Agent Runtime Pilot Readiness Freeze. The
P1200 freeze may close as `ready_for_human_approved_agent_runtime_pilot`, but it
does not authorize package download, install execution, runtime start, terminal
execution, MCP/API/cron startup, provider secret setup, raw material access,
direct Zendd mutation, protected action execution, receipt application, legal
final judgment, release decision, or Agent-created final PASS.

The P1201-P1320 bridge turns the P1200 readiness freeze into concrete
receipt-backed activation lanes. It still keeps real execution disabled. The
program closes only when every future activation path has a human receipt
requirement, rollback or quarantine binding, no-raw-material invariant, operator
visibility, and a documented next allowed action.

## P1201-P1220 Runtime Human Receipt Intake

`platform:agent-runtime-activation-bridge -- --check` creates the receipt intake
contract for future Agent activation. Receipt templates may PASS as templates
only; no receipt payload is present and no receipt is applied.

Acceptance for P1201-P1220:

- P1201 consumes `platform:agent-runtime-pilot-freeze -- --check` and requires
  `ready_for_human_approved_agent_runtime_pilot`.
- P1202-P1206 creates receipt templates for install, doctor/smoke, runtime
  start, terminal, MCP, API, cron, provider secret setup, raw material access,
  Zendd action, protected action, receipt application, release/legal/final
  authority, and final freeze paths.
- P1207-P1211 requires actor, scope, evidence refs, rollback target, expiry,
  quarantine rule, reviewer, hard gate, and next allowed action for every
  receipt class.
- P1212-P1216 quarantines unsigned, stale, unscoped, cross-domain, Agent-authored,
  raw-secret, raw-client/VDR, direct-PASS, and direct-Zendd-write receipt
  payloads.
- P1217-P1220 proves receipt absence means no package download, install,
  runtime, terminal, MCP, API, cron, secret setup, raw access, Zendd write,
  protected action, receipt application, legal/release decision, or Agent final
  PASS.

## P1221-P1240 Approved Install Lane

The approved install lane defines how a future validated receipt can select an
install mode. It does not download packages or install anything.

Acceptance for P1221-P1240:

- P1221-P1224 carries the P1200 install provenance and P1201 receipt templates.
- P1225-P1228 keeps repo-local venv as the default recommended candidate, with
  pipx and Docker as additional candidates.
- P1229-P1232 blocks one-line git-main installers, global pip, root/sudo
  installs, package download, install execution, and rollback execution until a
  validated receipt is present.
- P1233-P1240 binds every candidate and block row to evidence, reviewer, hard
  gate, owner, rollback target, receipt requirement, and next allowed action.

## P1241-P1260 Doctor/Smoke Evidence Capture

Doctor/smoke capture defines future evidence templates for version, doctor,
config-check, help, and tool-policy probes. It does not execute commands.

Acceptance for P1241-P1260:

- P1241-P1244 requires approved install evidence before any doctor command can
  run.
- P1245-P1248 defines redacted summary, stdout hash, stderr hash, exit code, and
  evidence refs as future output fields.
- P1249-P1252 forbids raw stdout/stderr, raw secrets, raw client/VDR material,
  provider key material, terminal enablement, tool enablement, and Agent final
  PASS from doctor evidence.
- P1253-P1260 keeps all doctor/smoke command rows blocked until install
  execution is proven by a validated receipt and closeout.

## P1261-P1280 L0 Runtime Adapter Pilot

L0 attaches the Agent as a read-only planner and evidence summarizer. It is not
an execution runtime and not a final adjudicator.

Acceptance for P1261-P1280:

- P1261-P1264 registers L0 adapters for platform, personal-dev, law-firm,
  creative-document, connectors/resource, trading, and project.zendd.
- P1265-P1270 allows only normalized refs, policy rows, redacted summaries,
  work-order candidates, evidence candidates, review candidates, rollback
  candidates, and next allowed actions.
- P1271-P1276 blocks terminal execution, MCP connection, API/cron start, file
  write, package install, provider secret setup, raw material access,
  cross-domain forwarding, direct Zendd mutation, protected action, legal final
  judgment, release decision, and Agent final PASS.
- P1277-P1280 binds every adapter to human gate policy, reviewer, hard gate,
  rollback target, and operator surface refs.

## P1281-P1300 Zendd No-Write Agent Pilot

The Zendd pilot converts external-project adapter outputs into Agent-visible
candidate packets while preserving the external adapter and no-write boundary.

Acceptance for P1281-P1300:

- P1281-P1284 consumes the P1200 Zendd candidate bridge and existing Zendd
  no-write adapter chain.
- P1285-P1292 creates candidate packets for work order, diff review, rollback
  plan, command evidence, release sandbox, and VDR/LDD review.
- P1293-P1296 blocks raw VDR/client access, direct file writes, source tree
  movement, terminal command execution, protected action execution, receipt
  application, release publish, and legal final judgment.
- P1297-P1300 binds every Zendd packet to source refs, human receipt
  requirement, rollback target, reviewer, hard gate, owner, and next allowed
  action.

## P1301-P1320 Activation Bridge Freeze

The freeze re-adjudicates every P1201-P1300 row. It may close as
`ready_for_agent_runtime_activation_bridge`, but real execution remains blocked
until a future validated receipt and post-Kernel execution lane exist.

Acceptance for P1301-P1320:

- P1301 consumes all P1201-P1300 activation rows and requires every source row
  to be PASS as a template/candidate or documented BLOCK with reason.
- P1302-P1308 verifies receipt absence, install absence, doctor absence, runtime
  absence, and Zendd no-write boundaries all remain true.
- P1309-P1314 verifies every PASS row has evidence, reviewer, hard gate, owner,
  and next allowed action; every BLOCK row has block reason, owner, gate, and
  next allowed action.
- P1315-P1318 projects operator-visible bridge rows without starting a server or
  adding mutation routes.
- P1319-P1320 proves no package download, install, command execution, runtime
  start, MCP/API/cron start, provider secret setup, raw secret/client/VDR access,
  direct Zendd mutation, protected action, receipt application, legal final
  judgment, release decision, or Agent-created final PASS occurred.
