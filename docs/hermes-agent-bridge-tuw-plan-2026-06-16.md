# Hermes Agent Bridge TUW Plan - 2026-06-16

Status: reviewed and revised implementation plan.

This plan covers the future state where Hermes Desktop can coordinate Codex and Claude agent work. It does not grant current execution authority. The first deliverable is an artifact-backed Agent Bridge that records agent identity, model, plugins, skills, permissions, commands, evidence, and receipts. Direct execution from Hermes Desktop is introduced only after contracts, sandboxing, receipts, and owner gates are closed.

This is not production launch approval, production PASS, enterprise PASS, protected closeout, GitHub independent approval, deployment authorization, connector write approval, or final approval for any Codex or Claude action.

Agbrowse ChatGPT Pro review returned `APPROVE_WITH_FINDINGS` and recommended splitting the original non-execution epic into smaller reviewed tranches. The first implementation slice is now Slice A only: L0-L4 contracts, schemas, authority lattice, provenance model, capability inventory, permission matrix, protected-action classifier, and negative fixtures. Desktop Agents UI, request queue, receipt intake, Agbrowse prompt submission, Claude/Codex auto-invocation, and execution candidates are later slices.

## 0. Product Intent

Hermes Agent Bridge is the control-plane layer that lets Hermes Desktop answer:

- Which agent is being used: Codex, Claude Code, ChatGPT web via Agbrowse, local script, or future adapter.
- Which model or model class is active: for example Codex, Claude Opus, ChatGPT Pro.
- Which plugins, connectors, MCP tools, and skills are available.
- Which permissions are open, closed, requested, or blocked.
- Which commands were run and what they produced.
- Which evidence and receipts bind a result to a project, task, review, or gate.
- Whether a request is display-only, request-only, human-approved limited execution, or blocked.

The bridge must preserve the current Hermes rule: Desktop is an operator surface, not a privileged source of truth.

## 1. Execution Pyramid

| Layer | Goal | Execution Authority | Primary Gate |
|---|---|---:|---|
| L0 Boundary | Non-negotiable safety and authority rules | none | forbidden authority stays false |
| L1 Agent Bridge Contract | Stable data contracts and schemas | none | schema and negative fixtures |
| L2 Runtime Identity | Agent, model, workspace, account, and session identity | none | identity provenance rows |
| L3 Capability Inventory | Plugins, skills, MCP tools, connectors, commands | none | capability provenance rows |
| L4 Permission Matrix | What is installed vs allowed vs requested | none | permission policy matrix |
| L5 Request Queue | Desktop creates agent task requests | request-only | request packet validation |
| L6 Receipt Intake | Import command, review, evidence, and transcript summaries | none | receipt validation |
| L7 Desktop Projection | Agents tab, request queue, receipts, permissions UI | none | smoke and renderer tests |
| L8 Controlled Execution Candidate | Human-approved limited execution adapter | disabled by default | owner receipt plus sandbox preflight |
| L9 Runtime Execution | Execute strictly allowlisted agent commands | limited only | explicit owner approval per lane |
| L10 Release Hardening | End-to-end, security, rollback, runbook | limited or none | closeout packet and independent review |

## 2. Target Architecture

```text
Hermes Desktop
  -> read-only desktop read model
  -> Agent Bridge projection
  -> request packet writer, disabled until L5 gate
  -> receipt importer, read-only by default

Hermes Agent Bridge Core
  -> agent identity registry
  -> capability inventory registry
  -> permission matrix
  -> task request ledger
  -> session ledger
  -> command receipt ledger
  -> evidence binding ledger
  -> validation and negative fixtures

External Agent Runtimes
  -> Codex Desktop / Codex CLI
  -> Claude Code
  -> ChatGPT web via Agbrowse
  -> local scripts
  -> future MCP or API adapters
```

The bridge separates five states:

| State | Meaning | Desktop Behavior |
|---|---|---|
| Installed | Hermes has low-trust evidence that a plugin, skill, connector, tool, adapter, or command exists somewhere. | display only, no authority effect |
| Observed | Hermes has evidence that an agent, plugin, skill, command, or session exists. | display only |
| Requestable | Hermes can prepare a request packet for a human/operator to run elsewhere. | create/copy packet only |
| Executable | Hermes can launch a strictly allowlisted action after human approval. | disabled until L8/L9 |
| Blocked | The capability, request, receipt, source, or runtime is unsafe, stale, malformed, unavailable, untrusted, or missing required provenance. | visible blocker |

The state lattice is one-way and conservative: `installed` never implies `observed`, `requestable`, `allowed`, `approved`, or `executable`; `observed` never implies `requestable` or `executable`; `reviewed` never implies `approved`; and `receipt_imported` never implies `receipt_applied`.

## 3. Stable Data Contracts

| Contract | Purpose | First Schema |
|---|---|---|
| `agent-bridge-manifest.v1` | Top-level bridge artifact and summary | `schemas/agent-bridge-manifest.schema.json` |
| `agent-runtime-identity.v1` | Codex/Claude/ChatGPT/local agent identity rows | embedded in manifest |
| `agent-capability-inventory.v1` | Plugins, skills, connectors, MCP tools, scripts | embedded in manifest |
| `agent-permission-matrix.v1` | installed/observed/requestable/executable/blocked authority | embedded in manifest |
| `agent-task-request.v1` | Desktop-generated work request packet | separate artifact |
| `agent-session-ledger.v1` | Session id, workspace, model, status, source ref | embedded in manifest |
| `agent-command-receipt.v1` | Command run, args, cwd, exit, hash, redaction status | separate artifact |
| `agent-evidence-binding.v1` | Links command/review/session to project/gate/receipt | embedded in manifest |
| `agent-review-receipt.v1` | Claude/ChatGPT/Codex review output normalized | separate artifact |
| `agent-execution-policy.v1` | Future L8/L9 allowlist and sandbox policy | separate artifact |

## 4. Authority Rules

These stay false through L0-L7:

- `desktop_mutation_allowed`
- `agent_runtime_execution_allowed_now`
- `command_execution_allowed_now`
- `shell_execution_allowed_now`
- `git_write_allowed_now`
- `deploy_allowed_now`
- `approval_application_allowed_now`
- `receipt_application_allowed_now`
- `connector_write_allowed_now`
- `secret_read_allowed_now`
- `raw_source_exposure_allowed`
- `production_pass_enabled`
- `enterprise_pass_enabled`
- `protected_closeout_enabled`
- `agent_final_pass_allowed_now`

Authority namespaces are separate:

| Namespace | Meaning | L0-L7 State |
|---|---|---|
| `desktop_authority` | What Hermes Desktop can do by itself | read/display only |
| `developer_preflight` | Commands a local developer runs in the repository to validate artifacts | allowed outside Desktop, evidence only |
| `manifest_generator_discovery` | Deterministic scripts that inspect local files or status sources | read-only discovery only |
| `agent_runtime_authority` | Codex/Claude/ChatGPT/local agent actions launched by Hermes | false through L7 |
| `external_provider_authority` | Claims from web UI, model output, plugin metadata, or runtime self-report | untrusted evidence only |
| `protected_action_authority` | commit, push, merge, deploy, approve, apply, receipt apply, production, enterprise, protected closeout | false |

L8/L9 may introduce limited execution only after a separate owner-approved execution policy exists. Even then, protected actions remain blocked unless a specific protected-action receipt exists.

All provider output is untrusted. Webpage text, model output, review output, raw transcript, plugin descriptions, MCP manifests, runtime self-report, and Agbrowse browser observations are evidence inputs only. They cannot open authority, prove entitlement, prove model identity, apply receipts, or approve work.

## 5. TUW Registry

### L0 Boundary Freeze

| TUW | Testable Unit | Required Evidence | Gate |
|---:|---|---|---|
| 001 | Record Agent Bridge mission and non-goals | plan doc and ADR | docs check |
| 002 | Define forbidden authority list for bridge | constants and schema enum | negative fixture |
| 003 | Define installed/requestable/executable distinction | permission matrix contract | schema validation |
| 004 | Define source-of-truth rule: artifacts over Desktop | bridge policy row | validation item |
| 004A | Define authority namespace contract | desktop/developer/generator/agent/provider/protected namespaces | schema validation |
| 005 | Define raw transcript and secret redaction boundary | redaction policy rows | redaction fixture |
| 006 | Define no-final-approval-by-agent rule | authority guard rows | forbidden-copy test |
| 007 | Define runtime self-report trust class | provenance policy | self-report negative fixture |
| 007A | Define untrusted provider output rule | provider output cannot open authority | negative fixture |
| 008 | Close L0 with boundary closeout packet | closeout markdown | `git diff --check` |

### L1 Agent Bridge Contract

| TUW | Testable Unit | Required Evidence | Gate |
|---:|---|---|---|
| 009 | Add `agent-bridge-manifest` schema | JSON Schema | schema unit test |
| 010 | Add runtime identity row schema | Codex/Claude/ChatGPT/local rows | schema unit test |
| 011 | Add capability inventory row schema | plugin/skill/tool/connector rows | schema unit test |
| 012 | Add permission matrix row schema | observed/requestable/executable fields | schema unit test |
| 013 | Add session ledger row schema | session id/model/workspace/status | schema unit test |
| 014 | Add command receipt summary row schema | command, cwd, exit, hash, redaction | schema unit test |
| 015 | Add evidence binding row schema | project/task/gate linkage | schema unit test |
| 016 | Add bridge summary and validation rows | validation item list | schema unit test |
| 017 | Add negative fixture: runtime claims execution allowed | validation must fail | node test |
| 018 | Add negative fixture: plugin installed implies allowed | validation must fail | node test |
| 018A | Add capability state lattice contract | installed/observed/requestable/executable/blocked transitions | schema and negative fixture |
| 018B | Add provenance-source contract | source type, collector, method, trust class, timestamp, hash | schema test |
| 018C | Add authority-decision-record contract | display/request/import/execution authority effect | schema test |
| 018D | Add redaction-policy contract | secret/raw/private path policy | schema test |
| 018E | Add malicious manifest fixture suite | fake approval/execution/owner/enterprise/production claims blocked | node test |

### L2 Runtime Identity Registry

| TUW | Testable Unit | Required Evidence | Gate |
|---:|---|---|---|
| 019 | Implement deterministic bridge generator | `src/agent-bridge-manifest.mjs` | generator test |
| 020 | Register npm script | `platform:agent-bridge-manifest` | package script test |
| 021 | Emit Codex runtime identity row | local Codex lane observed | check mode |
| 022 | Emit Claude runtime identity row | Claude Code lane observed/blocker | check mode |
| 023 | Emit ChatGPT/Agbrowse runtime identity row | `agbrowse status` summary or blocker | check mode |
| 024 | Emit local script runtime identity row | local deterministic scripts | check mode |
| 025 | Record model label separately from model proof | model label is observed, not trusted proof | negative fixture |
| 026 | Record workspace/root per runtime | cwd/root hash | check mode |
| 027 | Record account/vendor trust class | web account/self-report/CLI | check mode |
| 028 | Close L2 with identity summary artifact | summary markdown | check mode |

### L3 Capability Inventory

| TUW | Testable Unit | Required Evidence | Gate |
|---:|---|---|---|
| 029 | Inventory Codex visible skills/plugins | static local discovery or blocker | deterministic inventory test |
| 030 | Inventory Claude Code capability source | config/receipt/manual source row | deterministic inventory test |
| 031 | Inventory Agbrowse ChatGPT capability source | `agbrowse web-ai status` source row | deterministic inventory test |
| 032 | Inventory local Hermes scripts as command capabilities | npm script rows | deterministic inventory test |
| 033 | Distinguish MCP tool from plugin from skill | capability kind enum | schema test |
| 034 | Record capability source path or source command | provenance fields | schema test |
| 035 | Record capability freshness and hash | freshness rows | unit test |
| 036 | Block missing capability source visibly | blocker row | negative fixture |
| 037 | Block capability rows with secret-like paths | denylist fixture | unit test |
| 037A | Add Agbrowse passive collection boundary | status-only, no prompt submission in Slice A | check mode |
| 037B | Add adapter package provenance | version, package source, lockfile, hash, license | unit test |
| 038 | Close L3 with capability inventory summary | summary markdown | check mode |

### L4 Permission Matrix

| TUW | Testable Unit | Required Evidence | Gate |
|---:|---|---|---|
| 039 | Add default permission policy: observed only | policy rows | check mode |
| 040 | Add requestable action class | copy prompt/create packet only | schema test |
| 041 | Add executable action class, default false | execution flags false | negative fixture |
| 042 | Map plugins/skills to permission rows | capability id -> permission row | unit test |
| 043 | Map commands to permission rows | npm/script/CLI command rows | unit test |
| 044 | Add protected action classifier | commit/push/deploy/approve/apply | negative fixture |
| 044A | Add command canonicalization and denylist bypass fixtures | npm indirection, shell chains, aliases, symlinks, env expansion | unit test |
| 045 | Add secrets/raw transcript classifier | secret/raw/private path policy | negative fixture |
| 046 | Add model capability trust classifier | model label not proof | unit test |
| 047 | Add owner-gated override placeholder | no active override yet | negative fixture |
| 047A | Add no-override-without-policy fixture | placeholder cannot create override semantics | negative fixture |
| 048 | Close L4 with permission matrix artifact | summary markdown | check mode |

### L5 Agent Task Request Queue

| TUW | Testable Unit | Required Evidence | Gate |
|---:|---|---|---|
| 049 | Add `agent-task-request` schema | JSON Schema | schema test |
| 050 | Generate request packet without executing | `artifacts/agent-task-requests/latest` | generator test |
| 051 | Add request type: plan review | ChatGPT/Claude review packet | unit test |
| 052 | Add request type: code review | read-only diff/repo packet | unit test |
| 053 | Add request type: implementation proposal | no mutation | unit test |
| 054 | Add request type: command suggestion | command text only | unit test |
| 054A | Add request packet data-minimization gate | no secrets, raw transcripts, private paths, write-capable commands | negative fixture |
| 055 | Add request risk scoring | low/medium/high/protected | unit test |
| 056 | Add request lifecycle | draft/requested/observed/imported/blocked | state test |
| 057 | Add duplicate/idempotency guard | stable request id | unit test |
| 058 | Close L5 with request queue summary | summary markdown | check mode |

### L6 Receipt Intake and Evidence Binding

| TUW | Testable Unit | Required Evidence | Gate |
|---:|---|---|---|
| 059 | Add command receipt intake schema | command receipt file | schema test |
| 060 | Add review receipt intake schema | external review output | schema test |
| 061 | Add Agbrowse review receipt normalizer | raw response -> normalized receipt | fixture test |
| 062 | Add Claude review receipt normalizer | raw Claude output -> normalized receipt | fixture test |
| 063 | Add Codex work receipt normalizer | local command/test summary | fixture test |
| 064 | Add evidence binding ledger | request/session/receipt/project links | unit test |
| 065 | Enforce raw output redaction | no secret/raw transcript leak | negative fixture |
| 066 | Enforce invalid receipt remains blocked | malformed review output | negative fixture |
| 067 | Enforce receipt cannot open authority | approval/deploy claim stays false | negative fixture |
| 067A | Add malicious receipt fixture suite | fake approvals, malicious markdown/HTML/JSON, stale replay | node test |
| 068 | Close L6 with receipt intake summary | summary markdown | check mode |

### L7 Desktop Projection and UI

| TUW | Testable Unit | Required Evidence | Gate |
|---:|---|---|---|
| 069 | Add Agent Bridge source to desktop read-model allowlist | 23rd source or updated source count | read-model check |
| 070 | Add Agents section to desktop read model | section row | read-model check |
| 071 | Add agent projection summary cards | runtimes/capabilities/requests/receipts | renderer test |
| 071A | Add UI authority copy guard | no final approval, owner approval, production, enterprise, execution readiness implication | renderer test |
| 072 | Add Agents nav item | sidebar nav | renderer contract test |
| 073 | Add runtime table | agent/model/status/workspace | smoke screenshot |
| 074 | Add capability table | plugin/skill/tool/connector/permission | smoke screenshot |
| 075 | Add permission inspector | observed/requestable/executable/blocked | smoke screenshot |
| 076 | Add request queue panel | request-only lifecycle | smoke screenshot |
| 077 | Add receipt/evidence panel | normalized receipt rows | smoke screenshot |
| 078 | Add selected agent inspector | model, source, trust class, blockers | smoke screenshot |
| 079 | Add forbidden copy guard for agent claims | no final approval/production pass text | renderer test |
| 079A | Add no latent execution UI fixture | no execute/approve/apply/deploy/push/commit/merge controls | renderer test |
| 080 | Close L7 with desktop projection summary | smoke and check mode | local preflight |

### L8 Controlled Execution Candidate

| TUW | Testable Unit | Required Evidence | Gate |
|---:|---|---|---|
| 081 | Draft `agent-execution-policy` schema | disabled-by-default policy | schema test |
| 082 | Define execution allowlist format | command id, args, cwd, timeout | schema test |
| 083 | Define sandbox/worktree requirement | isolated cwd and denylist | negative fixture |
| 084 | Define owner receipt requirement | explicit owner action receipt | negative fixture |
| 085 | Define dry-run execution candidate | no command launched yet | unit test |
| 086 | Define rollback binding requirement | rollback plan or blocker | unit test |
| 087 | Define redaction before display | output summary only | negative fixture |
| 088 | Add Desktop button state: disabled pending policy | no clickable execution | renderer test |
| 089 | Add Agbrowse execution candidate contract | web-ai request candidate only | check mode |
| 090 | Close L8 with execution-candidate readiness packet | closeout packet | independent review |

### L9 Limited Runtime Execution

| TUW | Testable Unit | Required Evidence | Gate |
|---:|---|---|---|
| 091 | Implement one dry-run-only executor adapter | prints intended command only | unit test |
| 092 | Implement manual-owner approved command execution | local harmless command only | owner receipt |
| 093 | Implement Agbrowse review request adapter | sends review prompt only | receipt validation |
| 094 | Implement Claude review request adapter | read-only review only | receipt validation |
| 095 | Implement Codex task request adapter | request packet only unless separately approved | receipt validation |
| 096 | Block git write commands | commit/push/merge negative fixture | unit test |
| 097 | Block deploy/release commands | deploy/tag/release negative fixture | unit test |
| 098 | Block approval/apply commands | approve/apply/receipt apply negative fixture | unit test |
| 099 | Block secret/raw transcript reads | denylist negative fixture | unit test |
| 100 | Close L9 with limited execution review packet | independent review | owner adjudication |

### L10 Release Hardening

| TUW | Testable Unit | Required Evidence | Gate |
|---:|---|---|---|
| 101 | Add full local preflight coverage | bridge, desktop, tests, smokes | `desktop:local-preflight` |
| 102 | Add visual smoke for Agents screen | desktop and narrow | smoke screenshots |
| 103 | Add fixture suite for malicious agent manifests | all blocked | node test |
| 104 | Add runbook for safe operation | operator docs | docs check |
| 105 | Add troubleshooting for Agbrowse/Claude/Codex | blocker guidance | docs check |
| 106 | Add review packet for independent reviewer | review prompt and evidence list | external review |
| 107 | Add owner decision packet | owner choices and non-goals | owner review |
| 108 | Add closeout packet | local-only status and remaining blockers | closeout docs |
| 109 | Commit planning and implementation separately | git history | git log |
| 110 | Final release decision remains separate | no production/enterprise claim | release gate |

## 6. Recommended Implementation Order

1. Slice A first: L0-L4 contracts, schemas, provenance, authority lattice, capability inventory, permission matrix, protected-action classifier, command canonicalization, and negative fixtures.
2. Close Slice A with review evidence before request queue, receipt intake, Desktop Agents UI, or any execution candidate work.
3. Slice B next: L5-L6 request packets and receipt intake, still with no execution, no receipt application, and no UI execution affordance.
4. Close Slice B with review evidence before Desktop Agents UI.
5. Slice C next: L7 Desktop Agents projection, display/copy/import only.
6. L8 only after review: add execution-candidate policy schema and disabled states, without executor code.
7. L9 only after owner approval: introduce limited execution for review requests, not protected actions.
8. L10 after every tranche: run preflight, smoke, independent review, and closeout.

## 7. Initial Implementation Slice

The first implementation slice is **Slice A only**. It stops at TUW-048 plus inserted safety TUWs `004A`, `007A`, `018A-018E`, `037A-037B`, `044A`, and `047A`.

It should deliver:

- `agent-bridge-manifest` schema, generator, check mode, artifacts, and summary.
- deterministic runtime identity rows for Codex, Claude, ChatGPT/Agbrowse, and local scripts.
- capability inventory rows for plugins, skills, MCP tools, connectors, and local commands.
- permission matrix rows proving installed/observed/requestable/executable/blocked are distinct.
- provenance-source, authority-decision-record, and redaction-policy rows.
- protected-action classifier and command canonicalization fixtures.
- full negative fixtures showing no command/write/deploy/approve/apply/production/enterprise authority opens.

Request queue, receipt intake, Desktop Agents UI, Agbrowse prompt submission, Claude/Codex auto-invocation, and all execution adapters are explicitly out of scope for Slice A.

## 8. Verification Envelope

Minimum commands for the first slice:

```bash
npm run platform:agent-bridge-manifest -- --check
node --test test/agent-bridge-manifest.test.mjs
npm run validate:core
git diff --check
```

For Slice B, add request/receipt intake tests. For Slice C, add desktop read-model, renderer, build, and Agents smoke tests. For L8/L9, add security and sandbox-specific tests before any executor is enabled.

## 9. Review Questions for Independent Reviewer

1. Does the plan preserve Hermes Desktop as an operator surface rather than a source of truth?
2. Are installed, observed, requestable, and executable capabilities separated enough?
3. Are Codex/Claude/ChatGPT plugin and skill inventories modeled without overtrusting runtime self-report?
4. Is the TUW order correct, or should any safety contract move earlier?
5. Are L8/L9 execution gates strict enough to prevent protected actions from slipping in?
6. What negative fixtures are missing?
7. What should be explicitly excluded from the first implementation slice?
