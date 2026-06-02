# Hermes Agent Operations Phase Ledger (P1041-P1121)

P1041 starts after the P1001-P1040 Zendd actual checkout preflight. Hermes
Agents are introduced as a platform-wide Agent Operations Layer, not as a
domain pack and not as a final adjudicator. The layer may create work orders,
research packets, evidence candidates, command candidates, patch plans, review
drafts, recovery drafts, and next allowed actions. It must not create final
PASS, approval, release execution, protected output finalization, legal final
judgment, raw secret context, or raw client/VDR payloads.

Zendd remains an external project. Domain packs expand through the Domain Agent
Capability Registry and L0-L5 rollout levels instead of getting hard-coded
Agent behavior.

## P1041-P1044 Agent Authority Freeze

`platform:agent-authority-freeze -- --check` creates the first read-only Agent
Operations Layer authority inventory. It consumes official Hermes Agent
feature documentation and this phase ledger, then freezes how those features
can be used by the Hermes harness.

Acceptance for P1041-P1044:

- P1041 records official Hermes Agent source references for repository,
  installation, security, tools/backends, API server, delegation, and rollback
  documentation.
- P1042 inventories the general Hermes Agent feature set: installation,
  CLI/TUI, toolsets, terminal backends, profiles, skills, memory, context
  files, MCP, delegation/subagents, cron/gateway, API server,
  checkpoints/rollback, browser/web, and supply-chain advisory checks.
- P1043 freezes authority rules: Agent output is candidate/draft/evidence
  only, while final PASS, approval, release/deploy, legal final judgment,
  protected output without receipt, raw secrets, raw client/VDR material,
  YOLO/approval-off, secret forwarding, and direct Zendd mutation are
  documented BLOCK.
- P1044 seeds expandable domain scopes for platform, personal-dev, law-firm,
  creative-document, connectors/resource, trading, and project.zendd with
  L0-L5 rollout ceilings and `harness_only` verdict authority.
- P1044 performs no Hermes Agent installation, no runtime start, no terminal
  command execution, no MCP connection, no cron/gateway start, no API server
  start, no browser session, no secret read, no raw client/VDR exposure, and
  no Zendd mutation.
- P1044 closes as `ready_for_agent_authority_freeze`.

## P1045-P1056 Supply Chain And Install Trust Gate

`platform:agent-install-trust-gate -- --check` verifies official source,
release observation, install mode, rollback plan, and sandbox scope before any
installation. It consumes P1041-P1044 and keeps install/download/runtime
execution disabled.

Acceptance for P1045-P1056:

- P1045 consumes `platform:agent-authority-freeze -- --check` and requires
  `ready_for_agent_authority_freeze`.
- P1046 records official package provenance for `hermes-agent`, including PyPI
  project URL, GitHub repository URL, official installation docs, observed
  version, Python requirement, license, Trusted Publishing, publisher workflow,
  source commit, sdist SHA256, and wheel SHA256.
- P1047 classifies install modes into PASS candidates for `pipx`,
  repo-local venv, and Docker container, while keeping package download and
  install execution disabled.
- P1048 documents unsafe install modes as BLOCK: one-line git-main
  `curl | bash`, global pip install, and root/sudo install.
- P1049 records rollback command candidates for every install mode without
  executing rollback.
- P1050-P1052 records future doctor/smoke commands such as version, doctor,
  config check, help, and tool-policy probes as documented BLOCK until P1057
  install evidence exists.
- P1053 keeps provider secret configuration, env forwarding, YOLO mode,
  approval-off mode, MCP connection, API server start, cron/gateway start, and
  raw client/VDR context disabled.
- P1054 binds every PASS candidate and BLOCK row to claim, evidence, reviewer,
  hard gate, owner, and next allowed action.
- P1055 proves the phase performed no package download, no package install, no
  runtime start, no terminal execution, no secret read, no raw material copy,
  and no protected action.
- P1056 closes as `ready_for_agent_install_trust_gate`.

## P1057-P1064 Isolated Install And Doctor Gate

`platform:agent-isolated-install-gate -- --check` turns the P1045-P1056 install
trust candidates into a protected install packet. It selects repo-local venv as
the default candidate for Hermes harness work, but keeps actual package
download, install execution, doctor smoke execution, provider secrets, MCP,
API server, cron/gateway, and rollback execution disabled until a human receipt
authorizes a specific mode.

Acceptance for P1057-P1064:

- P1057 consumes `platform:agent-install-trust-gate -- --check` and requires
  `ready_for_agent_install_trust_gate`.
- P1058 records PASS selection candidates for pipx, repo-local venv, and
  Docker while preserving BLOCK rows for one-line git-main installers, global
  pip install, and root/sudo install.
- P1059 selects `repo_local_venv` as the default recommendation because it
  keeps the Agent runtime scoped to the Hermes checkout and avoids global
  Python mutation.
- P1060 creates human receipt templates for each PASS install candidate. The
  templates are PASS as templates only; no receipt payload is present and no
  receipt is applied.
- P1061 converts protected install execution for every PASS candidate into
  documented BLOCK with `missing_human_receipt`, owner, reviewer/gate, rollback
  target, and next allowed action.
- P1062 converts version, doctor, config-check, help, and tool-policy smoke
  commands into repo-local venv command candidates, but keeps them BLOCK with
  `install_not_yet_performed`.
- P1063 binds rollback candidates to every PASS install mode without executing
  rollback or deleting files.
- P1064 proves no package download, no install, no terminal command execution,
  no runtime start, no provider secret setup, no MCP/API/cron startup, no raw
  client/VDR context, no protected action, and no final Agent-created PASS.
- P1064 closes as `ready_for_agent_isolated_install_gate`.

## P1065-P1088 Domain Agent Capability Registry

`platform:agent-capability-registry -- --check` adds the Domain Agent
Capability Registry and adapter SDK contract. It makes Agent use expandable
across domains without hard-coding behavior into a domain pack and without
granting runtime or final verdict authority.

Acceptance for P1065-P1088:

- P1065 consumes `platform:agent-isolated-install-gate -- --check` and requires
  `ready_for_agent_isolated_install_gate`.
- P1066 defines the L0-L5 rollout model: observe-only, draft candidates,
  command candidates, human-gated execution packet, operator-supervised
  runtime, and production protected delegation.
- P1067 registers platform, personal-dev, law-firm, creative-document,
  connectors/resource, trading, and project.zendd domains with domain boundary,
  owner, current rollout level, max rollout level, forbidden data classes, and
  `harness_only` verdict authority.
- P1068-P1076 registers candidate-only capabilities per domain. Each capability
  declares domain id, capability id, rollout level, Agent feature refs, allowed
  inputs, forbidden inputs, allowed outputs, forbidden outputs, tool policy,
  evidence contract, human gate policy, adapter SDK ref, and next allowed
  action.
- P1077-P1080 creates adapter SDK rows requiring input normalization, forbidden
  input enforcement, prompt packet drafting, output sanitization, claim/evidence
  binding, reviewer/gate binding, human receipt binding, rollback binding, and
  operator surface binding.
- P1081-P1084 creates domain tool policies that keep terminal execution, package
  install, MCP connection, API server start, cron/gateway start, secret reads,
  raw material reads, domain mutation, YOLO mode, approval-off mode, and secret
  forwarding disabled.
- P1085 blocks unsafe Agent capability classes: direct PASS, direct approval,
  legal final judgment, release/deploy, live order submission, secret
  forwarding, raw client/VDR read, direct Zendd mutation, YOLO/approval-off, and
  unreviewed MCP connection.
- P1086-P1087 binds registry, capability, adapter SDK, tool policy, and unsafe
  block rows to claim/evidence/reviewer/gate/owner/next-action rows.
- P1088 proves the registry is declarative only: no Hermes Agent runtime, no
  terminal command, no MCP/API/cron start, no secret configuration, no raw
  client/VDR exposure, no protected action, no direct Zendd mutation, and no
  Agent-created final PASS.
- P1088 closes as `ready_for_agent_capability_registry`.

## P1089-P1112 Multi-Domain And Zendd Rollout

`platform:agent-domain-rollout -- --check` expands the registered capability
rows into operator-visible domain rollout packets. The rollout is still
candidate-only: no runtime, terminal command, MCP connection, API server,
cron/gateway, secret configuration, raw material read, protected output, or
domain mutation is performed.

Acceptance for P1089-P1112:

- P1089 consumes `platform:agent-capability-registry -- --check` and requires
  `ready_for_agent_capability_registry`.
- P1090-P1094 creates rollout rows for platform, personal-dev, law-firm,
  creative-document, connectors/resource, trading, and project.zendd, carrying
  rollout level, owner, route prefix, focus capabilities, and human-review
  policy.
- P1095-P1100 creates capability rollout packets for every registered domain
  Agent capability. Each packet is `draft_or_candidate_only` and binds claim,
  evidence, reviewer/gate, and receipt requirements where needed.
- P1101-P1105 creates a Zendd bridge for work order candidate, patch plan
  candidate, command evidence candidate, VDR/LDD bridge candidate, and release
  sandbox candidate while keeping `external_project_adapter` selected.
- P1106-P1108 projects read-only operator surface routes for claims,
  capabilities, missing inputs, next actions, and gates without starting a
  server or adding mutation routes.
- P1109 creates human gate rows for every domain. Receipt templates are
  declared, but no receipt payload is present and no receipt is applied.
- P1110 blocks protected rollout actions: platform final PASS, personal-dev
  release execution, legal final advice, creative client delivery,
  connectors/resource raw material export, trading live order submission, Zendd
  external checkout write, and Zendd raw VDR read.
- P1111-P1112 binds every rollout row to claim/evidence/reviewer/gate/owner and
  next allowed action, proving no runtime execution, terminal execution, raw
  exposure, source tree movement, direct Zendd mutation, protected action, or
  Agent-created final PASS.
- P1112 closes as `ready_for_agent_domain_rollout`.

## P1113-P1121 Agent Adoption Freeze

`platform:agent-adoption-freeze -- --check` closes the Agent Operations Layer
adoption program with a top-level freeze. It consumes the authority freeze,
install trust gate, isolated install gate, capability registry, and
multi-domain rollout, then re-adjudicates every Agent claim as PASS with
evidence/reviewer/gate or documented BLOCK with block reason, owner, human gate
when protected, and next allowed action.

Acceptance for P1113-P1121:

- P1113 consumes `platform:agent-domain-rollout -- --check` and requires
  `ready_for_agent_domain_rollout`.
- P1114 records the five source Agent phase summaries and freezes their claim
  totals at 211 source claims: 164 PASS and 47 documented BLOCK.
- P1115 audits every source claim row. PASS requires evidence, reviewer, hard
  gate, and `harness_only` verdict authority. BLOCK requires block reason,
  responsible owner, next allowed action, and `harness_only` verdict authority.
- P1116 verifies the unsafe invariants stay false: install execution, runtime
  execution, terminal execution, MCP connection, API server start,
  cron/gateway start, provider secret configuration, raw secret context, raw
  client/VDR context, direct Zendd mutation, source tree movement,
  Agent-created final PASS, protected output finalization, live order
  submission, YOLO/approval-off, and secret forwarding.
- P1117 documents protected Agent actions as BLOCK: install execution without
  receipt, doctor smoke before install, runtime/terminal execution,
  unreviewed MCP, API/cron start, raw secret context, raw client/VDR context,
  direct Zendd mutation, legal final judgment, live order submission,
  protected output finalization, Agent final PASS, YOLO/approval-off, and
  secret forwarding.
- P1118 projects read-only operator surface routes for sources, claim audit,
  invariants, protected blocks, and next actions without starting a server,
  adding mutation routes, or exposing raw material.
- P1119 binds all adoption freeze rows to claim/evidence/reviewer/gate/owner
  and next allowed action.
- P1120 proves no Hermes Agent package download, install, runtime start,
  terminal command execution, MCP connection, API server start, cron/gateway
  start, provider secret setup, raw secret/client/VDR exposure, direct Zendd
  mutation, protected action, or Agent-created final PASS occurred.
- P1121 closes as `ready_for_agent_adoption_freeze`.
