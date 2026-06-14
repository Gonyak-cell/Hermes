# P64401-P64800 Claude Code Opus Max Read-Only Review Execution

P64401-P64800은 P64400에서 생성한 post-P64000 review packet을 실제 Claude Code Opus max read-only reviewer lane에 전달하고, 결과를 durable raw JSON으로 캡처하는 tranche다. 이 단계는 review receipt를 정규화하거나 findings를 해결하지 않는다. blocking finding이 있어도 raw evidence가 유효하면 P64801-P65200 finding loop로 넘긴다.

## Phase Objective

- P64400 baseline과 review packet을 source로 고정한다.
- Claude Code Opus max를 read-only reviewer로 실행한다.
- raw CLI JSON을 durable artifact로 저장한다.
- auth failure, PTY/stdout loss, malformed output, tool-call-shaped output을 review evidence로 세지 않는다.
- blocking findings를 숨기지 않고 P64801 handoff로 넘긴다.

## Source Binding

- `artifacts/post-p64000-claude-review/latest/post-p64000-claude-review-baseline.json`
- `artifacts/post-p64000-claude-review/latest/claude-review-packet.md`
- `artifacts/post-p64000-claude-review/review/claude-review-raw.json`
- `docs/hermes-roadmap-p64001-p64400.md`
- current `HEAD`

## Output Rows

- `p64400_baseline_source_rows`
- `claude_review_execution_rows`
- `raw_review_output_shape_rows`
- `authority_boundary_rows`
- `negative_fixture_contract_rows`
- `validation_command_rows`
- `p64800_wiring_rows`
- `p64800_closeout_rows`
- `p64801_handoff_rows`

## Schema, Script, Doc, Test Scope

- `schemas/post-p64000-claude-review-execution.schema.json`
- `src/post-p64000-claude-review-execution.mjs`
- `scripts/post-p64000-claude-review-execution.mjs`
- `test/post-p64000-claude-review-execution.test.mjs`
- `docs/hermes-roadmap-p64401-p64800.md`
- `package.json`
- `docs/architecture.md`

## Negative Fixtures

- `missing_p64400_baseline`
- `p64400_not_ready`
- `missing_review_packet`
- `missing_raw_capture`
- `empty_raw_capture`
- `malformed_raw_json`
- `auth_failure_raw_output`
- `pty_stdout_loss_counted_as_evidence`
- `tool_call_shaped_output_counted_as_review`
- `missing_review_json_payload`
- `source_mutation_claim`
- `claude_final_approval_claim`

## Validation Commands

```bash
node --check src/post-p64000-claude-review-execution.mjs
node --check scripts/post-p64000-claude-review-execution.mjs
node --test test/post-p64000-claude-review-execution.test.mjs
npm run platform:post-p64000-claude-review-execution -- --check
node --test test/post-p64000-claude-review-baseline.test.mjs test/post-p64000-claude-review-execution.test.mjs
npm run platform:review-authority-contract -- --check
npm run platform:review-process-upgrade -- --check
node -e 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8")); JSON.parse(require("node:fs").readFileSync("schemas/post-p64000-claude-review-execution.schema.json", "utf8"));'
git diff --check
```

## Authority Boundary

P64401-P64800에서 허용되는 것은 read-only review raw capture뿐이다. Claude source mutation, final approval, receipt normalization, finding resolution, protected closeout, runtime execution, write action, connector write, deployment, production PASS, enterprise PASS는 false다.

## Closeout Criteria

- P64400 baseline과 packet이 ready다.
- Claude raw output file이 존재하고 JSON parse 가능하다.
- Claude CLI raw result가 success이며 auth failure가 아니다.
- result payload에서 `overall_verdict`, `blocks_clean_checkpoint`, `open_blocking_finding_count`, `findings`를 추출할 수 있다.
- source mutation과 final approval claim이 없다.
- blocking finding이 있으면 P64801 handoff에 visible blocker로 전달한다.

## Next-Phase Handoff

P64801-P65200은 durable raw review를 receipt로 normalize하고, blocking/nonblocking finding을 finding loop와 adjudication candidate로 라우팅한다. 이 handoff는 clean closeout, production PASS, enterprise PASS, final approval이 아니다.
