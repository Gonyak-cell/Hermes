# Dev Protected Scan

Phase 224는 Canonical Test Matrix 이후에 실행되는 Windows 기준선 보호 파일/시크릿 스캔 산출물이다. 이 단계는 실제 시크릿 값을 읽거나 출력하지 않고, Implementation Patch Capture, Diff Review Gate, Canonical Test Matrix, Protected File Gate의 구조화된 메타데이터만 결합해 credential, secret, production config, migration 후보가 명시 승인 전 차단되는지 확인한다.

## 산출물

- `artifacts/dev-protected-scan/latest/dev-protected-scan.json`
- `artifacts/dev-protected-scan/latest/dev-protected-file-findings.json`
- `artifacts/dev-protected-scan/latest/dev-secret-findings.json`
- `artifacts/dev-protected-scan/latest/dev-prod-config-findings.json`
- `artifacts/dev-protected-scan/latest/dev-protected-scan-results.json`
- `artifacts/dev-protected-scan/latest/dev-protected-scan-bindings.json`
- `artifacts/dev-protected-scan/latest/dev-protected-scan-desktop-boundary.json`
- `artifacts/dev-protected-scan/latest/validation-report.json`
- `artifacts/dev-protected-scan/latest/summary.md`

## 불변 조건

- 모든 보호 파일 후보는 `blocked_pending_explicit_approval` 상태여야 한다.
- credential 또는 secret 후보는 raw secret material을 materialize하지 않고 차단해야 한다.
- production config 후보는 승인 전 write/mutation이 허용되지 않아야 한다.
- Canonical Test Matrix의 통과 binding 이후에만 scan result와 binding이 생성된다.
- Desktop 표면은 read-only이며 command execution, patch application, git command, filesystem mutation, protected write, secret read, production config write, merge, release의 source of truth가 아니다.

## Human Review

이 산출물은 개발 기준선 안정화와 보호 변경 차단 여부를 검증하기 위한 운영 산출물이다. 법률 분석, filing 판단, client-facing 출력물은 생성하지 않으며, 보호 파일 또는 production config 변경은 별도의 명시 승인과 human review 없이는 적용할 수 없다.
