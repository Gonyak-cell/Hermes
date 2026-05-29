# Diff Review Gate

P222 Diff Review Gate는 P221 Implementation Patch Capture가 고정한 diff capture, touched file, generated artifact, run ledger binding을 기준으로 patch 후보를 검토하는 운영 게이트다.

이 단계는 agent의 self-report를 신뢰하지 않는다. Windows 기준선에서는 `git diff`, `git apply`, 파일 쓰기, 외부 agent 호출, plan acceptance, merge, release를 수행하지 않고, 이미 캡처된 artifact와 protected-file gate 평가만 읽어 다음 canonical test gate로 넘길 수 있는지 판정한다.

## Outputs

- `artifacts/diff-review-gate/latest/diff-review-gate.json`
- `artifacts/diff-review-gate/latest/diff-review-results.json`
- `artifacts/diff-review-gate/latest/diff-review-file-findings.json`
- `artifacts/diff-review-gate/latest/diff-review-artifact-findings.json`
- `artifacts/diff-review-gate/latest/diff-review-gate-results.json`
- `artifacts/diff-review-gate/latest/diff-review-desktop-boundary.json`
- `artifacts/diff-review-gate/latest/validation-report.json`
- `artifacts/diff-review-gate/latest/summary.md`

## Invariants

- Implementation Patch Capture와 Protected File Gate가 모두 complete여야 한다.
- Claude Code와 Codex diff review result는 각각 captured diff basis를 가져야 하며 `agent_self_report_trusted`는 항상 false다.
- touched file finding은 frozen scope 안에서만 reviewed 상태가 된다.
- generated artifact finding은 output artifact binding을 유지해야 한다.
- gate result는 `passed_with_human_gate`로 다음 canonical test gate를 가리키지만 patch application은 허용하지 않는다.
- patch application, git command, filesystem mutation, external agent invocation, plan acceptance, protected mutation은 모두 0/false다.
- Desktop surface는 read-only이며 patch, protected write, merge, release를 실행할 수 없다.

## Human Review Note

Diff Review Gate는 self-report 대신 캡처된 diff/file/artifact 증거를 기준으로 운영 검토 상태를 기록하는 단계다. canonical test, protected file scan, patch application, merge, release, legal/client-facing output은 모두 후속 human gate에서만 진행한다.
