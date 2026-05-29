# Rollback Plan Artifact

Phase 227은 P225 PR Draft Artifact, P226 Release Note Artifact, Implementation Patch Capture, Diff Review Gate를 source로 삼아 rollback 대상 commit, file, command를 명시하는 deterministic artifact다.

이 단계는 실제 rollback, command execution, `git` 명령, file restore, commit revert, branch push, merge, release, protected write를 실행하지 않는다. 모든 실행은 human approval 이후의 별도 절차로 남긴다.

## 산출물

- `artifacts/rollback-plan-artifact/latest/rollback-plan-artifact.json`
- `artifacts/rollback-plan-artifact/latest/rollback-plan.md`
- `artifacts/rollback-plan-artifact/latest/rollback-plan-output-artifacts.json`
- `artifacts/rollback-plan-artifact/latest/rollback-commit-targets.json`
- `artifacts/rollback-plan-artifact/latest/rollback-file-targets.json`
- `artifacts/rollback-plan-artifact/latest/rollback-command-targets.json`
- `artifacts/rollback-plan-artifact/latest/rollback-plan-bindings.json`
- `artifacts/rollback-plan-artifact/latest/rollback-plan-desktop-boundary.json`
- `artifacts/rollback-plan-artifact/latest/validation-report.json`
- `artifacts/rollback-plan-artifact/latest/summary.md`

## 운영 규칙

- commit target은 unmerged branch 또는 patch candidate 기준으로만 기록한다.
- file target은 captured touched file을 restore candidate로만 기록한다.
- command target은 preview와 instruction만 제공하고 execution flag는 항상 false다.
- Desktop companion은 rollback target, binding, validation을 read-only로만 조회한다.
- rollback 실행, protected write, client-facing output은 human review gate 뒤에 둔다.
