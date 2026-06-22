# Hermes MCP-Native Control Plane Plan

Status: H-MCP-03 check-only tool adapter surface
Date: 2026-06-22

## Goal

Make Hermes an MCP-native governance/control-plane layer that exposes deterministic project, review, gate, receipt, artifact, and factory read models through read-only/check-only MCP resources and tools, while preserving Hermes repo/artifacts/schemas as the source of truth and keeping Desktop as a non-authoritative operator console.

## Product Boundary

Hermes MCP is an adapter over the existing deterministic harness. It is not a new source of truth, not an agent runtime, and not a privileged execution gateway.

The canonical source of truth remains:

- repository files under `src/`, `scripts/`, `schemas/`, `docs/`, `examples/`, and `packs/`
- generated artifacts under `artifacts/`
- package scripts that already expose deterministic validations and projections
- human and independent-review receipts where protected gates require them

Hermes Desktop remains a non-authoritative operator console. It may read MCP resources or MCP-equivalent read models, but it must not mutate source, apply receipts, approve protected closeout, create production PASS, or claim enterprise trust.

## H-MCP-00 Boundary

The first MCP tranche is read-only/check-only.

Allowed now:

- list deterministic Hermes MCP resource and tool candidates
- expose read-only project, review, gate, receipt, artifact, desktop, and factory read-model contracts
- run or describe check-only validation commands
- emit evidence about blocked authority classes

Blocked now:

- repository writes through MCP
- connector writes through MCP
- deployment or release execution through MCP
- protected action execution through MCP
- final approval, production PASS, or enterprise trust claims through MCP
- raw secret, raw restricted payload, raw VDR/client payload, or unredacted transcript exposure through MCP

## H-MCP-01 Capability Registry

The first implementation surface is `platform:hermes-mcp-capability-registry`.

It records:

- MCP resource candidates and their canonical Hermes source refs
- MCP check-only tool candidates and their existing package script bindings
- blocked authority classes that must remain false until a later human-approved gate opens them
- Desktop's non-authoritative operator-console status
- validation rows proving this tranche does not start an MCP server, perform mutation, call connectors, deploy, or approve protected work

## Sequencing

1. H-MCP-00: land this boundary plan.
2. H-MCP-01: add the validated MCP capability registry.
3. H-MCP-02: add a read-only stdio MCP server skeleton.
4. H-MCP-03: route MCP tools through a deterministic script adapter.
5. H-MCP-04: enforce an MCP authority guard and negative fixtures.
6. H-MCP-05: make Desktop consume MCP or MCP-equivalent read models.
7. H-MCP-06: document Codex/Claude/Desktop client setup.
8. H-MCP-07: define, but do not implement, gated write tools.

## Verification

## H-MCP-02 Read-Only Stdio Server

The second implementation surface is `platform:hermes-mcp-readonly-server`.

It validates and writes a deterministic server contract for a stdio MCP server using protocol version `2025-06-18`. The live server entrypoint is `mcp:serve`, which maps the H-MCP-01 registry into MCP JSON-RPC methods:

- `initialize`
- `resources/list`
- `resources/read`
- `tools/list`
- `tools/call`

The H-MCP-02 server may expose resource read models and tool contracts. It must not execute package scripts, start subprocess checks, write files through MCP, apply receipts, deploy, approve protected work, claim production PASS, claim enterprise trust, or expose raw restricted payloads.

When launching through npm, MCP clients must use `npm --silent run mcp:serve` so stdout contains newline-delimited JSON-RPC only. Direct launch via `node scripts/hermes-mcp-readonly-server.mjs --stdio` is also valid.

H-MCP-02 is complete only when:

- `platform:hermes-mcp-readonly-server` is registered
- `mcp:serve` is registered
- MCP `initialize`, `resources/list`, `resources/read`, `tools/list`, and `tools/call` are covered by tests
- `tools/call` returns contract-only check invocation metadata with `executed: false`
- stdio smoke proves stdout emits newline-delimited JSON-RPC only
- source of truth remains repo/artifacts/schemas
- Desktop remains non-authoritative

## H-MCP-03 Check-Only Tool Adapter

The third implementation surface keeps the same stdio MCP server but upgrades `tools/call` from contract-only metadata to deterministic check-only execution.

Each allowlisted MCP tool maps to an existing package script and is invoked only as:

`npm --silent run <package_script> -- --check`

The adapter returns structured MCP output containing the command binding, exit code, bounded stdout/stderr, duration, check status, and authority flags. It continues to block non-check execution, repository writes, filesystem writes through MCP, connector writes, deployment, receipt application, protected approval, final approval, production PASS, enterprise trust, raw secrets, and raw restricted payloads.

H-MCP-03 is complete only when:

- every allowlisted MCP tool has a package-script check command ending in `--check`
- `tools/call` executes the check command and returns structured MCP output
- `tools/call` rejects `check_only=false` and `dry_run=false`
- `validate:core -- --check` is normalized as a read-only validation check
- stdio smoke proves `tools/call` starts only the check subprocess and returns JSON-RPC
- all authority flags for write, deploy, receipt application, protected approval, production PASS, enterprise trust, and raw restricted payloads remain false

## H-MCP-04 Authority Guard And Negative Fixtures

The fourth implementation surface is `platform:hermes-mcp-authority-guard`.

It executes deterministic negative fixtures against the MCP JSON-RPC handler and proves unsupported mutation, deployment, receipt application, protected approval, final approval, enterprise trust, raw secret, raw restricted payload, and non-check tool calls fail closed.

## H-MCP-05 Desktop Consumption Boundary

The fifth implementation surface is `platform:hermes-mcp-desktop-consumption-boundary`.

It binds Desktop panels to MCP resources or MCP-equivalent read models while keeping Desktop non-authoritative. Desktop may consume `hermes://status`, `hermes://projects`, `hermes://reviews`, `hermes://gates`, `hermes://receipts`, `hermes://artifacts/latest`, `hermes://factory/products`, and `hermes://desktop/read-model`; it must not become source of truth or apply protected actions.

## H-MCP-06 Client Setup And Smoke Runbooks

The sixth implementation surface is `platform:hermes-mcp-client-setup`.

It writes the client setup and smoke runbook for Codex, Claude Desktop, Hermes Desktop, and manual stdio checks. npm-backed MCP clients must use `npm --silent run mcp:serve`.

## H-MCP-07 Gated Write Tool Definitions

The seventh implementation surface is `platform:hermes-mcp-gated-write-tool-definitions`.

It defines future gated write tools only as closed contracts. They are not exposed in `tools/list`, not executable, and require future human receipt, independent review, and protected gate binding before any later tranche can open them.

## H-MCP-08 Closeout Readiness

The eighth implementation surface is `platform:hermes-mcp-closeout-readiness`.

It verifies H-MCP-00 through H-MCP-08 readiness as one closeout pack. H-MCP-08 is complete only when every prior tranche artifact is ready and all protected authority remains closed.

H-MCP-00/H-MCP-01 is complete only when:

- the boundary plan exists and states read-only/check-only scope
- `platform:hermes-mcp-capability-registry` is registered
- schema validation passes for the registry artifact
- blocked authority classes remain `false`
- check mode does not overwrite existing artifacts
