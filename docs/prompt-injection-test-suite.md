# Prompt Injection Test Suite

Phase 298 adds `prompt_injection_test_suite`, a deterministic synthetic fixture suite for prompt injection checks.

The suite verifies that external document instructions remain evidence data and never become:

- prompt instructions
- tool instructions
- policy overrides
- raw instruction execution
- client-facing output
- external transfer
- protected action execution

## Inputs

- `artifacts/threat-model-refresh/latest/threat-model-refresh.json`
- `artifacts/workflow-prompt-injection-boundary/latest/workflow-prompt-injection-boundary.json`
- repository docs and source files for registration checks

## Outputs

- `prompt-injection-test-suite.json`
- `prompt-injection-test-fixtures.json`
- `prompt-injection-test-results.json`
- `prompt-injection-promotion-checks.json`
- `prompt-injection-test-boundary.json`
- `validation-report.json`
- `summary.md`

## Boundary

The P298 suite uses synthetic external-document instruction fixtures only. It does not read source content, ingest sources, invoke agents, execute tools, execute routes, start a server, perform external transfers, execute protected actions, generate legal advice, or produce client-facing output. Human review and the Windows baseline stability posture remain explicit gates.
