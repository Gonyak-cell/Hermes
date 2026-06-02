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

Future command: `platform:agent-install-packet -- --check`.

The install packet will prepare repo-local venv, pipx, and Docker candidate
packets with rollback targets. Package download and install execution remain
BLOCK until a validated human receipt exists.

## P1151-P1160 Doctor/Smoke Evidence Bridge

Future command: `platform:agent-doctor-evidence-bridge -- --check`.

The doctor bridge will model version, doctor, config-check, help, and tool
policy probe outputs as evidence packets. Commands remain candidates only and
are not executed in this tranche.

## P1161-P1170 Tool Policy And Sandbox Matrix

Future command: `platform:agent-tool-policy-matrix -- --check`.

The tool policy matrix will map terminal, MCP, browser, file write, package
install, secret, raw material, and domain mutation policies by domain and
rollout level. Unsafe classes remain documented BLOCK.

## P1171-P1180 Domain Adapter SDK v1

Future command: `platform:agent-domain-adapter-sdk -- --check`.

The adapter SDK will standardize input normalization, prompt packet drafting,
output sanitization, claim/evidence binding, reviewer/gate binding, human
receipt binding, rollback binding, and operator-surface binding across all
domain packs.

## P1181-P1188 Zendd Agent Candidate Bridge

Future command: `platform:agent-zendd-candidate-bridge -- --check`.

The Zendd bridge will produce work-order, patch-plan, command-evidence, VDR/LDD,
and release-sandbox candidate packets while keeping Zendd as an external
adapter. Direct Zendd writes, source tree movement, command execution, raw
client/VDR exposure, and protected output finalization remain BLOCK.

## P1189-P1194 Delegation/Subagent Contract

Future command: `platform:agent-delegation-contract -- --check`.

The delegation contract will separate planner, researcher, reviewer, verifier,
and recovery drafter roles. Subagents may draft candidates and evidence only;
they cannot create final PASS, approval, legal final judgment, release decisions,
or protected action execution.

## P1195-P1198 Dry-run Runtime Simulation

Future command: `platform:agent-dry-run-simulation -- --check`.

The simulation will create would-run evidence without running Hermes Agent. It
must prove runtime, terminal, MCP, API, cron, secret, raw material, Zendd write,
and protected action paths remain disabled.

## P1199-P1200 Agent Runtime Pilot Readiness Freeze

Future command: `platform:agent-runtime-pilot-freeze -- --check`.

The final freeze will re-adjudicate all P1122-P1198 claims. Every claim must be
PASS with evidence/reviewer/gate and required receipt refs, or documented BLOCK
with block reason, owner, human gate when protected, and next allowed action.
The expected closing status is `ready_for_human_approved_agent_runtime_pilot`;
runtime execution still remains BLOCK until a future human receipt is validated.
