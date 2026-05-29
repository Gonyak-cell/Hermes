# Implementation Patch Capture

P221 Implementation Patch Capture는 P220 Dev Lane Ledger 이후 Claude Code와 Codex lane의 diff/patch 후보를 실제 적용하지 않고 deterministic run ledger artifact로 고정하는 운영 단계다.

Windows 기준선에서는 `git diff`, `git apply`, 파일 쓰기, 외부 agent 호출, plan acceptance, merge, release를 수행하지 않는다. P205 Runtime Artifact Capture의 diff capture, P219 Scope Freeze Gate의 file boundary, P220 Dev Lane Ledger의 lane record를 읽어 patch record, touched file, generated artifact, run ledger binding만 기록한다.

## Outputs

- `artifacts/implementation-patch-capture/latest/implementation-patch-capture.json`
- `artifacts/implementation-patch-capture/latest/implementation-patch-records.json`
- `artifacts/implementation-patch-capture/latest/implementation-diff-captures.json`
- `artifacts/implementation-patch-capture/latest/implementation-touched-files.json`
- `artifacts/implementation-patch-capture/latest/implementation-generated-artifacts.json`
- `artifacts/implementation-patch-capture/latest/implementation-run-ledger-bindings.json`
- `artifacts/implementation-patch-capture/latest/implementation-patch-desktop-boundary.json`
- `artifacts/implementation-patch-capture/latest/validation-report.json`
- `artifacts/implementation-patch-capture/latest/summary.md`

## Invariants

- Dev Lane Ledger, Scope Freeze Gate, Runtime Artifact Capture가 모두 complete여야 한다.
- Claude Code와 Codex patch record는 각각 하나씩 captured 상태여야 한다.
- diff capture는 OutputArtifact에 bound되어야 하며 direct apply/merge는 false다.
- touched file은 frozen scope file boundary에서만 나온다.
- generated artifact와 run ledger binding은 agent run, workflow run, output artifact 식별자에 연결된다.
- patch application, git command, filesystem mutation, external agent invocation, plan acceptance, protected mutation은 모두 0/false다.
- Desktop surface는 read-only이며 patch, protected write, merge, release를 수행할 수 없다.

## Human Review Note

Implementation Patch Capture는 구현 후보를 검토 가능한 메타데이터로 묶는 단계일 뿐이다. diff review, canonical test, protected file scan, patch application, merge, release, legal/client-facing output은 모두 후속 human gate 뒤에서만 진행한다.
