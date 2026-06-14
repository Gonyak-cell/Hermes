# Hermes Roadmap P60001-P60400

## P60001-P60400 Hermes Loop System v1.1 Source Binding And Boundary Baseline

### Phase objective

`docs/hermes-loop-system-specification.md`를 Hermes Loop System v1.1의 source of truth로 고정하고, Roadmap Phase A인 Loop Overlay Contract를 실제 Hermes control-plane 산출물로 시작한다. 이 tranche의 목표는 실행 권한을 여는 것이 아니라 source binding, contract inventory, authority false baseline, negative fixture, validation command, closeout, next-phase handoff를 deterministic artifact로 만드는 것이다.

### Source binding

- Source of truth: `docs/hermes-loop-system-specification.md`
- Required source anchors: system identity, deterministic control-plane loop definition, Evidence Before Claim, No Silent Authority Expansion, Worker/Verifier separation, DAG Before Autonomy, Loop Definition, Loop Run, Authority Mapping, Negative Fixtures, Acceptance Criteria, Roadmap Phase A
- Source evidence: source path, SHA-256 hash, current commit ref, document version `v1.1`
- Prior phase context: P60000 static UI adapter is previous committed checkpoint, but P60001 starts a new Hermes Loop System v1.1 control-plane program.

### Output rows

- `p60001_source_binding_rows`
- `loop_overlay_contract_inventory_rows`
- `authority_boundary_baseline_rows`
- `negative_fixture_contract_rows`
- `validation_command_rows`
- `hermes_loop_source_binding_wiring_rows`
- `p60400_closeout_rows`
- `p60401_next_phase_handoff_rows`

### Schema/script/doc/test change scope

- Schema: `schemas/hermes-loop-source-binding.schema.json`
- Source module: `src/hermes-loop-source-binding.mjs`
- CLI script: `scripts/hermes-loop-source-binding.mjs`
- Test: `test/hermes-loop-source-binding.test.mjs`
- Package script: `platform:hermes-loop-source-binding`
- Architecture note: `docs/architecture.md`
- Source doc: `docs/hermes-loop-system-specification.md`

### Negative fixtures

The validator must block or expose blockers for:

- missing source doc
- empty source doc
- missing required source section
- missing source hash
- authority flag set to true
- missing negative fixture row
- missing next-phase handoff
- production PASS true
- enterprise PASS true
- Codex final approval true
- Claude final approval true
- runtime execution true
- write action true
- connector write true
- protected action true
- deployment true
- raw material access true
- source mutation or direct file write authority true

### Validation commands

- `node --check src/hermes-loop-source-binding.mjs`
- `node --check scripts/hermes-loop-source-binding.mjs`
- `node --test test/hermes-loop-source-binding.test.mjs`
- `npm run platform:hermes-loop-source-binding -- --check`
- `node -e 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8"))'`
- `git diff --check`

### Authority boundary

The following must remain false through this tranche:

- runtime execution
- command execution
- write action
- direct file write
- generated patch apply
- connector ingestion
- connector write
- external service mutation
- raw material access
- cross-domain access
- secret read
- protected action
- protected closeout
- deployment
- release approval
- production PASS
- enterprise PASS
- enterprise trust claim
- Codex final approval
- Claude final approval
- final automated approval

### Closeout criteria

- Source specification exists, is non-empty, has source hash, and declares v1.1.
- Required source anchors are present.
- Phase A overlay contract inventory rows are visible.
- Authority boundary baseline rows are all false.
- Negative fixture contract rows cover required blockers.
- Targeted validation commands are declared and non-mutating.
- Package, architecture, and roadmap wiring are visible.
- `p60400_closeout_rows` all pass.
- `p60401_next_phase_handoff_rows` identify the next allowed action without opening execution authority.

### Next-phase handoff

`P60401-P60800` should consume this baseline and implement the first concrete Loop Overlay Contract rows for `HermesLoopDefinition`, `HermesLoopRun`, and `HermesLoopDAG`, while preserving the same false authority boundary.
