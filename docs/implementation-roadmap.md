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

## Phase 9: Approval Decision Applier

목표: `decision-template.json`에 사람이 기록한 결정을 적용해 review status patch와 audit trail을 생성합니다.

- `approval-queue.json`과 decision file을 조합
- `pending`이 아닌 decision만 적용
- evidence decision은 `resource-evidence.patched.json`의 `review_status`에 반영
- gate/resource decision은 follow-up action과 audit event로 기록
- 모든 decision은 `approval.decided` audit event를 남김

현재 구현:

- `npm run approval:apply`
- `src/approval-decisions.mjs`
- `schemas/approval-decision-result.schema.json`
- `docs/approval-decisions.md`

완료 기준:

- approved/rejected/changes_requested decision이 evidence review status에 반영됨
- pending decision은 unapplied로 보존됨
- audit event가 decision마다 생성됨
- result schema validation이 통과함

## Phase 10: Review Dashboard

목표: Resource Expansion, Resource Ingest, Evidence Viewer, Approval Queue, Approval Decisions, Personal Dev Slice 산출물을 하나의 dashboard/API 계약으로 묶습니다.

- 각 단계 산출물의 존재 여부와 schema version, generated_at, summary를 수집
- 단계별 status를 `missing`, `blocked`, `attention`, `pending`, `passed`로 정규화
- pending approval, blocking gate, blocked resource, follow-up action을 action queue로 표시
- 정적 HTML, JSON dashboard, Markdown summary 생성

현재 구현:

- `npm run dashboard:build`
- `src/review-dashboard.mjs`
- `schemas/review-dashboard.schema.json`
- `docs/review-dashboard.md`

완료 기준:

- 기존 review/approval 산출물을 읽어 `review-dashboard.json`을 생성함
- dashboard schema validation이 통과함
- `index.html`에서 단계별 상태와 action queue를 확인할 수 있음
- `npm test`에서 approval decision 이후 dashboard 생성이 검증됨

## Phase 11: Review API

목표: `review-dashboard.json`을 읽기 전용 HTTP API와 정적 HTML entrypoint로 노출합니다.

- `GET /`에서 정적 dashboard HTML 제공
- `GET /health`에서 dashboard artifact availability와 overall status 제공
- `GET /api/dashboard`, `/api/summary`, `/api/stages`, `/api/actions`, `/api/sources` 제공
- API route index를 `review-api-index.v1` 계약으로 제공
- 쓰기성 protected action은 아직 실행하지 않고 read-only boundary 유지

현재 구현:

- `npm run api:serve`
- `npm run api:smoke`
- `src/review-api.mjs`
- `schemas/review-api-index.schema.json`
- `docs/review-api.md`

완료 기준:

- dashboard artifact를 API로 읽을 수 있음
- route index schema validation이 통과함
- smoke test가 임시 포트에서 API를 띄운 뒤 주요 route를 검증함
- `npm test`에서 API 응답과 action filtering이 검증됨

## Phase 12: Domain Pack Registry

목표: Law Firm, Personal Dev, Creative Document, Common pack을 core 수정 없이 등록 가능한 플러그인형 패키지로 고정합니다.

- `packs/*/pack.json` manifest 도입
- pack manifest가 capabilities, policies, schemas, workflows, gates, templates, extractors, renderers, migrations, golden cases, dependencies, permissions를 선언
- pack capability가 기존 `capability-manifest.v1`과 policy matrix를 통과하는지 검증
- pack dependency와 capability `domain_pack` 불일치 검출
- registry artifact와 summary 생성

현재 구현:

- `npm run packs:registry`
- `npm run packs:validate`
- `src/domain-pack-registry.mjs`
- `schemas/domain-pack-registry.schema.json`
- `packs/common/pack.json`
- `packs/law-firm/pack.json`
- `packs/personal-dev/pack.json`
- `packs/creative-document/pack.json`
- `docs/domain-pack-registry.md`

완료 기준:

- 네 pack이 registry에 등록됨
- Law Firm, Personal Dev, Creative Document pack이 Common pack에 의존함
- pack capability가 capability manifest와 policy matrix 검증을 통과함
- `npm run validate`가 pack registry 검증까지 포함함

## Phase 13: Law Firm LDD Slice

목표: 로펌용 Resource/Evidence를 입력으로 받아 LDD issue/RFI 후보, citation, gate, attorney approval, event ledger를 관통하는 얇은 vertical slice를 구현합니다.

- `law_firm.ldd.issue_report` capability manifest를 Law Firm Pack에 등록
- `resource-evidence.json` 또는 `resource-ingest.json` 입력 지원
- evidence item과 source span을 fact, issue, citation으로 변환
- markdown LDD issue report를 draft artifact로 생성
- matter access, classification, evidence coverage, citation, human approval gate 생성
- attorney approval 전에는 blocked/pending_review 상태 유지
- event ledger와 run ledger 생성

현재 구현:

- `npm run law-firm:slice`
- `src/law-firm-ldd-slice-runner.mjs`
- `packs/law-firm/capabilities/ldd-issue-report.json`
- `docs/law-firm-ldd-slice-runner.md`

완료 기준:

- LDD slice가 core vertical slice schema와 event ledger validation을 통과함
- 생성 report의 각 issue 후보가 citation과 source span에 연결됨
- `human_approval_gate`가 blocking pending 상태로 남음
- `npm test`와 실제 `npm run law-firm:slice` 실행이 통과함

## Phase 14: Law Firm Dashboard Integration

목표: Law Firm LDD Slice 결과를 Review Dashboard/API의 stage, summary, action queue에 통합합니다.

- `artifacts/law-firm-ldd-slice/latest/summary.json`을 dashboard source로 읽음
- Law Firm LDD stage를 `law_firm_ldd_slice`로 표시
- issue, RFI, citation count를 dashboard summary에 반영
- attorney approval pending 상태를 `/api/actions` action queue에 추가
- pending approval count에 Law Firm/Personal Dev slice approval blocker를 포함

현재 구현:

- `src/review-dashboard.mjs`
- `schemas/review-dashboard.schema.json`
- `docs/review-dashboard.md`

완료 기준:

- dashboard가 Law Firm LDD Slice source를 포함함
- `law_firm_ldd_slice` stage와 action item이 생성됨
- `/api/actions?source_stage=law_firm_ldd_slice`로 attorney approval action을 조회할 수 있음
- `npm test`, `dashboard:build`, `api:smoke`가 통과함

## Phase 15: Domain Pack Dashboard/API Integration

목표: Domain Pack Registry를 Dashboard/API에 1급 운영 상태로 노출합니다.

- `artifacts/domain-packs/latest/domain-pack-registry.json`을 dashboard source로 읽음
- pack/capability validation 상태를 `domain_pack_registry` stage로 표시
- pack count, capability count, invalid/error count를 dashboard summary에 반영
- validation error가 있으면 action queue에 `needs_fix` 항목을 생성
- Review API에서 `/api/packs`, `/api/capabilities` 읽기 전용 route를 제공

현재 구현:

- `src/review-dashboard.mjs`
- `src/review-api.mjs`
- `schemas/review-dashboard.schema.json`
- `scripts/review-api-smoke.mjs`
- `docs/review-dashboard.md`
- `docs/review-api.md`

완료 기준:

- dashboard가 Domain Pack Registry source와 `domain_pack_registry` stage를 포함함
- `/api/packs?pack_id=law-firm`로 Law Firm pack을 조회할 수 있음
- `/api/capabilities?pack_id=law-firm`로 Law Firm capability를 조회할 수 있음
- `npm test`, `dashboard:build`, `api:smoke`가 통과함

## Phase 16: Creative Document PPTX Slice

목표: Creative Document Pack의 PPTX 디자인 시스템 capability를 Control Plane vertical slice로 실행합니다.

- `creative_document.pptx.design_system` capability를 실제 runner와 연결
- `creative-document-brief.v1` 입력을 Resource/Evidence 계약으로 승격
- deck manifest, markdown outline, deterministic draft PPTX 생성
- `classification_gate`, `tool_permission_gate`, `cost_budget_gate`, `format_validation_gate`, `human_approval_gate` 생성
- draft PPTX는 human approval 전 delivery 불가 상태로 유지
- event ledger와 run ledger 생성
- Review Dashboard/API에 creative document stage와 approval action을 표시

현재 구현:

- `npm run creative-document:slice`
- `src/creative-document-slice-runner.mjs`
- `scripts/run-creative-document-slice.mjs`
- `examples/creative-document-brief.json`
- `docs/creative-document-slice-runner.md`
- `src/review-dashboard.mjs`

완료 기준:

- Creative Document slice가 core vertical slice schema와 event ledger validation을 통과함
- `draft-deck.pptx`, `deck-manifest.json`, `deck-outline.md`가 생성됨
- `format_validation_gate`가 passed, `human_approval_gate`가 blocking pending 상태로 남음
- dashboard가 `creative_document_slice` stage와 action item을 포함함
- `npm test`, `creative-document:slice`, `dashboard:build`, `api:smoke`가 통과함

## Phase 17: Output Artifact Catalog

목표: Law Firm, Personal Dev, Creative Document slice의 산출물을 하나의 Output/Delivery Plane 카탈로그로 묶습니다.

- 각 slice의 `governance_output.output_artifacts`를 수집
- artifact별 capability, workflow, approval, blocking gate, citation count를 연결
- `delivery_state`로 draft-only, approval blocked, gate blocked, ready, delivered 상태를 정규화
- `output-catalog.json`과 `summary.md` 생성
- Review Dashboard에 `output_artifact_catalog` stage와 output summary를 추가
- Review API에서 `/api/artifacts` 읽기 전용 route를 제공

현재 구현:

- `npm run output:catalog`
- `src/output-artifact-catalog.mjs`
- `schemas/output-artifact-catalog.schema.json`
- `docs/output-artifact-catalog.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- catalog가 Law Firm, Personal Dev, Creative Document 산출물을 모두 포함함
- pending approval 때문에 delivery blocked 상태가 artifact별로 계산됨
- dashboard가 output artifact count와 blocked delivery count를 표시함
- `/api/artifacts?delivery_state=blocked_pending_approval`로 승인 대기 산출물을 조회할 수 있음
- `npm test`, `output:catalog`, `dashboard:build`, `api:smoke`가 통과함

## Phase 18: Observability Catalog

목표: 각 slice의 Event Ledger, Run Ledger, Workflow Runtime을 하나의 Observability/Cost Plane 카탈로그로 묶습니다.

- slice JSON과 `event-ledger.json`을 함께 읽음
- workflow run별 runtime, gate, approval, output, event, cost를 연결
- event record와 cost record를 읽기 전용 collection으로 정규화
- `observability-catalog.json`과 `summary.md` 생성
- Review Dashboard에 `observability_catalog` stage와 run/event/runtime summary를 추가
- Review API에서 `/api/runs`, `/api/events`, `/api/costs` 읽기 전용 route를 제공

현재 구현:

- `npm run observability:catalog`
- `src/observability-catalog.mjs`
- `schemas/observability-catalog.schema.json`
- `docs/observability-catalog.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- catalog가 Law Firm, Personal Dev, Creative Document run ledger를 모두 포함함
- pending approval, blocking gate, runtime seconds가 run별로 계산됨
- dashboard가 observability run/event/runtime summary를 표시함
- `/api/runs?runtime_id=codex`와 `/api/events?event_type=approval.requested`로 실행 기록을 조회할 수 있음
- `npm test`, `observability:catalog`, `dashboard:build`, `api:smoke`가 통과함

## Phase 19: Protected Delivery Queue

목표: Output Artifact를 실제 전달/merge/email 후보로 정규화하되, 사람 승인과 gate가 끝나기 전까지 protected action으로 차단합니다.

- Output Artifact Catalog를 입력으로 delivery action 생성
- Observability Catalog의 run status와 runtime seconds로 action을 보강
- artifact type/domain별 delivery target과 delivery channel 부여
- approval pending, gate blocked, decision blocked, ready, delivered 상태를 유지
- `protected-delivery-queue.json`과 `summary.md` 생성
- Review Dashboard에 `protected_delivery_queue` stage와 delivery summary/action item 추가
- Review API에서 `/api/delivery-actions` 읽기 전용 route 제공

현재 구현:

- `npm run delivery:queue`
- `src/protected-delivery-queue.mjs`
- `schemas/protected-delivery-queue.schema.json`
- `docs/protected-delivery-queue.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- Law Firm, Personal Dev, Creative Document 산출물이 delivery action으로 정규화됨
- approval pending과 blocking gate가 delivery blocker로 남음
- dashboard가 delivery action count와 blocked/ready count를 표시함
- `/api/delivery-actions?delivery_status=blocked_pending_approval`로 전달 차단 항목을 조회할 수 있음
- `npm test`, `delivery:queue`, `dashboard:build`, `api:smoke`가 통과함

## Phase 20: Matter Cockpit

목표: Resource/Evidence, Output, Observability, Delivery Queue를 matter/project 단위로 묶어 운영 상태를 확인합니다.

- Resource/Evidence에서 matter별 resource/evidence/review count 수집
- Output Artifact Catalog에서 matter별 output, approval, delivery blocker 수집
- Observability Catalog에서 matter별 workflow run, runtime, gate/error count 수집
- Protected Delivery Queue에서 matter별 delivery action과 channel 수집
- `matter-cockpit.json`과 `summary.md` 생성
- Review Dashboard에 `matter_cockpit` stage와 matter summary/action item 추가
- Review API에서 `/api/matters` 읽기 전용 route 제공

현재 구현:

- `npm run matter:cockpit`
- `src/matter-cockpit.mjs`
- `schemas/matter-cockpit.schema.json`
- `docs/matter-cockpit.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- Law Firm, Personal Dev, Creative Document matter/project가 같은 cockpit 계약으로 조회됨
- blocked delivery, pending approval, blocking gate가 matter status에 반영됨
- dashboard가 matter count와 blocked matter count를 표시함
- `/api/matters?status=blocked`로 막힌 matter/project를 조회할 수 있음
- `npm test`, `matter:cockpit`, `dashboard:build`, `api:smoke`가 통과함
