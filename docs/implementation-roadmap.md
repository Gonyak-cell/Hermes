# 구현 로드맵

## Phase 0: Local Harness

목표: 안전한 샘플 데이터로 matter brief 루프를 검증합니다.

- `schemas/matter.schema.json` 기준으로 데이터 계약 확정
- `examples/project-alpha-matter.json` 샘플 유지
- `npm run validate`와 `npm run brief` 통과
- Hermes skill이 CLI를 호출하도록 구성

완료 기준:

- 변호사가 샘플 brief를 보고 "매일 받으면 도움이 된다"는 수준까지 조정
- 법률판단이 아니라 운영 브리프임이 명확함

## Phase 1: Matter Data Intake

목표: 실제 사건 하나를 pilot로 연결합니다.

- matter ID naming rule 확정
- 팀원 role mapping
- 회의록, 메신저, 이메일 요약 입력 포맷 확정
- document register 도입
- deadline register 도입

완료 기준:

- 새 커뮤니케이션이 들어오면 task, deadline, pending question 후보가 생김
- 사람이 approve/reject/rewrite status를 붙일 수 있음

## Phase 2: Hermes Skills

목표: 반복 업무를 Hermes skill로 고정합니다.

- `matter-ops`: daily brief, pending items, review gates
- `ma-deal-control`: VDR, Q&A, CP/closing checklist
- `litigation-evidence-matrix`: chronology, claim-evidence map
- `governance-risk-map`: board minutes, disclosure, shareholder action checks

완료 기준:

- 같은 입력에 대해 같은 순서의 검토 절차가 실행됨
- skill이 산출물마다 human review note를 붙임

## Phase 3: Integrations

목표: 기존 로펌 시스템과 연결합니다.

- DMS 또는 파일서버
- Slack 또는 Microsoft Teams
- Outlook 또는 Google Calendar
- billing/ERP
- knowledge base

초기에는 read-only 연동을 권장합니다. 쓰기 작업은 review gate와 감사로그가 완성된 뒤 제한적으로 허용합니다.

## Phase 4: Production Controls

목표: 운영 리스크를 관리합니다.

- per-matter access control
- source-level audit trail
- retention policy
- prompt injection scanner
- model routing policy
- redaction and pseudonymization
- incident response runbook

완료 기준:

- 특정 matter의 모든 AI 산출물을 source와 reviewer 기준으로 재현 가능
- 고객별 AI 사용 제한을 기술적으로 반영 가능

## Phase 5: Resource Expansion Job

목표: `02_Template`, `플러그인`, VDR, 로컬 폴더처럼 파일 수가 많은 source를 중단/재개 가능한 backfill job으로 처리합니다.

- 파일별 `discovered`, `queued`, `ingested`, `classified`, `normalized`, `indexed`, `extracted`, `quarantined`, `failed`, `skipped_duplicate` 상태 기록
- `resource-expansion-state.json` 기반 재개
- content hash 기반 중복 감지
- OneDrive dataless, secret 후보, unsupported type, 대용량 파일 quarantine
- `resource_id`, `resource_version_id`, `raw_hash_sha256`, `text_hash_sha256`를 Evidence OS lineage root로 사용

현재 구현:

- `npm run resource:expand`
- `src/resource-expansion.mjs`
- `schemas/resource-expansion.schema.json`
- `docs/resource-expansion-job.md`

완료 기준:

- 같은 job을 여러 번 실행해도 이미 terminal 상태인 파일은 재처리되지 않음
- 중간 실패 후 같은 `--out-dir`로 다음 batch를 이어 처리 가능
- quarantine queue를 사람이 검토할 수 있음
- `npm test`에서 resumability, quarantine, duplicate handling이 검증됨

## Phase 6: Resource Ingest Gate

목표: Resource Expansion 결과 중 Evidence OS로 올릴 수 있는 항목만 core `resource-evidence.v1` 계약으로 승격합니다.

- `extracted` 항목을 Resource, ResourceVersion, NormalizedText, SourceSpan, EvidenceItem 후보로 변환
- `quarantined`와 `failed` 항목은 Evidence OS 승격 차단
- `skipped_duplicate` 항목은 non-blocking duplicate report로 분리
- 승격 결과를 `resource-evidence.json`으로 저장

현재 구현:

- `npm run resource:ingest`
- `src/resource-ingest.mjs`
- `docs/resource-ingest-gate.md`

완료 기준:

- `resource-expansion-job.json`에서 extracted 항목만 core Resource/Evidence 계약으로 승격됨
- 승격된 `resource-evidence.json`이 `schemas/core/resource-evidence.schema.json`을 통과함
- quarantine/failed 항목은 blocking gate로 남음
- duplicate 항목은 별도 report에 남되 Evidence OS 후보에는 포함되지 않음

## Phase 7: Evidence Viewer

목표: Evidence OS 후보를 사람이 검토할 수 있는 정적 review packet으로 렌더링합니다.

- `resource-ingest.json` 또는 `resource-evidence.json` 입력 지원
- Evidence 후보별 source URI, classification, review status, preview text 표시
- Ingest gate와 blocked item을 함께 표시
- 정적 HTML, JSON review packet, Markdown summary 생성

현재 구현:

- `npm run evidence:viewer`
- `src/evidence-viewer.mjs`
- `docs/evidence-viewer.md`

완료 기준:

- 승격된 resource-evidence 항목이 evidence review queue로 표시됨
- blocking gate와 blocked item이 viewer에 표시됨
- `npm test`에서 viewer output HTML/JSON/Markdown 생성이 검증됨

## Phase 8: Approval Queue

목표: Evidence Viewer의 review packet을 사람이 처리할 수 있는 pending approval/review queue로 변환합니다.

- `needs_review` evidence 후보를 `evidence_review` item으로 등록
- blocking gate를 `blocking_gate_review` item으로 등록
- quarantined/failed resource를 `blocked_resource_review` item으로 등록
- priority, recommended action, required decision을 명시
- 사람이 결정을 기록할 수 있는 `decision-template.json` 생성

현재 구현:

- `npm run approval:queue`
- `src/approval-queue.mjs`
- `schemas/approval-queue.schema.json`
- `docs/approval-queue.md`

완료 기준:

- Evidence Viewer 산출물에서 pending queue가 생성됨
- blocking gate와 blocked resource가 evidence review보다 높은 priority로 정렬됨
- queue schema validation이 통과함
- decision template이 모든 queue item을 포함함
