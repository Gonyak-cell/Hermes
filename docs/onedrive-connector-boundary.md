# OneDrive Connector Boundary

`connectors:onedrive-boundary`는 Phase 269 OneDrive connector boundary 아티팩트를 작성한다.

이 단계는 실제 OneDrive 연결, OAuth 인증, 네트워크 접근, 파일 다운로드를 수행하지 않는다. P267 Connector Contract v2의 `connector.onedrive.v2` 계약에 맞춰 다음 경계를 먼저 고정한다.

- timeout 정책: delta page, metadata fetch, cloud content materialization, large file probe의 제한 시간과 재시도/검토 동작을 명시한다.
- placeholder 정책: cloud-only placeholder, available-offline file, remote item shortcut, package/bundle placeholder를 metadata-only 기본값과 human-review materialization gate로 분리한다.
- cloud-only 처리: 샘플 drive item을 `matter_id` 단위로 유지하면서 external_id/external_version_id, materialization 상태, review gate를 기록한다.
- cursor boundary: delta token은 hash-only로 저장하고 raw token material, cross-matter cursor reuse, 자동 reset을 금지한다.
- auth boundary: OAuth delegated read-only scope와 credential-reference-only 원칙을 기록하되 raw secret material을 읽지 않는다.

출력은 `artifacts/onedrive-connector-boundary/latest/` 아래에 작성된다.

- `onedrive-connector-boundary.json`
- `timeout-policies.json`
- `placeholder-policies.json`
- `cloud-only-handling.json`
- `cursor-boundary.json`
- `auth-boundary.json`
- `validation-report.json`
- `summary.md`

검증 명령:

```powershell
npm run connectors:onedrive-boundary -- --check
```

이 아티팩트는 human review가 필요한 내부 운영 경계이며, 법률 자문이나 client-facing output을 생성하지 않는다.
