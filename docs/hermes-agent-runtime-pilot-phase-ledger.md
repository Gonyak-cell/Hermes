# Hermes Agent Runtime Pilot Phase Ledger (P1122-P1200)

P1122 starts after commit `4cfda48 Add Hermes Agent operations adoption freeze`.
The P1041-P1121 Agent adoption freeze remains the source of truth: Agent output
may create read-only surfaces, packets, candidates, evidence, and next allowed
actions, but it must not install packages, start runtimes, execute terminal
commands, connect MCP, start API/cron services, configure provider secrets,
expose raw secret/client/VDR material, mutate Zendd directly, execute protected
actions, or create final PASS, approval, legal final judgment, or release
decisions.

## P1122-P1124 Baseline Lock

P1122-P1124 records the committed P1041-P1121 baseline and opens the runtime
pilot readiness program.

Acceptance for P1122-P1124:

- P1122 records commit `4cfda48 Add Hermes Agent operations adoption freeze`.
- P1123 revalidates `platform:agent-adoption-freeze -- --check` as the source
  freeze for later pilot work.
- P1124 opens the P1122-P1200 runtime pilot chain without enabling install,
  runtime, terminal, MCP, API, cron, secret, raw material, Zendd mutation,
  protected action, or Agent-created final PASS.

## P1125-P1132 Agent Operator Surface

`platform:agent-operator-surface -- --check` projects the adoption freeze into
operator-visible read-only surfaces. It does not start a server and does not add
mutation routes.

Acceptance for P1125-P1132:

- P1125 consumes `platform:agent-adoption-freeze -- --check` and requires
  `ready_for_agent_adoption_freeze`.
- P1126 surfaces the five adoption-freeze sources and their 211 source claims:
  164 PASS and 47 documented BLOCK.
- P1127 creates dashboard rows for freeze summary, source health, claim audit,
  invariant watch, protected blocks, and next actions.
- P1128 creates read-only planned GET routes for sources, claim audit,
  invariants, protected blocks, and next actions.
- P1129 surfaces all 16 protected Agent blocks with block reason, owner, human
  receipt template ref, and next allowed action.
- P1130 creates next-action rows while keeping execution disabled.
- P1131 documents mutation routes as BLOCK: runtime start, install execution,
  receipt apply, MCP connect, API server start, cron/gateway start, raw material
  export, and direct Zendd write.
- P1132 proves no server start, route mutation, receipt payload, receipt
  application, install execution, runtime execution, terminal execution, MCP
  connection, cron/gateway start, provider secret setup, raw secret/client/VDR
  exposure, direct Zendd mutation, protected action, or Agent-created final PASS
  occurred.
- P1132 closes as `ready_for_agent_operator_surface`.

## P1133-P1140 Runtime Human Receipt Contract

Future command: `platform:agent-runtime-receipt-contract -- --check`.

The receipt contract will define the human approvals required before install,
doctor smoke, runtime start, terminal execution, MCP connection, API server
start, cron/gateway start, receipt application, raw material access, or protected
domain actions. Receipt templates may PASS as templates only; missing payloads
must remain documented BLOCK.

## P1141-P1150 Isolated Install Packet v2

`platform:agent-install-packet -- --check` prepares install packet plans for the
repo-local venv, pipx, and Docker candidates. The command consumes both the
P1057-P1064 isolated install gate and the P1133-P1140 runtime receipt contract,
then turns install readiness into metadata-only packets.

Acceptance for P1141-P1150:

- P1141 consumes `platform:agent-runtime-receipt-contract -- --check` and
  `platform:agent-isolated-install-gate -- --check`.
- P1142 prepares three install packet rows: repo-local venv, pipx, and Docker.
- P1143 records version pin, provenance, rollback, receipt, and no-secret
  evidence refs without materializing packet files.
- P1144 blocks packet materialization until a validated human receipt exists.
- P1145 blocks package download and install execution.
- P1146 carries rollback targets without executing rollback commands.
- P1147 projects doctor smoke preflight rows without running commands.
- P1148 records PASS/BLOCK claims with evidence, reviewer, gate, owner, and next
  action fields.
- P1149 keeps provider secrets, raw material, terminal execution, runtime start,
  MCP, API, cron, protected actions, and Agent final PASS disabled.
- P1150 closes the install packet as ready-for-pilot metadata, not as an
  installed Agent runtime.

## P1151-P1160 Doctor/Smoke Evidence Bridge

`platform:agent-doctor-evidence-bridge -- --check` converts the install packet
doctor preflight into future evidence templates, probe gates, output bindings,
and safety rules.

Acceptance for P1151-P1160:

- P1151 consumes `platform:agent-install-packet -- --check`.
- P1152 creates templates for version, doctor, config-check, help, and
  tool-policy probes.
- P1153 requires redacted summaries plus stdout/stderr hashes for any future
  probe output.
- P1154 keeps all doctor probe commands BLOCK until an approved install packet
  has actually executed.
- P1155 keeps output bindings BLOCK while no doctor output payload exists.
- P1156 rejects raw stdout/stderr storage as durable evidence.
- P1157 forbids provider secret, raw secret, raw client, or raw VDR material in
  doctor evidence.
- P1158 forbids runtime start, tool enablement, protected action execution, and
  Agent-created final PASS from doctor evidence.
- P1159 records every doctor claim as PASS template/safety or documented BLOCK.
- P1160 closes doctor evidence bridge as ready-for-future-output, not as a
  successful doctor run.

## P1161-P1170 Tool Policy And Sandbox Matrix

`platform:agent-tool-policy-matrix -- --check` maps Agent tool classes across
all registered domains and emits per-domain sandbox profiles.

Acceptance for P1161-P1170:

- P1161 consumes `platform:agent-doctor-evidence-bridge -- --check` and the
  Agent capability registry.
- P1162 maps terminal, MCP, browser, file write, package install,
  secret-handle reference, raw material access, and domain mutation for each
  domain.
- P1163 records browser and secret-handle rows as policy-defined PASS only,
  with execution still disabled.
- P1164 documents terminal, MCP, file write, package install, raw material, and
  domain mutation rows as BLOCK.
- P1165 emits sandbox profiles for all registered domains.
- P1166 keeps raw secret, raw client/VDR, direct Zendd mutation, and Agent final
  PASS as unsafe BLOCK rows.
- P1167 requires human receipt before any execution-capable tool request.
- P1168 keeps provider secret configuration and package install disabled.
- P1169 records claims with evidence, reviewer, gate, owner, and next action.
- P1170 closes the matrix as policy-ready only; no tool, browser, MCP, package,
  file, secret, raw material, or domain mutation action is executed.

## P1171-P1180 Domain Adapter SDK v1

`platform:agent-domain-adapter-sdk -- --check` standardizes adapter contracts
for all registered domains without executing adapters or mutating domain data.

Acceptance for P1171-P1180:

- P1171 consumes `platform:agent-tool-policy-matrix -- --check` and the Agent
  capability registry.
- P1172 emits adapter contracts for every registered domain.
- P1173 requires input normalization and forbidden-input enforcement.
- P1174 requires prompt packet drafting from refs and policy rows only.
- P1175 requires output sanitization before any operator surface row exists.
- P1176 binds every adapter claim to evidence, reviewer, hard gate, owner, and
  next action.
- P1177 attaches human receipt requirements for protected outputs.
- P1178 attaches rollback targets for future mutation or execution packets.
- P1179 blocks raw secret, raw client/VDR, direct mutation, direct Zendd write,
  missing reviewer/gate, missing receipt, and Agent final PASS outputs.
- P1180 closes the SDK as contract-ready only; no adapter execution, raw
  material exposure, receipt application, domain mutation, or final PASS occurs.

## P1181-P1188 Zendd Agent Candidate Bridge

`platform:agent-zendd-candidate-bridge -- --check` projects Zendd external
adapter outputs into Agent-visible candidate packets.

Acceptance for P1181-P1188:

- P1181 consumes `platform:agent-domain-adapter-sdk -- --check` and the Zendd
  external adapter chain.
- P1182 emits work-order candidate packets from Zendd work order intake.
- P1183 emits patch-plan candidate packets from the safe patch lane.
- P1184 emits command-evidence candidate packets without executing commands.
- P1185 emits VDR/LDD candidate packets through source-span refs only.
- P1186 emits release-sandbox candidate packets without artifact materializing,
  publishing, or client delivery.
- P1187 binds every candidate packet to the `project.zendd` adapter contract,
  human receipt requirement, rollback target, and operator row.
- P1188 keeps direct Zendd writes, source tree movement, terminal/command
  execution, raw client/VDR exposure, protected output finalization, release
  publish, receipt application, package/build artifacts, and Agent final PASS as
  documented BLOCK.

## P1189-P1194 Delegation/Subagent Contract

Command: `platform:agent-delegation-contract -- --check`.

The delegation contract separates domain observer, work-order planner, evidence
packet drafter, and review packet drafter roles. These roles are contract rows
for dry-run simulation only; they do not spawn subagents, invoke tools, start
services, forward raw material, execute protected actions, or create final PASS,
approval, legal final judgment, or release decisions.

Acceptance for P1189-P1194:

- P1189 consumes `platform:agent-zendd-candidate-bridge -- --check` and
  `platform:agent-capability-registry -- --check` as source evidence.
- P1190 emits four delegation roles for each registered domain.
- P1191 emits one safe handoff channel per domain with allowed refs and
  forbidden raw/secret/final-authority payload fields.
- P1192 emits five Zendd delegation packets from P1181-P1188 candidate packets.
- P1193 documents autonomous subagent spawn, background loops, cross-domain data
  forwarding, raw secret/client/VDR forwarding, terminal/MCP/API/cron start,
  direct Zendd mutation, protected action execution, and Agent final authority as
  BLOCK.
- P1194 closes delegation as contract-ready only; no subagent spawn, runtime
  execution, tool invocation, data forwarding, raw exposure, receipt application,
  protected action, release decision, legal final judgment, or final PASS occurs.

## P1195-P1198 Dry-run Runtime Simulation

Command: `platform:agent-dry-run-simulation -- --check`.

The simulation will create would-run evidence without running Hermes Agent. It
must prove runtime, terminal, MCP, API, cron, secret, raw material, Zendd write,
and protected action paths remain disabled.

Acceptance for P1195-P1198:

- P1195 consumes delegation, install packet, doctor evidence, tool policy, and
  runtime receipt contract sources as evidence.
- P1196 emits would-run scenario rows for install, doctor, terminal/MCP,
  API/cron, secret setup, domain adapter, Zendd delegation, protected action,
  and final freeze paths.
- P1197 emits redacted dry-run evidence packets only; no raw stdout/stderr,
  raw secret, raw client/VDR material, command execution, runtime start, or
  service startup occurs.
- P1198 documents runtime, terminal, MCP, API, cron, package download/install,
  provider secret setup, raw material access, cross-domain forwarding, direct
  Zendd mutation, protected action execution, receipt application, Agent final
  authority, legal final judgment, and release decision as BLOCK until the final
  readiness freeze and required human receipt.

## P1199-P1200 Agent Runtime Pilot Readiness Freeze

Command: `platform:agent-runtime-pilot-freeze -- --check`.

The final freeze will re-adjudicate all P1122-P1198 claims. Every claim must be
PASS with evidence/reviewer/gate and required receipt refs, or documented BLOCK
with block reason, owner, human gate when protected, and next allowed action.
The expected closing status is `ready_for_human_approved_agent_runtime_pilot`;
runtime execution still remains BLOCK until a future human receipt is validated.

Acceptance for P1199-P1200:

- P1199 consumes all Agent Runtime Pilot sources from P1122-P1198.
- P1199 audits every source claim row for PASS evidence/reviewer/gate/owner/next
  action, or documented BLOCK reason/owner/next action.
- P1200 documents runtime execution, package install, terminal/MCP/API/cron,
  provider secrets, raw secret/client/VDR exposure, cross-domain forwarding,
  direct Zendd mutation, protected action execution, receipt application, Agent
  final PASS/approval, legal final judgment, and release/deploy decision as
  BLOCK unless a future human-approved receipt chain is validated.
- P1200 may return `ready_for_human_approved_agent_runtime_pilot`, but it must
  not start Hermes Agent, invoke tools, execute commands, start services,
  configure secrets, expose raw materials, mutate Zendd, apply receipts, execute
  protected actions, or create final legal/release authority.
