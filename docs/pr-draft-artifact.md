# PR Draft Artifact

Phase 225는 Personal Dev lane의 검증된 diff, canonical test, protected scan 결과를 사람이 검토할 수 있는 PR draft output artifact로 묶는 단계다. 이 단계는 GitHub PR을 생성하거나 branch push, merge, release, protected write를 실행하지 않는다.

## 산출물

- `artifacts/pr-draft-artifact/latest/pr-draft-artifact.json`
- `artifacts/pr-draft-artifact/latest/pr-draft.md`
- `artifacts/pr-draft-artifact/latest/pr-draft-output-artifacts.json`
- `artifacts/pr-draft-artifact/latest/pr-draft-sections.json`
- `artifacts/pr-draft-artifact/latest/pr-draft-test-evidence.json`
- `artifacts/pr-draft-artifact/latest/pr-draft-risks.json`
- `artifacts/pr-draft-artifact/latest/pr-draft-rollback-plan.json`
- `artifacts/pr-draft-artifact/latest/pr-draft-bindings.json`
- `artifacts/pr-draft-artifact/latest/pr-draft-desktop-boundary.json`
- `artifacts/pr-draft-artifact/latest/validation-report.json`
- `artifacts/pr-draft-artifact/latest/summary.md`

## 필수 섹션

- Summary: captured patch, touched files, diff review, protected blocks, source OutputArtifact를 요약한다.
- Tests: Canonical Test Matrix의 required test evidence를 기록한다.
- Risks: protected file, secret/credential, production config, diff review human gate 위험을 기록한다.
- Rollback: merge 전 review-only 상태 유지, draft 폐기, validation gate 재실행 절차를 기록한다.

## 불변 조건

- PR draft는 `output-artifact.v2`로 저장되고 `artifact_type: pr_draft`, `output_status: draft`, `delivery_state: blocked_pending_approval` 상태를 유지한다.
- 실제 PR 생성, GitHub API 호출, branch push, merge, release는 수행되지 않는다.
- rollback plan은 draft일 뿐 command execution이나 protected action을 허용하지 않는다.
- Desktop 표면은 read-only이며 PR 생성, merge, release, protected write의 source of truth가 아니다.

## Human Review

이 산출물은 운영 검토용 초안이다. PR 생성, merge, release, production config 변경, credential 변경, client-facing 출력은 명시적인 human review와 승인 없이는 실행할 수 없다.
