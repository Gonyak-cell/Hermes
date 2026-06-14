# Hermes Roadmap P62801-P63200

## P62801-P63200 Hermes Loop Runtime And Tool Governance

### Phase objective

P62800 model budget control artifact를 source로 받아 Phase F Runtime and Tool Governance를 구현한다. Runtime adapter binding, tool policy binding, command allowlist candidate, sandbox/timeout/log/artifact/cost contract, high-risk runtime verification guard를 row-level artifact로 고정한다.

### Source binding

- Primary source: `artifacts/hermes-loop-model-budget-control/latest/hermes-loop-model-budget-control.json`
- Rebuild fallback: P62800 model budget control을 source specification에서 in-memory로 재계산
- Source anchors: `6.6 Runtime and Tool Contract Layer`, `13 Execution 요구사항`, `17 API 요구사항`, `20 보안 및 컴플라이언스 요구사항`, `21.6 Phase F`

### Output rows

- `p62800_model_budget_source_rows`
- `runtime_adapter_contract_rows`
- `tool_policy_contract_rows`
- `command_allowlist_candidate_rows`
- `sandbox_timeout_log_artifact_rows`
- `runtime_verification_guard_rows`
- `authority_boundary_carryover_rows`
- `negative_fixture_contract_rows`
- `validation_command_rows`
- `hermes_loop_runtime_tool_wiring_rows`
- `p63200_closeout_rows`
- `p63201_next_phase_handoff_rows`

### Schema/script/doc/test change scope

- Schema: `schemas/hermes-loop-runtime-tool-governance.schema.json`
- Source module: `src/hermes-loop-runtime-tool-governance.mjs`
- CLI script: `scripts/hermes-loop-runtime-tool-governance.mjs`
- Test: `test/hermes-loop-runtime-tool-governance.test.mjs`
- Package script: `platform:hermes-loop-runtime-tool-governance`
- Architecture note: `docs/architecture.md`

### Negative fixtures

- missing P62800 model budget source
- P62800 validation invalid
- missing runtime adapter binding
- missing tool policy binding
- command allowlist treated as executable
- sandbox missing
- timeout heartbeat missing
- secret read allowed
- connector write allowed
- direct file write allowed
- high-risk runtime without verification
- authority carryover true
- missing P63201 handoff

### Validation commands

- `node --check src/hermes-loop-runtime-tool-governance.mjs`
- `node --check scripts/hermes-loop-runtime-tool-governance.mjs`
- `node --test test/hermes-loop-runtime-tool-governance.test.mjs`
- `npm run platform:hermes-loop-runtime-tool-governance -- --check`
- `node -e 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8")); JSON.parse(require("node:fs").readFileSync("schemas/hermes-loop-runtime-tool-governance.schema.json", "utf8"));'`
- `git diff --check`

### Authority boundary

Runtime and tool governance rows are contract metadata only. Actual runtime execution, command execution, tool invocation, direct file write, connector write, secret read, rollback execution, protected action, deployment, production PASS, enterprise PASS, Codex final approval, Claude final approval, and final automated approval remain false.

### Closeout criteria

- P62800 source is valid and ready.
- Runtime adapter contract rows pass.
- Tool policy contract rows pass.
- Command allowlist candidate rows pass without execution authority.
- Sandbox/timeout/log/artifact rows pass.
- Runtime verification guard rows pass.
- Authority carryover rows remain false.
- Negative fixtures are complete.
- P63201 handoff points to review and human gate integration.

### Next-phase handoff

`P63201-P63600` should implement Review and Human Gate Integration: review receipt references, human gate candidate rows, protected output boundary, finding loop linkage, and no-final-approval boundary.
