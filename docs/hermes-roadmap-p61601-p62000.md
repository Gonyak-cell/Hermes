# Hermes Roadmap P61601-P62000

## P61601-P62000 Hermes Loop Context And Memory Grounding

### Phase objective

P61600 run ledger projection을 source로 받아 Phase C Context and Memory Grounding을 구현한다. Context bundle, citation/source span, memory operation candidate, stale/conflict/domain guard, raw/full body non-exposure를 row-level artifact로 고정한다.

### Source binding

- Primary source: `artifacts/hermes-loop-run-ledger-projection/latest/hermes-loop-run-ledger-projection.json`
- Rebuild fallback: P61600 run ledger projection을 source specification에서 in-memory로 재계산
- Source anchors: `9 Context Builder 요구사항`, `6.11 Memory and Recall Layer`, `2.5 Memory Is Grounded Recall`, `20 보안 및 컴플라이언스 요구사항`, `21.3 Phase C`

### Output rows

- `p61600_run_ledger_source_rows`
- `context_bundle_contract_rows`
- `citation_source_span_binding_rows`
- `memory_operation_candidate_rows`
- `stale_conflict_domain_guard_rows`
- `raw_body_non_exposure_rows`
- `authority_boundary_carryover_rows`
- `negative_fixture_contract_rows`
- `validation_command_rows`
- `hermes_loop_context_memory_wiring_rows`
- `p62000_closeout_rows`
- `p62001_next_phase_handoff_rows`

### Schema/script/doc/test change scope

- Schema: `schemas/hermes-loop-context-memory-grounding.schema.json`
- Source module: `src/hermes-loop-context-memory-grounding.mjs`
- CLI script: `scripts/hermes-loop-context-memory-grounding.mjs`
- Test: `test/hermes-loop-context-memory-grounding.test.mjs`
- Package script: `platform:hermes-loop-context-memory-grounding`
- Architecture note: `docs/architecture.md`

### Negative fixtures

- missing P61600 run ledger source
- P61600 validation invalid
- missing context bundle field
- missing citation or source span
- uncited recall
- stale source as current
- cross-domain recall
- raw/full body exposure
- prompt injection marker missing
- source conflict unresolved
- authority carryover true
- missing P62001 handoff

### Validation commands

- `node --check src/hermes-loop-context-memory-grounding.mjs`
- `node --check scripts/hermes-loop-context-memory-grounding.mjs`
- `node --test test/hermes-loop-context-memory-grounding.test.mjs`
- `npm run platform:hermes-loop-context-memory-grounding -- --check`
- `node -e 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8")); JSON.parse(require("node:fs").readFileSync("schemas/hermes-loop-context-memory-grounding.schema.json", "utf8"));'`
- `git diff --check`

### Authority boundary

Context and memory rows are grounded recall candidates only. Raw/full transcript or source body response, runtime recall truth, auto context mutation, cross-domain access, connector write, protected closeout, production PASS, enterprise PASS, Codex final approval, Claude final approval, and final automated approval remain false.

### Closeout criteria

- P61600 source is valid and ready.
- Context bundle contract rows pass.
- Citation/source span rows pass.
- Memory operation candidate rows pass.
- Stale/conflict/domain guard rows pass.
- Raw/full body non-exposure rows pass.
- Authority carryover rows remain false.
- Negative fixtures are complete.
- P62001 handoff points to bounded DAG topology.

### Next-phase handoff

`P62001-P62400` should implement DAG and Worker/Verifier Topology: bounded DAG, correction edge policy, terminal stop node, retry/budget consumption, and no unbounded cycle guard.
