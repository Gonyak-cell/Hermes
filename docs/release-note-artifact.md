# Release Note Artifact

Phase 226은 P225 PR Draft Artifact, Canonical Test Matrix, Dev Protected Scan을 source로 삼아 release note 초안을 deterministic artifact로 만든다.

이 단계는 실제 merge, release, branch push, GitHub API 호출, protected file write, production config 변경을 수행하지 않는다. `merged change` 기준은 실행된 merge가 아니라 사람이 승인할 수 있는 validated merge candidate로 기록한다.

## 산출물

- `artifacts/release-note-artifact/latest/release-note-artifact.json`
- `artifacts/release-note-artifact/latest/release-note.md`
- `artifacts/release-note-artifact/latest/release-note-output-artifacts.json`
- `artifacts/release-note-artifact/latest/release-note-change-records.json`
- `artifacts/release-note-artifact/latest/release-note-sections.json`
- `artifacts/release-note-artifact/latest/release-note-gate-bindings.json`
- `artifacts/release-note-artifact/latest/release-note-desktop-boundary.json`
- `artifacts/release-note-artifact/latest/validation-report.json`
- `artifacts/release-note-artifact/latest/summary.md`

## 운영 규칙

- release note는 `OutputArtifact v2` draft로 저장한다.
- publication, merge, release는 `blocked_pending_approval` 상태로 둔다.
- Desktop companion은 release note section, change record, gate binding, validation을 read-only로만 조회한다.
- client-facing 또는 법률 산출물은 생성하지 않고 human review gate를 유지한다.
