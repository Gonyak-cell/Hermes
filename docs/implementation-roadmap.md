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

## Phase 21: Approval Inbox

목표: Evidence approval queue 밖에 흩어진 output/delivery approval request와 gate blocker를 하나의 사람 검토 inbox로 묶습니다.

- Protected Delivery Queue의 blocked delivery action을 approval inbox item으로 변환
- Matter Cockpit의 matter context로 pending approval, blocker, runtime 정보를 보강
- `approval_request`와 `gate_blocker_review` item type 분리
- 사람이 채울 수 있는 `decision-template.json` 생성
- Review Dashboard에 `approval_inbox` stage와 action item 추가
- Review API에서 `/api/approvals` 읽기 전용 route 제공

현재 구현:

- `npm run approval:inbox`
- `src/approval-inbox.mjs`
- `schemas/approval-inbox.schema.json`
- `docs/approval-inbox.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- delivery approval pending과 gate blocker가 모두 inbox item으로 정규화됨
- approval request와 gate blocker review가 구분됨
- decision template이 모든 inbox item을 포함함
- `/api/approvals?item_type=approval_request`로 승인 요청을 조회할 수 있음
- `npm test`, `approval:inbox`, `dashboard:build`, `api:smoke`가 통과함

## Phase 22: Approval Inbox Decisions

목표: 사람이 채운 Approval Inbox decision file을 읽고 output/delivery 상태 patch와 audit event를 생성합니다.

- `approval_request` 결정으로 approval/output/delivery 상태 patch 생성
- `gate_blocker_review` 결정으로 human approval gate blocker 해소 또는 유지
- `patched-delivery-queue.json`과 `patched-output-catalog.json` 생성
- 모든 적용 결정을 `approval_inbox.decided` audit event로 기록
- Review Dashboard에 `approval_inbox_decisions` stage와 summary 추가
- Review API에서 `/api/approval-inbox-decisions` 읽기 전용 route 제공

현재 구현:

- `npm run approval:inbox:apply`
- `src/approval-inbox-decisions.mjs`
- `schemas/approval-inbox-decision-result.schema.json`
- `docs/approval-inbox-decisions.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- 승인 요청 `approve`가 `ready_for_delivery` patch로 이어짐
- gate blocker `mark_resolved` 또는 `waive_for_now`가 blocker 해소 patch로 이어짐
- 결정 적용 결과와 audit event가 schema validation을 통과함
- `/api/approval-inbox-decisions?decision=approve`로 적용된 결정을 조회할 수 있음
- `npm test`, `approval:inbox:apply`, `dashboard:build`, `api:smoke`가 통과함

## Phase 23: Delivery Execution Draft

목표: `ready_for_delivery`가 된 delivery action을 실제 실행하지 않고, 사람이 최종 확인할 draft packet으로 묶습니다.

- patched delivery queue에서 `ready_for_delivery` action 추출
- patched output catalog로 approval, citation, content hash context 보강
- delivery channel/target/matter별 execution packet 생성
- 모든 candidate와 packet은 `draft_not_executed`, `requires_manual_execution`, `final_check_required` 상태 유지
- Review Dashboard에 `delivery_execution_draft` stage와 execution summary/action item 추가
- Review API에서 `/api/delivery-execution-candidates`, `/api/delivery-execution-packets` route 제공

현재 구현:

- `npm run delivery:execution:draft`
- `src/delivery-execution-draft.mjs`
- `schemas/delivery-execution-draft.schema.json`
- `docs/delivery-execution-draft.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- ready delivery action이 draft execution candidate로 정규화됨
- candidate가 자동 실행되지 않고 manual checklist를 포함함
- matter/channel/target별 execution packet이 생성됨
- `/api/delivery-execution-candidates?delivery_channel=github`로 GitHub 실행 후보를 조회할 수 있음
- `npm test`, `delivery:execution:draft`, `dashboard:build`, `api:smoke`가 통과함

## Phase 24: Delivery Receipt Ledger

목표: 사람이 실제로 수행한 수동 전달/merge/export 결과만 receipt로 기록하고, delivered 상태 patch와 audit event를 생성합니다.

- Delivery Execution Draft의 packet별 receipt template 생성
- receipt input이 없거나 `pending`이면 delivered patch를 만들지 않음
- `delivered` receipt에 대해서만 delivery/output delivered patch 생성
- 모든 적용 receipt를 `delivery.executed` audit event로 기록
- Review Dashboard에 `delivery_receipt_ledger` stage와 receipt summary/action item 추가
- Review API에서 `/api/delivery-receipts`, `/api/delivery-receipt-events` route 제공

현재 구현:

- `npm run delivery:receipts`
- `src/delivery-receipts.mjs`
- `schemas/delivery-receipt-ledger.schema.json`
- `docs/delivery-receipts.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- receipt 미입력 상태에서는 template만 생성되고 delivered patch가 생성되지 않음
- filled receipt 입력 시 delivered delivery/output patch와 audit event가 생성됨
- delivery receipt ledger가 schema validation을 통과함
- `/api/delivery-receipts?receipt_status=delivered`로 기록된 receipt를 조회할 수 있음
- `npm test`, `delivery:receipts`, `dashboard:build`, `api:smoke`가 통과함

## Phase 25: Post-Delivery Reconciliation

목표: receipt가 반영된 delivery/output 상태를 matter/project 관점으로 다시 합산하고, 아직 닫히지 않은 receipt를 운영 view에 노출합니다.

- Delivery Receipt Ledger의 applied/pending receipt를 읽음
- receipt-patched delivery queue와 output catalog를 함께 읽어 delivered/ready/blocked 상태를 재계산함
- matter/project별 `reconciled_matters`와 delivered output artifact 목록 생성
- outstanding receipt를 별도 collection으로 남겨 후속 수동 처리 대상을 명확히 함
- Review Dashboard에 `post_delivery_reconciliation` stage와 post-delivery summary/action item 추가
- Review API에서 `/api/post-delivery-matters`, `/api/delivered-artifacts`, `/api/outstanding-receipts` route 제공

현재 구현:

- `npm run delivery:reconcile`
- `src/post-delivery-reconciliation.mjs`
- `schemas/post-delivery-reconciliation.schema.json`
- `docs/post-delivery-reconciliation.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- receipt-patched output catalog의 delivered artifact가 `delivered_artifacts`로 노출됨
- matter/project별 delivered, ready, awaiting receipt, blocked 상태가 재계산됨
- outstanding receipt가 dashboard action item과 `/api/outstanding-receipts`로 조회됨
- `post-delivery-reconciliation.json`이 schema validation을 통과함
- `npm test`, `delivery:reconcile`, `dashboard:build`, `api:smoke`가 통과함

## Phase 26: Delivery Closeout Queue

목표: post-delivery reconciliation의 outstanding receipt를 사람이 처리할 수 있는 closeout queue와 receipt input draft로 바꿉니다.

- outstanding receipt packet별 `closeout_items` 생성
- delivery execution packet의 manual checklist, candidate, artifact context 연결
- 사람이 채울 수 있는 `receipt_input_draft` 생성
- 어떤 항목도 자동 실행하지 않고 `protected_action`, `requires_manual_execution`, `auto_execute: false` 유지
- Review Dashboard에 `delivery_closeout_queue` stage와 closeout action item 추가
- Review API에서 `/api/delivery-closeout-items`, `/api/receipt-input-drafts` route 제공

현재 구현:

- `npm run delivery:closeout`
- `src/delivery-closeout-queue.mjs`
- `schemas/delivery-closeout-queue.schema.json`
- `docs/delivery-closeout-queue.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- outstanding receipt가 closeout item으로 정규화됨
- closeout item마다 artifact context, execution candidate, manual checklist, receipt form draft가 포함됨
- `receipt-input-draft.json`이 delivery receipt input 계약을 따른다
- `/api/delivery-closeout-items?status=awaiting_manual_execution`으로 수동 closeout 대상을 조회할 수 있음
- `npm test`, `delivery:closeout`, `dashboard:build`, `api:smoke`가 통과함

## Phase 27: Delivery Closeout Receipt Validation

목표: 사람이 채운 closeout receipt input을 `delivery:receipts`에 적용하기 전에 closeout packet과 artifact 기준으로 검증합니다.

- closeout queue와 receipt input draft를 함께 읽음
- pending, missing, invalid, ready-to-apply receipt를 분류
- closeout queue 밖의 packet receipt를 `unknown_packet`으로 차단
- delivered receipt에는 `executed_by`, `executed_at`, `delivery_reference`, artifact id 일치가 필요
- ready receipt만 `validated-receipts-to-apply.json`으로 분리
- Review Dashboard에 `closeout_receipt_validation` stage와 validation action item 추가
- Review API에서 `/api/closeout-receipt-validations`, `/api/closeout-receipt-errors`, `/api/validated-receipts-to-apply` route 제공

현재 구현:

- `npm run delivery:closeout:validate`
- `src/delivery-closeout-receipt-validation.mjs`
- `schemas/delivery-closeout-receipt-validation.schema.json`
- `docs/delivery-closeout-receipt-validation.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- pending receipt input은 pending으로 남고 delivered patch를 만들지 않음
- filled receipt input은 ready-to-apply로 분류되고 validated receipt input으로 분리됨
- invalid/unknown receipt는 receipt error와 dashboard action item으로 드러남
- `/api/closeout-receipt-validations?validation_status=ready_to_apply`로 검증 완료 receipt를 조회할 수 있음
- `npm test`, `delivery:closeout:validate`, `dashboard:build`, `api:smoke`가 통과함

## Phase 28: Delivery Closeout Receipt Application

목표: 검증 완료된 closeout receipt만 Delivery Receipt Ledger에 적용하고, 검증과 적용을 dashboard/API에서 분리해 추적합니다.

- closeout receipt validation artifact를 읽음
- validation error가 있으면 receipt 적용을 차단
- `ready_to_apply` receipt만 Delivery Receipt Ledger에 전달
- 적용 결과로 patched delivery queue, patched output catalog, audit event 생성
- ready receipt가 없으면 `nothing_to_apply` no-op artifact 생성
- Review Dashboard에 `closeout_receipt_application` stage와 application summary 추가
- Review API에서 `/api/closeout-receipt-applications`, `/api/closeout-applied-receipts` route 제공

현재 구현:

- `npm run delivery:closeout:apply`
- `src/delivery-closeout-receipt-application.mjs`
- `schemas/delivery-closeout-receipt-application.schema.json`
- `docs/delivery-closeout-receipt-application.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- validation error가 있는 receipt input은 적용되지 않음
- ready receipt만 applied receipt와 audit event로 기록됨
- 적용 결과가 Delivery Receipt Ledger schema를 통과함
- `/api/closeout-applied-receipts?receipt_status=delivered`로 적용된 closeout receipt를 조회할 수 있음
- `npm test`, `delivery:closeout:apply`, `dashboard:build`, `api:smoke`가 통과함

## Phase 29: Control Plane Pipeline Runner

목표: 이미 구현된 Control Plane 단계들을 안전한 순서로 실행하고, command 결과와 expected artifact check를 하나의 pipeline ledger로 남깁니다.

- Domain Pack, Output, Observability, Delivery, Matter, Approval, Closeout 단계를 순서대로 실행
- 각 단계의 command, exit code, stdout/stderr, duration, expected artifact 존재 여부를 기록
- 실패 후 계속 실행할지 또는 fail-fast로 멈출지 선택 가능
- 외부 발송/merge/ERP 반영 같은 protected action은 실행하지 않음
- Review Dashboard에 `control_plane_pipeline` stage와 실패 action item 추가
- Review API에서 `/api/pipeline-runs`, `/api/pipeline-steps` route 제공

현재 구현:

- `npm run control-plane:pipeline`
- `src/control-plane-pipeline.mjs`
- `schemas/control-plane-pipeline.schema.json`
- `docs/control-plane-pipeline.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- pipeline run이 단계별 command result와 artifact check를 기록함
- 실패 단계는 dashboard action item으로 표시됨
- `/api/pipeline-steps?status=passed`로 pipeline step 결과를 조회할 수 있음
- `npm test`, `control-plane:pipeline`, `dashboard:build`, `api:smoke`가 통과함

## Phase 30: Control Plane Health Report

목표: Review Dashboard와 Control Plane Pipeline을 종합해 현재 하네스의 운영 건강도를 단일 artifact로 판정합니다.

- dashboard artifact와 pipeline artifact availability 확인
- pipeline execution, dashboard overall status, blocking gate, approval backlog, action queue, closeout receipt 상태를 health check로 정규화
- `healthy`, `attention`, `blocked`, `incomplete` 중 하나로 overall health 판정
- Review Dashboard에 `control_plane_health` stage와 health action item 추가
- Review API에서 `/api/control-plane-health`, `/api/health-checks` route 제공

현재 구현:

- `npm run control-plane:health`
- `src/control-plane-health.mjs`
- `schemas/control-plane-health.schema.json`
- `docs/control-plane-health.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- health report가 dashboard와 pipeline 상태를 check별로 기록함
- blocker/attention check가 dashboard action item으로 표시됨
- `/api/health-checks?status=blocked`로 막힌 health check를 조회할 수 있음
- `npm test`, `control-plane:health`, `dashboard:build`, `api:smoke`가 통과함

## Phase 31: Control Plane Action Plan

목표: Control Plane Health와 Review Dashboard action queue를 사람이 처리 가능한 우선순위 실행 계획으로 정규화합니다.

- health check와 dashboard action item을 통합해 ordered plan item 생성
- 각 item에 priority, status, requires_human, protected_action, next_commands 기록
- protected delivery/merge/ERP 실행은 하지 않고 plan만 생성
- Review Dashboard에 `control_plane_action_plan` stage와 action plan summary 추가
- Review API에서 `/api/action-plans`, `/api/action-plan-items` route 제공

현재 구현:

- `npm run control-plane:plan`
- `src/control-plane-action-plan.mjs`
- `schemas/control-plane-action-plan.schema.json`
- `docs/control-plane-action-plan.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- health blocker와 dashboard action item이 plan item으로 정규화됨
- 사람 검토가 필요한 항목과 protected action이 별도 flag로 구분됨
- `/api/action-plan-items?requires_human=true`로 사람 처리 항목을 조회할 수 있음
- `npm test`, `control-plane:plan`, `dashboard:build`, `api:smoke`가 통과함

## Phase 32: Control Plane Work Packets

목표: Action Plan item을 protected action, human review, command rerun, investigation 단위의 운영 work packet으로 묶습니다.

- `control-plane-action-plan.json`을 읽어 packet type별 작업 묶음 생성
- protected action과 human review를 command rerun과 분리
- 각 packet에 checklist, next_commands, item mapping 기록
- Review Dashboard에 `control_plane_work_packets` stage와 packet summary 추가
- Review API에서 `/api/action-work-packets`, `/api/action-work-items` route 제공

현재 구현:

- `npm run control-plane:work-packets`
- `src/control-plane-work-packets.mjs`
- `schemas/control-plane-work-packets.schema.json`
- `docs/control-plane-work-packets.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- action plan item이 work packet과 work item으로 매핑됨
- protected action packet은 자동 실행되지 않고 checklist로만 표시됨
- `/api/action-work-packets?protected_action=true`로 보호 작업 묶음을 조회할 수 있음
- `npm test`, `control-plane:work-packets`, `dashboard:build`, `api:smoke`가 통과함

## Phase 33: Control Plane Work Packet Receipt Drafts

목표: Work Packet을 닫기 위해 사람이 기록해야 할 receipt 입력 계약을 생성합니다.

- `control-plane-work-packets.json`을 읽어 packet별 receipt requirement 생성
- protected action, human review, command rerun에 필요한 필드를 분리
- pending receipt input draft를 생성하되 packet을 자동 완료 처리하지 않음
- Review Dashboard에 `control_plane_work_packet_receipts` stage와 receipt summary 추가
- Review API에서 `/api/work-packet-receipt-requirements`, `/api/work-packet-receipt-drafts` route 제공

현재 구현:

- `npm run control-plane:work-receipts`
- `src/control-plane-work-packet-receipts.mjs`
- `schemas/control-plane-work-packet-receipt-drafts.schema.json`
- `docs/control-plane-work-packet-receipts.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- work packet별 receipt requirement와 pending receipt row가 생성됨
- protected action은 `protected_action_reference` 필드를 요구함
- `/api/work-packet-receipt-drafts?receipt_status=pending`으로 입력 초안을 조회할 수 있음
- `npm test`, `control-plane:work-receipts`, `dashboard:build`, `api:smoke`가 통과함

## Phase 34: Control Plane Work Packet Receipt Validation

목표: 사람이 채운 work packet receipt input을 적용 전 gate로 검증합니다.

- receipt requirement와 receipt input을 대조해 validation item 생성
- pending receipt는 대기 상태로 두고, resolved/deferred/cancelled/failed만 적용 후보로 분리
- human/protected/command packet별 필수 필드를 검증
- Review Dashboard에 `control_plane_work_packet_receipt_validation` stage와 validation summary 추가
- Review API에서 `/api/work-packet-receipt-validations`, `/api/work-packet-receipt-errors`, `/api/validated-work-packet-receipts` route 제공

현재 구현:

- `npm run control-plane:work-receipts:validate`
- `src/control-plane-work-packet-receipt-validation.mjs`
- `schemas/control-plane-work-packet-receipt-validation.schema.json`
- `docs/control-plane-work-packet-receipt-validation.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- pending receipt가 오류 없이 pending validation item으로 기록됨
- invalid receipt는 error와 함께 apply 대상에서 제외됨
- `/api/work-packet-receipt-validations?validation_status=pending_receipt`로 대기 receipt를 조회할 수 있음
- `npm test`, `control-plane:work-receipts:validate`, `dashboard:build`, `api:smoke`가 통과함

## Phase 35: Control Plane Work Packet Receipt Application

목표: validation을 통과한 work packet receipt만 실제 work packet closure patch와 audit event로 적용합니다.

- `control-plane-work-packet-receipt-validation.json`의 `validated_receipts_to_apply`만 적용
- validation error, missing validation, missing work packet artifact가 있으면 적용 차단
- pending receipt만 있는 경우 `nothing_to_apply` no-op artifact를 남김
- 적용된 receipt는 patched work packet/work item과 `work_packet.receipt.applied` audit event로 기록
- Review Dashboard에 `control_plane_work_packet_receipt_application` stage와 application summary 추가
- Review API에서 `/api/work-packet-receipt-applications`, `/api/applied-work-packet-receipts` route 제공

현재 구현:

- `npm run control-plane:work-receipts:apply`
- `src/control-plane-work-packet-receipt-application.mjs`
- `schemas/control-plane-work-packet-receipt-application.schema.json`
- `docs/control-plane-work-packet-receipt-application.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- validation 완료 receipt만 적용되고 pending receipt는 packet 상태를 바꾸지 않음
- no-op 상황도 application artifact와 summary로 재현 가능함
- `/api/work-packet-receipt-applications?application_status=nothing_to_apply`로 적용 상태를 조회할 수 있음
- `npm test`, `control-plane:work-receipts:apply`, `dashboard:build`, `api:smoke`가 통과함

## Phase 36: Control Plane Loop

목표: heartbeat에서 반복하던 전체 운영 검증 루프를 하나의 재현 가능한 ledger 명령으로 고정합니다.

- pipeline, dashboard, health, action plan, work packet, receipt draft, receipt validation, receipt application, API smoke를 순서대로 실행
- 각 단계의 command, exit code, stdout/stderr, duration, expected artifact check를 기록
- 실패 후 계속 실행할지 또는 fail-fast로 멈출지 선택 가능
- loop artifact를 진행 중에도 갱신해 dashboard가 현재 loop 상태를 읽을 수 있게 함
- Review Dashboard에 `control_plane_loop` stage와 loop summary 추가
- Review API에서 `/api/control-plane-loops`, `/api/control-plane-loop-steps` route 제공

현재 구현:

- `npm run control-plane:loop`
- `src/control-plane-loop.mjs`
- `schemas/control-plane-loop.schema.json`
- `docs/control-plane-loop.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- heartbeat 운영 루프가 단일 명령과 artifact로 재현 가능함
- loop step 실패나 missing artifact가 dashboard action item으로 표시됨
- `/api/control-plane-loop-steps?status=passed`로 루프 단계 결과를 조회할 수 있음
- `npm test`, `npm run validate`, `npm run control-plane:loop`가 통과함

## Phase 37: Control Plane Goal Checkpoint

목표: `/goal`의 완성 기준을 machine-readable checkpoint로 고정해 heartbeat가 다음 작업을 기억이 아니라 artifact 기준으로 선택하게 합니다.

- dashboard, loop, health, package scripts, roadmap을 읽어 goal item별 구현 상태를 산출
- Core contracts, domain packs, resource/evidence, approval, law-firm, personal-dev, creative-document, observability, matter cockpit, loop, API를 checkpoint item으로 추적
- `passed`, `attention`, `blocked`, `missing` item을 요약하고 `next_focus`를 기록
- Review Dashboard에 `control_plane_goal_checkpoint` stage와 goal summary 추가
- Review API에서 `/api/goal-checkpoints`, `/api/goal-checkpoint-items` route 제공
- Control Plane Loop에 pre-checkpoint dashboard → checkpoint → final dashboard → API smoke 순서를 편입

현재 구현:

- `npm run control-plane:goal-checkpoint`
- `src/control-plane-goal-checkpoint.mjs`
- `schemas/control-plane-goal-checkpoint.schema.json`
- `docs/control-plane-goal-checkpoint.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- goal checkpoint가 dashboard/loop/health/roadmap/package script 상태를 한 artifact로 재현함
- dashboard에서 goal checkpoint stage와 summary count를 볼 수 있음
- `/api/goal-checkpoint-items?status=passed`로 checkpoint item을 조회할 수 있음
- `npm test`, `npm run validate`, `npm run control-plane:goal-checkpoint`, `npm run control-plane:loop`, `npm run api:smoke`가 통과함

## Phase 38: Outlook EML Resource Extraction

목표: Resource Expansion에서 Outlook `.eml` 파일이 unsupported quarantine으로 빠지지 않고 Resource/Evidence lineage에 들어오도록 합니다.

- Resource Audit이 `.eml`을 `email` resource type과 `outlook_eml` extractor family로 분류
- Resource Extraction이 기존 Outlook EML parser를 재사용해 subject/body/date/author를 normalized text 후보로 추출
- `.eml`에서 email reply capability signal을 감지
- Resource Expansion의 unsupported quarantine을 실제 extractor 추가로 줄임

현재 구현:

- `src/resource-audit.mjs`
- `src/resource-extract.mjs`
- `src/outlook-parser.mjs`
- `docs/resource-expansion-job.md`
- `test/matter-harness.test.mjs`

완료 기준:

- `examples/outlook-alpha-email.eml`이 `outlook_eml_probe`로 추출됨
- `.eml` 파일이 Resource Expansion에서 `quarantined`가 아니라 `extracted`가 됨
- resource expansion, ingest, evidence viewer, dashboard, goal checkpoint가 새 상태를 반영함
- `npm test`, `npm run validate`, `npm run resource:expand`, `npm run resource:ingest`, `npm run evidence:viewer`, `npm run control-plane:goal-checkpoint`, `npm run control-plane:loop`가 통과함

## Phase 39: Evidence Review Draft

목표: Evidence Viewer의 `needs_review` 항목을 사람이 바로 검토할 수 있는 decision draft와 API surface로 전환합니다.

- Approval Queue의 `evidence_review` item을 `evidence-review-draft.v1` ledger로 변환
- classification별 review policy를 기록하고 P2 이상은 attorney review required로 유지
- `approval-decisions.v1` 호환 draft를 생성하되 기본값은 protected data를 자동 승인하지 않음
- Review Dashboard에 `evidence_review_draft` stage와 summary 추가
- Review API에서 `/api/evidence-review-drafts`, `/api/evidence-review-items` route 제공
- Control Plane Loop에 `npm run evidence:review:draft`를 포함

현재 구현:

- `npm run evidence:review:draft`
- `src/evidence-review-draft.mjs`
- `schemas/evidence-review-draft.schema.json`
- `docs/evidence-review-draft.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- evidence review draft가 queue item과 evidence id를 보존함
- P1 internal과 P2+ 자료의 suggested decision이 분리됨
- 생성된 `approval-decisions.draft.json`을 사람이 검토 후 `approval:apply`에 넘길 수 있음
- `/api/evidence-review-items?review_status=ready_for_review`로 검토 대상을 조회할 수 있음
- `npm test`, `npm run validate`, `npm run evidence:review:draft`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 40: Control Plane Loop Finalization

목표: `control-plane:loop`가 모든 step을 끝낸 뒤 dashboard와 goal checkpoint가 최종 loop artifact를 다시 읽도록 동기화합니다.

- loop step 실행과 최종 artifact 저장을 먼저 완료
- post-loop finalization에서 goal checkpoint, dashboard, API smoke를 한 번 더 실행
- finalization 결과를 `control-plane-loop-finalization.v1` ledger로 저장
- `--no-finalize` 옵션으로 finalization을 끌 수 있게 유지

현재 구현:

- `src/control-plane-loop.mjs`
- `schemas/control-plane-loop-finalization.schema.json`
- `docs/control-plane-loop.md`

완료 기준:

- `npm run control-plane:loop` 후 dashboard의 loop summary가 최종 loop step count를 반영함
- finalization ledger schema validation이 통과함
- `npm test`, `npm run validate`, `npm run control-plane:loop`, `npm run api:smoke`가 통과함

## Phase 41: Gate-Aware Goal Checkpoint

목표: goal checkpoint가 구현 완료 여부와 운영상 사람 승인 대기를 분리하도록 합니다.

- Evidence review, approval inbox, attorney approval, merge approval, protected delivery blocker를 구현 실패로 보지 않음
- gate가 의도대로 생성된 stage는 `passed_with_operational_gate`로 표시
- 실제 사람 승인, 발송, merge, delivery는 dashboard/action plan blocker로 계속 유지
- checkpoint item에 `implementation_status`, `operational_status`, `acceptance_profile`을 기록

현재 구현:

- `src/control-plane-goal-checkpoint.mjs`
- `schemas/control-plane-goal-checkpoint.schema.json`
- `docs/control-plane-goal-checkpoint.md`

완료 기준:

- evidence viewer가 review queue를 생성한 경우 goal checkpoint에서 구현 통과로 인정됨
- 사람 승인 대기는 dashboard/action plan의 operational blocker로 남음
- `npm test`, `npm run validate`, `npm run control-plane:goal-checkpoint`, `npm run control-plane:loop`, `npm run api:smoke`가 통과함

## Phase 42: Evidence Decision Human Gate Classification

목표: Action Plan이 evidence 승인/반려/재추출/사건배정 판단을 자동 실행 후보로 분류하지 않도록 합니다.

- `approve_evidence`, `reject_evidence`, `request_reextract`, `assign_matter`를 human action으로 분류
- output review, citation review, PR/deck review 같은 승인성 action도 human action으로 분류
- evidence review queue item은 `ready_to_run`이 아니라 `waiting_for_human` 상태로 유지
- protected action은 계속 `blocked`, 단순 재실행 command만 `ready_to_run`으로 남김

현재 구현:

- `src/control-plane-action-plan.mjs`
- `docs/control-plane-action-plan.md`

완료 기준:

- evidence approval queue item의 Action Plan status가 `waiting_for_human`으로 기록됨
- `npm test`, `npm run validate`, `npm run control-plane:plan`, `npm run control-plane:loop`, `npm run api:smoke`가 통과함

## Phase 43: Control Plane Human Gate Briefing

목표: 남은 operational blocker를 자동 실행하지 않고 사람이 처리할 수 있는 하나의 gate agenda로 묶습니다.

- Action Plan의 human/protected/blocked item을 `control-plane-human-gates.v1`로 변환
- evidence decision, approval request, attorney review, merge review, content review, protected delivery, closeout receipt를 gate type으로 분류
- 모든 gate item에 `auto_execute_allowed: false`와 필요한 actor/receipt 여부를 기록
- Review Dashboard와 Review API에서 human gate artifact와 item을 조회 가능하게 함
- Control Plane Loop에 `npm run control-plane:human-gates`를 포함

현재 구현:

- `npm run control-plane:human-gates`
- `src/control-plane-human-gates.mjs`
- `schemas/control-plane-human-gates.schema.json`
- `docs/control-plane-human-gates.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- evidence decision과 protected delivery가 자동 실행 후보가 아니라 human gate agenda로 표시됨
- `/api/human-gate-items?gate_type=evidence_decision`으로 evidence decision gate를 조회할 수 있음
- `npm test`, `npm run validate`, `npm run control-plane:human-gates`, `npm run control-plane:loop`, `npm run api:smoke`가 통과함

## Phase 44: Control Plane Human Gate Receipt Drafts

목표: Human Gate agenda를 사람이 기록할 수 있는 receipt 입력 계약으로 변환합니다.

- `control-plane-human-gates.v1`의 gate item을 `control-plane-human-gate-receipt-drafts.v1`로 변환
- evidence decision, attorney review, merge review, protected delivery별 allowed outcome과 필수 receipt 필드 기록
- 모든 receipt row를 기본 `pending`으로 생성하고, 어떠한 protected action도 자동 실행하지 않음
- Review Dashboard와 Review API에서 human gate receipt artifact, requirement, draft row를 조회 가능하게 함
- Control Plane Loop에 `npm run control-plane:human-gate-receipts`를 포함

현재 구현:

- `npm run control-plane:human-gate-receipts`
- `src/control-plane-human-gate-receipts.mjs`
- `schemas/control-plane-human-gate-receipts.schema.json`
- `docs/control-plane-human-gate-receipts.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- human gate item 수만큼 pending receipt draft가 생성됨
- evidence decision gate가 `/api/human-gate-receipt-requirements?gate_type=evidence_decision`으로 조회됨
- Dashboard summary가 human gate receipt draft/protected/evidence decision 수를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:human-gate-receipts`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 45: Control Plane Human Gate Receipt Validation

목표: 사람이 채운 Human Gate receipt를 적용하기 전에 contract와 allowed outcome 기준으로 검증합니다.

- `control-plane-human-gate-receipt-drafts.v1`와 receipt input을 비교해 gate별 validation item 생성
- pending/missing/invalid/unknown/ready 상태를 분리하고 pending은 적용 대상으로 보지 않음
- evidence decision, protected delivery, merge review 등 gate type별 allowed outcome을 검사
- 검증 완료 receipt만 `validated-human-gate-receipts.json`으로 분리하되 protected action은 실행하지 않음
- Review Dashboard와 Review API에서 validation item, error, validated receipt를 조회 가능하게 함
- Control Plane Loop에 `npm run control-plane:human-gate-receipts:validate`를 포함

현재 구현:

- `npm run control-plane:human-gate-receipts:validate`
- `src/control-plane-human-gate-receipt-validation.mjs`
- `schemas/control-plane-human-gate-receipt-validation.schema.json`
- `docs/control-plane-human-gate-receipt-validation.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- 기본 pending receipt draft는 validation에서 `pending_receipts`로 남고 적용 대상이 0개임
- 사람이 채운 valid receipt는 `ready_to_apply`로 분리됨
- `/api/human-gate-receipt-validations?validation_status=pending_receipt`와 `/api/validated-human-gate-receipts`가 동작함
- Dashboard summary가 human gate receipt validation ready/pending/error 수를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:human-gate-receipts:validate`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 46: Control Plane Human Gate Receipt Application

목표: validation gate를 통과한 Human Gate receipt만 gate ledger에 반영하고 audit event를 남깁니다.

- `control-plane-human-gate-receipt-validation.v1`의 검증 완료 receipt와 `control-plane-human-gates.v1`의 gate item을 조합
- pending receipt는 아무 상태도 바꾸지 않고 `nothing_to_apply`로 기록
- 적용된 receipt는 patched human gate item과 `human_gate.receipt.applied` audit event로 기록
- evidence decision과 protected action 적용 count를 dashboard summary에 노출
- protected action은 실행하지 않고 `protected_actions_executed: false`를 계약으로 고정
- Review Dashboard에 `control_plane_human_gate_receipt_application` stage와 application summary 추가
- Review API에서 `/api/human-gate-receipt-applications`, `/api/applied-human-gate-receipts`, `/api/patched-human-gate-items` route 제공
- Control Plane Loop에 `npm run control-plane:human-gate-receipts:apply` 포함

현재 구현:

- `npm run control-plane:human-gate-receipts:apply`
- `src/control-plane-human-gate-receipt-application.mjs`
- `schemas/control-plane-human-gate-receipt-application.schema.json`
- `docs/control-plane-human-gate-receipt-application.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- validation 완료 receipt만 적용되고 pending receipt는 gate 상태를 바꾸지 않음
- 적용 단계는 protected action을 실행하지 않고 audit event만 생성함
- `/api/human-gate-receipt-applications?application_status=nothing_to_apply`로 적용 상태를 조회할 수 있음
- `npm test`, `npm run validate`, `npm run control-plane:human-gate-receipts:apply`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 47: Control Plane Audit Trail

목표: approval, delivery, human gate, work packet application에 흩어진 audit event를 하나의 읽기 전용 audit trail로 정규화합니다.

- Approval Decisions, Approval Inbox Decisions, Delivery Receipt Ledger, Closeout Receipt Application, Human Gate Receipt Application, Work Packet Receipt Application의 `audit_events` 수집
- actor, subject, tenant, correlation, event type, protected action 여부를 공통 `control-plane-audit-event.v1`로 정규화
- raw event id가 같은 event는 중복 제거하고 `duplicate_events`로 기록
- `delivery.executed`는 protected action executed event로 표시하되 별도 action은 실행하지 않음
- Review Dashboard에 `control_plane_audit_trail` stage와 audit summary 추가
- Review API에서 `/api/audit-trails`, `/api/audit-events`, `/api/audit-sources` route 제공
- Control Plane Pipeline과 Loop에 `npm run control-plane:audit-trail` 포함
- Goal Checkpoint에서 Audit Trail을 별도 item으로 추적

현재 구현:

- `npm run control-plane:audit-trail`
- `src/control-plane-audit-trail.mjs`
- `schemas/control-plane-audit-trail.schema.json`
- `docs/control-plane-audit-trail.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- audit trail artifact가 schema validation을 통과함
- delivery/approval/human-gate/work-packet audit event를 source별로 조회할 수 있음
- `/api/audit-events?event_type=delivery.executed`로 protected delivery trace를 조회할 수 있음
- Dashboard summary가 audit event/source/protected-action count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:audit-trail`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 48: Policy Matrix Catalog

목표: `examples/core/policy-matrix.json`을 Dashboard/API와 Control Plane Loop에서 조회 가능한 Identity/Policy 운영 artifact로 올립니다.

- `policy-matrix.v1`을 검증해 `policy-matrix-catalog.v1`로 정규화
- classification, runtime, model, tool, output, gate rule을 별도 collection으로 노출
- 외부 모델 금지/승인 필요, approval-required tool/output, blocking gate count를 summary로 제공
- policy validation error를 dashboard action item으로 전환
- Review Dashboard에 `policy_matrix_catalog` stage와 policy summary 추가
- Review API에서 `/api/policy-matrices`, `/api/policy-classifications`, `/api/runtime-policies`, `/api/model-policies`, `/api/tool-policies`, `/api/output-policies`, `/api/gate-policies` route 제공
- Control Plane Pipeline과 Loop에 `npm run policy:catalog` 포함
- Goal Checkpoint에서 Identity/Policy matrix를 별도 item으로 추적

현재 구현:

- `npm run policy:catalog`
- `src/policy-matrix-catalog.mjs`
- `schemas/policy-matrix-catalog.schema.json`
- `docs/policy-matrix-catalog.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- policy matrix catalog artifact가 schema validation을 통과함
- `/api/model-policies?classification=P3_PRIVILEGED`로 privileged 외부모델 금지 정책을 조회할 수 있음
- `/api/tool-policies?default_policy=approval_required`와 `/api/gate-policies?blocking_by_default=true`가 동작함
- Dashboard summary가 classification/gate/external-model restriction/validation error count를 반영함
- `npm test`, `npm run validate`, `npm run policy:catalog`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 49: Policy Snapshot Ledger

목표: 각 slice의 `policy-snapshot.v1`과 workflow/event/run ledger reference를 하나의 실행 재현성 ledger로 정규화합니다.

- Law Firm, Personal Dev, Creative Document, First Vertical Slice의 `identity_policy.policy_snapshots` 수집
- 같은 `policy_snapshot_id`가 동일한 rule body를 갖는지 conflict 검사
- workflow run, event, run ledger의 `policy_snapshot_id` reference를 usage record로 정규화
- Policy Matrix Catalog와 snapshot의 default classification, external model policy, runtime permission을 대조
- forbidden runtime 허용, 외부 모델 정책 불일치, 선언되지 않은 snapshot reference를 validation error로 기록
- Review Dashboard에 `policy_snapshot_ledger` stage와 snapshot/usage/violation summary 추가
- Review API에서 `/api/policy-snapshot-ledgers`, `/api/policy-snapshots`, `/api/policy-snapshot-instances`, `/api/policy-decisions`, `/api/policy-usages` route 제공
- Control Plane Pipeline과 Loop에 `npm run policy:snapshots` 포함
- Goal Checkpoint에서 Policy Snapshot Ledger를 별도 item으로 추적

현재 구현:

- `npm run policy:snapshots`
- `src/policy-snapshot-ledger.mjs`
- `schemas/policy-snapshot-ledger.schema.json`
- `docs/policy-snapshot-ledger.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- policy snapshot ledger artifact가 schema validation을 통과함
- `/api/policy-snapshots?policy_snapshot_id=policy.default.law_firm.v1`로 law-firm snapshot을 조회할 수 있음
- `/api/policy-decisions?classification=P2_CLIENT_CONFIDENTIAL`로 P2 외부모델 승인 필요 정책을 조회할 수 있음
- `/api/policy-usages?usage_type=workflow_run`으로 workflow별 snapshot reference를 조회할 수 있음
- Dashboard summary가 snapshot, workflow usage, event reference, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run policy:snapshots`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 50: Context Packet Ledger

목표: 각 workflow/agent run에 전달 가능한 context를 capability, runtime, matter boundary, policy snapshot 기준으로 컴파일하고 검증합니다.

- Domain Pack Registry의 capability manifest와 Runtime Adapter Registry의 input/data access contract를 교차 확인
- workflow input resource와 matter/client/wall/classification을 기준으로 retrieval filter 생성
- raw/redacted context mode를 classification, runtime, redaction policy로 결정
- 로펌 P2 context는 redaction-required packet으로 표시하고 prompt injection handling을 `treat_untrusted_content_as_data`로 추적
- Claude Code/Codex packet은 capability가 허용한 runtime인지 확인하고 worktree 개발 context를 최소화
- Review Dashboard에 `context_packet_ledger` stage와 packet/item/filter summary 추가
- Review API에서 `/api/context-packet-ledgers`, `/api/context-packets`, `/api/context-items`, `/api/context-retrieval-filters` route 제공
- Control Plane Pipeline과 Loop에 `npm run context:packets` 포함
- Goal Checkpoint에서 Context Builder와 Retrieval Filter를 별도 item으로 추적

현재 구현:

- `npm run context:packets`
- `src/context-packet-ledger.mjs`
- `schemas/context-packet-ledger.schema.json`
- `docs/context-packet-ledger.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- context packet ledger artifact가 schema validation을 통과함
- blocked packet, missing retrieval filter, runtime mismatch, classification block이 validation/action item으로 드러남
- `/api/context-packets?runtime_id=codex`와 `/api/context-packets?context_mode=redacted`로 runtime/redaction 상태를 조회할 수 있음
- Dashboard summary가 context packet, context item, retrieval filter, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run context:packets`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 51: Model Routing Ledger

목표: Context Packet을 실제 runtime/model/provider boundary로 보내기 전에 classification, policy snapshot, runtime adapter, redaction 상태를 기준으로 routing decision을 별도 ledger로 남깁니다.

- Context Packet Ledger의 packet별 runtime, capability, matter/classification 정보를 입력으로 사용
- Policy Matrix Catalog와 Policy Snapshot Ledger의 model/runtime/redaction policy를 대조
- Runtime Adapter Registry의 external execution 여부로 external transfer와 provider boundary를 판정
- 외부 전송 금지, required redaction 누락, forbidden/unlisted runtime을 blocked route validation error로 기록
- 승인 필요 model policy와 restricted runtime을 approval-required route로 표시
- Review Dashboard에 `model_routing_ledger` stage와 route/external-transfer/redaction summary 추가
- Review API에서 `/api/model-routing-ledgers`, `/api/model-routing-decisions` route 제공
- Control Plane Pipeline과 Loop에 `npm run model:routing` 포함
- Goal Checkpoint에서 Model Routing과 외부전송 결정을 별도 item으로 추적

현재 구현:

- `npm run model:routing`
- `src/model-routing-ledger.mjs`
- `schemas/model-routing-ledger.schema.json`
- `docs/model-routing-ledger.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- model routing ledger artifact가 schema validation을 통과함
- `/api/model-routing-decisions?runtime_id=codex`로 Codex external allowed-with-audit route를 조회할 수 있음
- `/api/model-routing-decisions?external_transfer=true`로 외부 runtime 전송 결정을 조회할 수 있음
- Dashboard summary가 route, external transfer, redaction, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run model:routing`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 52: Cost Budget Ledger

목표: Model Routing Ledger의 route decision을 capability별 `cost_policy`, Observability cost records, Policy Matrix의 `cost_budget_gate`와 대조해 실행 전 비용 통제 ledger로 고정합니다.

- Domain Pack Registry의 capability manifest를 읽어 `max_usd`, token tracking 요구를 수집
- Model Routing Ledger의 routing decision마다 cost budget decision 생성
- Observability Catalog의 cost records에서 observed USD와 runtime seconds를 연결
- missing cost policy, budget exceeded, missing cost gate를 blocked validation error로 기록
- token record가 아직 없는 상태는 `pending_records`로 표시하되 비용 gate 실패로 보지 않음
- Review Dashboard에 `cost_budget_ledger` stage와 budget/token/runtime summary 추가
- Review API에서 `/api/cost-budget-ledgers`, `/api/cost-budget-decisions` route 제공
- Control Plane Pipeline과 Loop에 `npm run cost:budgets` 포함
- Goal Checkpoint에서 Cost Budget Gate Ledger를 별도 item으로 추적

현재 구현:

- `npm run cost:budgets`
- `src/cost-budget-ledger.mjs`
- `schemas/cost-budget-ledger.schema.json`
- `docs/cost-budget-ledger.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- cost budget ledger artifact가 schema validation을 통과함
- `/api/cost-budget-decisions?budget_status=passed`로 예산 gate 통과 route를 조회할 수 있음
- `/api/cost-budget-decisions?token_tracking_status=pending_records`로 남은 token 계측 과제를 조회할 수 있음
- Dashboard summary가 budget decision, max/observed cost, token tracking, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run cost:budgets`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 53: Token Usage Ledger

목표: Cost Budget Ledger의 token tracking pending 상태를 별도 token usage ledger로 정규화하고, 실제 token cost record가 없을 때는 context packet 기준 deterministic estimate를 남깁니다.

- Cost Budget Ledger의 budget decision마다 token usage record 생성
- Context Packet Ledger의 context item preview, redaction mode, runtime baseline으로 input/output token estimate 생성
- Observability Catalog에 provider token cost record가 있으면 `recorded` 상태로 우선 반영
- token tracking required인데 context packet이 없거나 positive token count가 없으면 validation error로 기록
- Review Dashboard에 `token_usage_ledger` stage와 recorded/estimated/total token summary 추가
- Review API에서 `/api/token-usage-ledgers`, `/api/token-usage-records` route 제공
- Control Plane Pipeline과 Loop에 `npm run token:usage` 포함
- Goal Checkpoint에서 Token Usage Ledger를 별도 item으로 추적

현재 구현:

- `npm run token:usage`
- `src/token-usage-ledger.mjs`
- `schemas/token-usage-ledger.schema.json`
- `docs/token-usage-ledger.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- token usage ledger artifact가 schema validation을 통과함
- `/api/token-usage-records?tracking_status=estimated`로 estimate 기반 token usage를 조회할 수 있음
- `/api/token-usage-records?runtime_id=codex`로 Codex runtime token usage를 조회할 수 있음
- Dashboard summary가 token usage record, tracking required, estimated count, total token count, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run token:usage`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 54: Cost Attribution Ledger

목표: Cost Budget Ledger, Token Usage Ledger, Observability Catalog를 연결해 matter/runtime/capability/domain pack 기준 projected cost를 귀속합니다.

- budget decision마다 cost attribution record 생성
- observed USD가 있으면 우선 사용하고, 없으면 token usage와 deterministic `estimated_token_usd_per_1k`로 projected USD 계산
- budget remaining, over-budget, untracked cost 상태를 기록
- domain pack, runtime, capability, matter 기준 rollup 생성
- Review Dashboard에 `cost_attribution_ledger` stage와 projected/budget remaining summary 추가
- Review API에서 `/api/cost-attribution-ledgers`, `/api/cost-attribution-records` route 제공
- Control Plane Pipeline과 Loop에 `npm run cost:attribution` 포함
- Goal Checkpoint에서 Cost Attribution Ledger를 별도 item으로 추적

현재 구현:

- `npm run cost:attribution`
- `src/cost-attribution-ledger.mjs`
- `schemas/cost-attribution-ledger.schema.json`
- `docs/cost-attribution-ledger.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- cost attribution ledger artifact가 schema validation을 통과함
- `/api/cost-attribution-records?attribution_status=attributed`로 attribution record를 조회할 수 있음
- `/api/cost-attribution-records?runtime_id=codex`로 Codex runtime cost attribution을 조회할 수 있음
- Dashboard summary가 attribution record, projected USD, budget remaining, over-budget, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run cost:attribution`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 55: Budget Alert Ledger

목표: Cost Attribution Ledger의 projected cost와 budget remaining을 기준으로 warning/critical/unbudgeted 예산 경보를 정규화하고, Dashboard/API/Control Plane Loop가 바로 확인할 수 있게 한다.

- cost attribution record마다 budget alert record 생성
- 기본 warning threshold 80%, critical threshold 100%로 예산 사용률 계산
- critical 또는 unbudgeted alert는 validation error와 blocked stage로 기록
- warning alert는 pending stage와 action queue review 항목으로 기록
- Review Dashboard에 `budget_alert_ledger` stage와 active/critical/unbudgeted summary 추가
- Review API에서 `/api/budget-alert-ledgers`, `/api/budget-alert-records` route 제공
- Control Plane Pipeline과 Loop에 `npm run budget:alerts` 포함
- Goal Checkpoint에서 Budget Alert Ledger를 별도 item으로 추적

현재 구현:

- `npm run budget:alerts`
- `src/budget-alert-ledger.mjs`
- `schemas/budget-alert-ledger.schema.json`
- `docs/budget-alert-ledger.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- budget alert ledger artifact가 schema validation을 통과함
- `/api/budget-alert-records?alert_status=clear`로 정상 budget alert record를 조회할 수 있음
- `/api/budget-alert-records?runtime_id=codex`로 Codex runtime budget alert를 조회할 수 있음
- Dashboard summary가 alert record, active/critical/unbudgeted alert, human required, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run budget:alerts`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 56: Human Review Packet Ledger

목표: Control Plane Human Gates와 Human Gate Receipt Drafts를 사람이 검토하기 쉬운 packet 단위로 묶어, 승인·증거판단·protected delivery·merge review를 actor/gate type 기준으로 운영할 수 있게 한다.

- human gate item마다 receipt requirement와 receipt draft를 연결한 review item 생성
- required actor와 gate type 기준으로 review packet 생성
- protected action은 계속 manual/receipt-gated 상태로 유지하고 `auto_execute_allowed: false`를 강제
- missing receipt draft나 source 누락은 validation error로 기록
- Review Dashboard에 `human_review_packet_ledger` stage와 packet/item summary 추가
- Review API에서 `/api/human-review-packet-ledgers`, `/api/human-review-packets`, `/api/human-review-items` route 제공
- Control Plane Loop에 `npm run control-plane:review-packets` 포함
- Goal Checkpoint에서 Human Review Packet Ledger를 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-packets`
- `src/human-review-packet-ledger.mjs`
- `schemas/human-review-packet-ledger.schema.json`
- `docs/human-review-packet-ledger.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- human review packet ledger artifact가 schema validation을 통과함
- `/api/human-review-packets?required_actor=attorney_or_designated_reviewer`로 attorney review packet을 조회할 수 있음
- `/api/human-review-items?gate_type=evidence_decision`로 evidence decision review item을 조회할 수 있음
- Dashboard summary가 review packet, review item, pending packet, protected packet, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-packets`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 57: Human Review Agenda

목표: Human Review Packet Ledger를 required actor별 agenda와 receipt decision template로 정리해, 사람이 다음 결정을 어디서 어떻게 채워야 하는지 안전하게 볼 수 있게 한다.

- review packet마다 agenda item 생성
- required actor별 agenda section 생성
- review item마다 pending receipt decision template row 생성
- protected action은 agenda에서도 `auto_execute_allowed: false`와 manual receipt gate를 강제
- Review Dashboard에 `human_review_agenda` stage와 agenda/actor/decision row summary 추가
- Review API에서 `/api/human-review-agendas`, `/api/human-review-agenda-sections`, `/api/human-review-agenda-items`, `/api/human-review-decision-template` route 제공
- Control Plane Loop에 `npm run control-plane:review-agenda` 포함
- Goal Checkpoint에서 Human Review Agenda를 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-agenda`
- `src/human-review-agenda.mjs`
- `schemas/human-review-agenda.schema.json`
- `docs/human-review-agenda.md`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- human review agenda artifact가 schema validation을 통과함
- `/api/human-review-agenda-sections?required_actor=attorney_or_designated_reviewer`로 attorney agenda section을 조회할 수 있음
- `/api/human-review-agenda-items?agenda_status=pending_human_review`로 pending agenda item을 조회할 수 있음
- `/api/human-review-decision-template?receipt_status=pending`으로 사람이 채울 receipt row를 조회할 수 있음
- Dashboard summary가 agenda item, actor, decision row, protected action, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-agenda`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 58: Human Review Agenda Receipt Intake

목표: Human Review Agenda의 decision template을 기존 Human Gate Receipt Validation이 읽을 수 있는 표준 receipt input으로 변환한다.

- agenda decision template row와 human gate receipt requirement를 gate item 기준으로 매칭
- pending row는 pending receipt input으로 보존
- terminal receipt row는 validation 전에 기본 allowed outcome과 current receipt id를 점검
- protected action은 intake 단계에서도 실행하지 않고 `auto_execute_allowed: false`와 `protected_actions_executed: false`를 강제
- `receipt-input.json`을 `control-plane-human-gate-receipts-input.v1` 형태로 생성
- Control Plane Loop에서 human gate receipt validation이 agenda intake의 `receipt-input.json`을 읽도록 연결
- Review Dashboard에 `human_review_agenda_receipt_intake` stage와 pending/ready/error summary 추가
- Review API에서 `/api/human-review-agenda-receipt-intakes`, `/api/human-review-agenda-receipt-intake-items`, `/api/human-review-agenda-receipt-input` route 제공
- Goal Checkpoint에서 Human Review Agenda Receipt Intake를 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-agenda:intake`
- `src/human-review-agenda-receipt-intake.mjs`
- `schemas/human-review-agenda-receipt-intake.schema.json`
- `docs/human-review-agenda-receipt-intake.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- human review agenda receipt intake artifact가 schema validation을 통과함
- `/api/human-review-agenda-receipt-intake-items?intake_status=pending_receipt`로 pending intake item을 조회할 수 있음
- `/api/human-review-agenda-receipt-input?receipt_status=pending`으로 validation에 넘길 receipt row를 조회할 수 있음
- Dashboard summary가 intake item, receipt row, pending, ready, invalid, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-agenda:intake`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 59: Human Review Receipt Workspace

목표: Human Review Agenda Receipt Intake의 pending receipt row를 required actor별 편집 workspace로 나누어, 사람이 실제 결정을 안전하게 입력할 수 있게 한다.

- intake item을 required actor별 workspace entry로 그룹화
- actor별 `receipt-input.json`을 표준 `control-plane-human-gate-receipts-input.v1` subset으로 생성
- actor별 `review.md`에 receipt count, pending count, protected action count, validation-before-application 절차를 기록
- agenda decision template의 allowed outcome과 subject ref를 workspace entry에 보강
- protected action은 workspace 단계에서도 실행하지 않고 `auto_execute_allowed: false`와 `protected_actions_executed: false`를 강제
- Review Dashboard에 `human_review_receipt_workspace` stage와 actor/entry/receipt/editable file summary 추가
- Review API에서 `/api/human-review-receipt-workspaces`, `/api/human-review-actor-workspaces`, `/api/human-review-workspace-entries` route 제공
- Control Plane Loop에 `npm run control-plane:review-workspace` 포함
- Goal Checkpoint에서 Human Review Receipt Workspace를 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-workspace`
- `src/human-review-receipt-workspace.mjs`
- `schemas/human-review-receipt-workspace.schema.json`
- `docs/human-review-receipt-workspace.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- human review receipt workspace artifact가 schema validation을 통과함
- actor별 `actors/<required_actor>/receipt-input.json`과 `review.md`가 생성됨
- `/api/human-review-actor-workspaces?workspace_status=pending_human_review`로 actor별 workspace를 조회할 수 있음
- `/api/human-review-workspace-entries?receipt_status=pending`으로 pending workspace entry를 조회할 수 있음
- Dashboard summary가 actor workspace, workspace entry, receipt row, pending, editable file, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-workspace`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 60: Human Review Receipt Workspace Merge

목표: actor별 receipt workspace에서 사람이 수정한 `receipt-input.json`들을 다시 하나의 표준 receipt input으로 합쳐, 기존 Human Gate Receipt Validation에 넘길 수 있게 한다.

- actor별 `actors/<required_actor>/receipt-input.json`을 읽어 merge item 생성
- workspace entry 기준으로 receipt id, gate item, source plan item, required actor 일치 여부 확인
- 누락 receipt, 중복 receipt, unknown receipt, actor mismatch를 merge validation error로 기록
- pending receipt는 그대로 pending으로 보존하고 terminal receipt는 validation 대상으로 전달
- protected action은 merge 단계에서도 실행하지 않고 `auto_execute_allowed: false`와 `protected_actions_executed: false`를 강제
- `receipt-input.json`을 `control-plane-human-gate-receipts-input.v1` 형태로 재생성
- Control Plane Loop에서 human gate receipt validation이 workspace merge의 `receipt-input.json`을 읽도록 연결
- Review Dashboard에 `human_review_receipt_workspace_merge` stage와 actor input/merge row/pending/ready/error summary 추가
- Review API에서 `/api/human-review-receipt-workspace-merges`, `/api/human-review-receipt-merge-items`, `/api/human-review-merged-receipt-input` route 제공
- Goal Checkpoint에서 Human Review Receipt Workspace Merge를 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-workspace:merge`
- `src/human-review-receipt-workspace-merge.mjs`
- `schemas/human-review-receipt-workspace-merge.schema.json`
- `docs/human-review-receipt-workspace-merge.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- human review receipt workspace merge artifact가 schema validation을 통과함
- merged `receipt-input.json`이 actor별 receipt input row를 누락 없이 포함함
- `/api/human-review-receipt-merge-items?merge_status=pending_receipt`로 pending merge item을 조회할 수 있음
- `/api/human-review-merged-receipt-input?receipt_status=pending`으로 validation에 넘길 merged receipt row를 조회할 수 있음
- Dashboard summary가 actor input, merge item, receipt row, pending, ready, missing, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-workspace:merge`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 61: Human Review Context Bundle

목표: merged actor receipt input의 각 pending receipt에 대해 reviewer가 즉시 판단할 수 있는 gate/action/evidence/approval/matter context bundle을 생성한다.

- workspace merge item마다 context card 생성
- context card에 gate context, action-plan context, review contract, evidence context, approval context, matter context를 연결
- actor별 context bundle과 `actors/<required_actor>/context.md` 생성
- protected action은 context bundle 단계에서도 실행하지 않고 `auto_execute_allowed: false`와 `protected_actions_executed: false`를 강제
- Control Plane Loop에서 workspace merge 뒤, human gate receipt validation 전에 `npm run control-plane:review-context` 실행
- Review Dashboard에 `human_review_context_bundle` stage와 actor/card/evidence/approval/matter/error summary 추가
- Review API에서 `/api/human-review-context-bundles`, `/api/human-review-context-cards`, `/api/human-review-actor-context-bundles` route 제공
- Goal Checkpoint에서 Human Review Context Bundle을 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-context`
- `src/human-review-context-bundle.mjs`
- `schemas/human-review-context-bundle.schema.json`
- `docs/human-review-context-bundle.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- human review context bundle artifact가 schema validation을 통과함
- context card count가 workspace merge item count와 일치함
- `/api/human-review-context-cards?context_status=ready`로 ready context card를 조회할 수 있음
- `/api/human-review-actor-context-bundles?required_actor=attorney_or_designated_reviewer`로 actor별 context bundle을 조회할 수 있음
- Dashboard summary가 actor context bundle, context card, evidence context, approval context, matter context, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-context`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 62: Human Review Decision Register

목표: Human Review Context Bundle의 context card를 사람이 실제 receipt 결정을 입력할 수 있는 context-bound decision register로 변환한다.

- context card마다 decision row 생성
- decision row에 receipt id, gate item, source plan item, required actor, allowed outcomes, required receipt fields, context summary를 연결
- actor별 decision register와 actor별 receipt input subset 생성
- 전체 `receipt-input.json`을 `control-plane-human-gate-receipts-input.v1` 형태로 생성
- protected action은 decision register 단계에서도 실행하지 않고 `auto_execute_allowed: false`와 `protected_actions_executed: false`를 강제
- Control Plane Loop에서 context bundle 뒤, human gate receipt validation 전에 `npm run control-plane:review-decisions` 실행
- Human Gate Receipt Validation은 decision register의 `receipt-input.json`을 읽도록 연결
- Review Dashboard에 `human_review_decision_register` stage와 actor/decision/receipt/pending/error summary 추가
- Review API에서 `/api/human-review-decision-registers`, `/api/human-review-decision-rows`, `/api/human-review-decision-receipt-input` route 제공
- Goal Checkpoint에서 Human Review Decision Register를 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-decisions`
- `src/human-review-decision-register.mjs`
- `schemas/human-review-decision-register.schema.json`
- `docs/human-review-decision-register.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- human review decision register artifact가 schema validation을 통과함
- decision row count가 context card count와 일치함
- generated receipt input row count가 decision row count와 일치함
- `/api/human-review-decision-rows?decision_status=pending_decision`로 pending decision row를 조회할 수 있음
- `/api/human-review-decision-receipt-input?receipt_status=pending`으로 validation에 넘길 receipt row를 조회할 수 있음
- Dashboard summary가 actor decision register, decision row, receipt row, pending, ready, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-decisions`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 63: Human Review Decision Register Merge

목표: actor별 Human Review Decision Register receipt input을 사람이 수정한 뒤, 다시 하나의 검증용 receipt input으로 안전하게 병합한다.

- actor별 `actors/<required_actor>/receipt-input.json`을 읽어 현재 decision register의 `decision_rows`와 대조
- receipt id, gate item, source plan item, gate type, required actor, allowed outcome 불일치 감지
- duplicate, missing, unknown, invalid decision receipt를 validation error로 차단
- merged `receipt-input.json`을 `control-plane-human-gate-receipts-input.v1` 형태로 생성
- protected action은 merge 단계에서도 실행하지 않고 `auto_execute_allowed: false`와 `protected_actions_executed: false`를 강제
- Control Plane Loop에서 decision register 뒤, human gate receipt validation 전에 `npm run control-plane:review-decisions:merge` 실행
- Human Gate Receipt Validation은 decision register merge의 `receipt-input.json`을 읽도록 연결
- Review Dashboard에 `human_review_decision_register_merge` stage와 actor/receipt/pending/invalid/error summary 추가
- Review API에서 `/api/human-review-decision-register-merges`, `/api/human-review-decision-merge-items`, `/api/human-review-merged-decision-receipt-input` route 제공
- Goal Checkpoint에서 Human Review Decision Register Merge를 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-decisions:merge`
- `src/human-review-decision-register-merge.mjs`
- `schemas/human-review-decision-register-merge.schema.json`
- `docs/human-review-decision-register-merge.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- human review decision register merge artifact가 schema validation을 통과함
- merged receipt row count가 decision register receipt row count와 일치함
- duplicate, missing, unknown, invalid decision receipt count가 0임
- `/api/human-review-decision-merge-items?merge_status=pending_receipt`로 pending merge item을 조회할 수 있음
- `/api/human-review-merged-decision-receipt-input?receipt_status=pending`으로 validation에 넘길 merged receipt row를 조회할 수 있음
- Dashboard summary가 actor input, receipt row, pending, ready, missing, invalid, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-decisions:merge`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 64: Human Review Validation Feedback

목표: Human Gate Receipt Validation 결과를 actor별 feedback bundle로 되돌려 사람이 어떤 decision receipt input을 고쳐야 하는지 명확히 한다.

- decision register merge item과 human gate receipt validation item을 gate item 기준으로 연결
- pending, ready, invalid, missing, unknown validation 상태를 actor별 feedback item으로 변환
- actor별 `actors/<required_actor>/feedback.json`과 `feedback.md` 생성
- 각 feedback item에 next action, required receipt fields, validation errors, allowed outcomes를 연결
- protected action은 feedback 단계에서도 실행하지 않고 `auto_execute_allowed: false`와 `protected_actions_executed: false`를 강제
- Control Plane Loop에서 human gate receipt validation 뒤, receipt application 전에 `npm run control-plane:review-feedback` 실행
- Review Dashboard에 `human_review_validation_feedback` stage와 actor/item/pending/correction/error summary 추가
- Review API에서 `/api/human-review-validation-feedbacks`, `/api/human-review-feedback-items`, `/api/human-review-actor-feedback` route 제공
- Goal Checkpoint에서 Human Review Validation Feedback을 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-feedback`
- `src/human-review-validation-feedback.mjs`
- `schemas/human-review-validation-feedback.schema.json`
- `docs/human-review-validation-feedback.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- human review validation feedback artifact가 schema validation을 통과함
- feedback item count가 human gate receipt validation item count와 일치함
- actor feedback count가 decision register merge actor input count와 일치함
- pending validation item이 `needs_human_decision` feedback으로 actor에게 환류됨
- `/api/human-review-feedback-items?feedback_status=needs_human_decision`로 pending feedback item을 조회할 수 있음
- `/api/human-review-actor-feedback?required_actor=attorney_or_designated_reviewer`로 actor별 feedback bundle을 조회할 수 있음
- Dashboard summary가 actor feedback, feedback item, pending, ready, correction, missing validation, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-feedback`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 65: Human Review Correction Workspace

목표: Human Review Validation Feedback 중 사람이 다시 채워야 할 항목을 actor별 editable correction receipt input으로 변환한다.

- `needs_human_decision`, `needs_correction` feedback item만 correction item으로 추출
- actor별 `correction-workspace.json`, `receipt-input.json`, `corrections.md` 생성
- 각 correction item에 target receipt input path, required receipt fields, allowed outcomes, next actions 연결
- editable receipt input은 표준 `control-plane-human-gate-receipts-input.v1` 형식으로 생성
- protected action은 correction workspace 단계에서도 실행하지 않고 `auto_execute_allowed: false`와 `protected_actions_executed: false`를 강제
- Control Plane Loop에서 validation feedback 뒤, receipt application 전에 `npm run control-plane:review-corrections` 실행
- Review Dashboard에 `human_review_correction_workspace` stage와 actor/item/receipt/pending/correction/error summary 추가
- Review API에서 `/api/human-review-correction-workspaces`, `/api/human-review-correction-actors`, `/api/human-review-correction-items`, `/api/human-review-correction-receipt-input` route 제공
- Goal Checkpoint에서 Human Review Correction Workspace를 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-corrections`
- `src/human-review-correction-workspace.mjs`
- `schemas/human-review-correction-workspace.schema.json`
- `docs/human-review-correction-workspace.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- human review correction workspace artifact가 schema validation을 통과함
- correction item count가 validation feedback의 pending/correction item count와 일치함
- actor workspace count가 validation feedback actor count와 일치함
- actor별 `receipt-input.json`이 correction item만 포함함
- `/api/human-review-correction-items?correction_status=pending_decision`로 pending correction item을 조회할 수 있음
- `/api/human-review-correction-receipt-input?receipt_status=pending`으로 editable correction receipt row를 조회할 수 있음
- Dashboard summary가 actor workspace, correction item, receipt row, pending, correction, editable file, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-corrections`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 66: Human Review Correction Workspace Merge

목표: actor별 correction receipt input을 하나의 표준 human gate receipt input으로 병합해 validation loop에 다시 넣을 수 있게 한다.

- `Human Review Correction Workspace`의 actor별 `receipt-input.json`을 읽음
- correction item을 기대 목록으로 삼아 receipt id, actor, gate item, source plan item, gate type을 검증
- missing, duplicate, unknown, invalid correction receipt를 분리해 merge item status로 기록
- 병합된 `receipt-input.json`은 표준 `control-plane-human-gate-receipts-input.v1` 형식으로 생성
- protected action은 merge 단계에서도 실행하지 않고 `auto_execute_allowed: false`와 `protected_actions_executed: false`를 강제
- Control Plane Loop에서 correction workspace 뒤, receipt application 전에 `npm run control-plane:review-corrections:merge` 실행
- Review Dashboard에 `human_review_correction_workspace_merge` stage와 actor/receipt/pending/ready/error summary 추가
- Review API에서 `/api/human-review-correction-workspace-merges`, `/api/human-review-correction-merge-actors`, `/api/human-review-correction-merge-items`, `/api/human-review-merged-correction-receipt-input` route 제공
- Goal Checkpoint에서 Human Review Correction Workspace Merge를 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-corrections:merge`
- `src/human-review-correction-workspace-merge.mjs`
- `schemas/human-review-correction-workspace-merge.schema.json`
- `docs/human-review-correction-workspace-merge.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- human review correction workspace merge artifact가 schema validation을 통과함
- actor input count가 correction workspace actor count와 일치함
- merged receipt row count가 correction workspace correction item count와 일치함
- duplicate, missing, unknown, invalid correction receipt count가 0임
- `/api/human-review-correction-merge-items?merge_status=pending_receipt`로 pending correction merge item을 조회할 수 있음
- `/api/human-review-merged-correction-receipt-input?receipt_status=pending`으로 validation에 넘길 merged correction receipt row를 조회할 수 있음
- Dashboard summary가 actor input, receipt row, pending, ready, missing, invalid, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-corrections:merge`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 67: Human Review Correction Validation

목표: 병합된 correction receipt input을 표준 human gate receipt validation에 다시 투입해 feedback → correction → merge → validation 루프를 닫는다.

- `artifacts/human-review-correction-workspace-merge/latest/receipt-input.json`을 validation input으로 사용
- 기존 `control-plane-human-gate-receipt-validation.v1` 계약을 재사용해 별도 correction validation artifact 생성
- pending, ready, invalid, missing, unknown correction receipt 상태를 validation item으로 기록
- validated correction receipt는 `validated-human-gate-receipts.json`에 분리하되 application은 실행하지 않음
- Control Plane Loop에서 correction workspace merge 뒤, receipt application 전에 `npm run control-plane:review-corrections:validate` 실행
- Review Dashboard에 `human_review_correction_validation` stage와 item/receipt/pending/ready/error summary 추가
- Review API에서 `/api/human-review-correction-validations`, `/api/human-review-correction-validation-items`, `/api/human-review-correction-validation-errors`, `/api/validated-correction-human-gate-receipts` route 제공
- Goal Checkpoint에서 Human Review Correction Validation을 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-corrections:validate`
- `docs/human-review-correction-validation.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- correction validation artifact가 기존 human gate receipt validation schema를 통과함
- validation item count가 correction workspace merge receipt row count와 일치함
- pending correction receipt는 pending으로 유지되고 invalid, missing, unknown receipt count가 0임
- `/api/human-review-correction-validation-items?validation_status=pending_receipt`로 pending correction validation item을 조회할 수 있음
- `/api/validated-correction-human-gate-receipts`로 ready correction receipt를 조회할 수 있음
- Dashboard summary가 correction validation item, receipt, pending, ready, invalid, error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-corrections:validate`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 68: Human Review Correction Feedback

목표: correction validation 결과를 다시 actor별 feedback bundle로 환류해 feedback → correction → merge → validation → feedback 루프를 완성한다.

- `Human Review Correction Workspace Merge`와 `Human Review Correction Validation`을 입력으로 사용
- correction validation item을 merged correction receipt와 `gate_item_id` 기준으로 매칭
- pending, ready, invalid, missing, unknown 상태를 actor별 correction feedback item으로 변환
- actor별 `feedback.json`과 `feedback.md`를 생성해 다음 correction receipt 입력 작업 큐로 사용
- protected action은 feedback 단계에서도 실행하지 않고 `auto_execute_allowed: false`와 `protected_actions_executed: false`를 강제
- Control Plane Loop에서 correction validation 뒤, receipt application 전에 `npm run control-plane:review-corrections:feedback` 실행
- Review Dashboard에 `human_review_correction_feedback` stage와 actor/item/pending/ready/correction/error summary 추가
- Review API에서 `/api/human-review-correction-feedbacks`, `/api/human-review-correction-feedback-items`, `/api/human-review-correction-actor-feedback` route 제공
- Goal Checkpoint에서 Human Review Correction Feedback을 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-corrections:feedback`
- `src/human-review-correction-feedback.mjs`
- `schemas/human-review-correction-feedback.schema.json`
- `docs/human-review-correction-feedback.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- correction feedback artifact가 schema validation을 통과함
- actor feedback count가 correction workspace merge actor input count와 일치함
- feedback item count가 correction validation item count와 일치함
- pending correction receipt는 actor feedback에서 `needs_human_decision`으로 유지되고 missing validation count가 0임
- `/api/human-review-correction-feedback-items?feedback_status=needs_human_decision`으로 pending correction feedback item을 조회할 수 있음
- `/api/human-review-correction-actor-feedback?required_actor=attorney_or_designated_reviewer`로 actor별 correction feedback bundle을 조회할 수 있음
- Dashboard summary가 correction feedback actor, item, pending, ready, correction, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-corrections:feedback`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 69: Human Review Cycle Ledger

목표: validation feedback → correction workspace → correction merge → correction validation → correction feedback의 한 바퀴를 gate item 단위 ledger로 묶어 운영자가 actor별 남은 작업과 loop 상태를 한 번에 볼 수 있게 한다.

- `Human Review Validation Feedback`, `Human Review Correction Workspace`, `Human Review Correction Workspace Merge`, `Human Review Correction Validation`, `Human Review Correction Feedback`을 입력으로 사용
- `gate_item_id` 기준으로 원 feedback, correction item, merge item, validation item, correction feedback item을 연결
- actor별 cycle rollup과 gate item별 cycle item을 생성
- pending, ready, attention, clear 상태를 cycle status로 정규화
- protected action은 cycle ledger 단계에서도 실행하지 않고 `auto_execute_allowed: false`와 `protected_actions_executed: false`를 강제
- Control Plane Loop에서 correction feedback 뒤, receipt application 전에 `npm run control-plane:review-cycle` 실행
- Review Dashboard에 `human_review_cycle_ledger` stage와 actor/item/pending/ready/attention/error summary 추가
- Review API에서 `/api/human-review-cycle-ledgers`, `/api/human-review-cycle-items`, `/api/human-review-actor-cycles` route 제공
- Goal Checkpoint에서 Human Review Cycle Ledger를 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-cycle`
- `src/human-review-cycle-ledger.mjs`
- `schemas/human-review-cycle-ledger.schema.json`
- `docs/human-review-cycle-ledger.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- human review cycle ledger artifact가 schema validation을 통과함
- cycle item count가 correction feedback item count와 일치함
- actor cycle count가 correction feedback actor count와 일치함
- pending correction feedback item은 cycle ledger에서 `pending_human_review`로 유지됨
- `/api/human-review-cycle-items?cycle_status=pending_human_review`로 pending cycle item을 조회할 수 있음
- `/api/human-review-actor-cycles?required_actor=attorney_or_designated_reviewer`로 actor별 cycle rollup을 조회할 수 있음
- Dashboard summary가 cycle actor, item, pending, ready, attention, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-cycle`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 70: Human Review Cycle Work Orders

목표: Human Review Cycle Ledger의 gate item별 pending 상태를 actor별 work order queue로 변환해 사람이 다음에 무엇을 처리해야 하는지 바로 볼 수 있게 한다.

- `Human Review Cycle Ledger`를 source of truth로 사용
- `Human Review Correction Feedback`을 보조 입력으로 사용해 target receipt input path, required receipt fields, allowed outcomes를 work order item에 연결
- actor별 work order와 gate item별 work order item을 생성
- pending, ready, attention, clear 상태를 work order status로 정규화
- protected action은 work order 단계에서도 실행하지 않고 `auto_execute_allowed: false`와 `protected_actions_executed: false`를 강제
- Control Plane Loop에서 cycle ledger 뒤, receipt application 전에 `npm run control-plane:review-cycle:work-orders` 실행
- Review Dashboard에 `human_review_cycle_work_orders` stage와 actor/item/pending/ready/attention/error summary 추가
- Review API에서 `/api/human-review-cycle-work-orders`, `/api/human-review-cycle-work-order-items`, `/api/human-review-actor-work-orders` route 제공
- Goal Checkpoint에서 Human Review Cycle Work Orders를 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-cycle:work-orders`
- `src/human-review-cycle-work-orders.mjs`
- `schemas/human-review-cycle-work-orders.schema.json`
- `docs/human-review-cycle-work-orders.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- human review cycle work orders artifact가 schema validation을 통과함
- work order item count가 cycle ledger item count와 일치함
- actor work order count가 cycle ledger actor count와 일치함
- pending cycle item은 work order에서 `pending_human_review`로 유지됨
- `/api/human-review-cycle-work-order-items?work_order_status=pending_human_review`로 pending work order item을 조회할 수 있음
- `/api/human-review-actor-work-orders?required_actor=attorney_or_designated_reviewer`로 actor별 work order를 조회할 수 있음
- Dashboard summary가 work order actor, item, pending, ready, attention, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-cycle:work-orders`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 71: Human Review Cycle Target Audit

목표: Human Review Cycle Work Orders가 가리키는 actor별 receipt input file과 gate row가 실제로 존재하는지 audit해, 사람이 work order를 믿고 열 수 있게 한다.

- `Human Review Cycle Work Orders`를 입력으로 사용
- work order item별 `target_receipt_input_path` 파일을 읽고 `gate_item_id` 또는 `receipt_id`로 receipt row를 확인
- target decision/correction JSON path 존재 여부도 함께 확인
- missing file, missing row, missing required field, mismatch field를 audit item 상태로 기록
- actor별 target audit rollup과 gate item별 target audit item을 생성
- protected action은 audit 단계에서도 실행하지 않고 `auto_execute_allowed: false`와 `protected_actions_executed: false`를 강제
- Control Plane Loop에서 work orders 뒤, receipt application 전에 `npm run control-plane:review-cycle:target-audit` 실행
- Review Dashboard에 `human_review_cycle_target_audit` stage와 item/ready/attention/blocked/error summary 추가
- Review API에서 `/api/human-review-cycle-target-audits`, `/api/human-review-cycle-target-audit-items`, `/api/human-review-actor-target-audits` route 제공
- Goal Checkpoint에서 Human Review Cycle Target Audit을 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-cycle:target-audit`
- `src/human-review-cycle-work-order-target-audit.mjs`
- `schemas/human-review-cycle-work-order-target-audit.schema.json`
- `docs/human-review-cycle-work-order-target-audit.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- human review cycle work order target audit artifact가 schema validation을 통과함
- target audit item count가 work order item count와 일치함
- actor target audit count가 actor work order count와 일치함
- 모든 pending work order target file과 receipt row가 존재하면 `ready_for_human_review`로 표시됨
- `/api/human-review-cycle-target-audit-items?target_audit_status=ready_for_human_review`로 ready target audit item을 조회할 수 있음
- `/api/human-review-actor-target-audits?required_actor=attorney_or_designated_reviewer`로 actor별 target audit을 조회할 수 있음
- Dashboard summary가 target audit actor, item, ready, attention, blocked, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-cycle:target-audit`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 72: Human Review Cycle Triage Inbox

목표: 검증 완료된 Human Review Cycle Work Orders와 Target Audit을 actor-ready triage inbox로 묶어, 사람이 바로 어떤 receipt row를 열고 판단해야 하는지 볼 수 있게 한다.

- `Human Review Cycle Work Orders`와 `Human Review Cycle Target Audit`을 입력으로 사용
- work order item별 target audit linkage, target receipt input, receipt row 상태를 triage item에 결합
- actor별 triage inbox와 gate item별 triage item을 생성
- `ready_for_human_review`, `ready_for_application`, `attention`, `blocked`, `clear` 상태를 triage status로 정규화
- protected action은 triage 단계에서도 실행하지 않고 `auto_execute_allowed: false`와 `protected_actions_executed: false`를 강제
- Control Plane Loop에서 target audit 뒤, receipt application 전에 `npm run control-plane:review-cycle:triage` 실행
- Review Dashboard에 `human_review_cycle_triage_inbox` stage와 actor/item/ready/attention/blocked/error summary 추가
- Review API에서 `/api/human-review-cycle-triage-inboxes`, `/api/human-review-cycle-triage-items`, `/api/human-review-actor-triage-inboxes` route 제공
- Goal Checkpoint에서 Human Review Cycle Triage Inbox를 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-cycle:triage`
- `src/human-review-cycle-triage-inbox.mjs`
- `schemas/human-review-cycle-triage-inbox.schema.json`
- `docs/human-review-cycle-triage-inbox.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- human review cycle triage inbox artifact가 schema validation을 통과함
- triage item count가 work order item count와 target audit item count와 일치함
- actor triage inbox count가 actor work order count와 일치함
- 모든 verified target audit item은 `ready_for_human_review` triage item으로 표시됨
- `/api/human-review-cycle-triage-items?triage_status=ready_for_human_review`로 ready triage item을 조회할 수 있음
- `/api/human-review-actor-triage-inboxes?required_actor=attorney_or_designated_reviewer`로 actor별 triage inbox를 조회할 수 있음
- Dashboard summary가 triage actor, item, ready, attention, blocked, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-cycle:triage`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 73: Human Review Cycle Reviewer Console

목표: Human Review Cycle Triage Inbox를 사람이 바로 열어볼 수 있는 actor별 reviewer console로 렌더링한다.

- `Human Review Cycle Triage Inbox`, `Human Review Context Bundle`, `Human Review Decision Register`를 입력으로 사용
- triage item별 context card와 decision row를 결합해 title, reason, evidence/matter/approval context, required receipt fields, allowed outcomes를 한 항목으로 노출
- actor별 static HTML/Markdown console과 top-level HTML console을 생성
- console item별 target receipt input path와 manual next action을 명시
- protected action은 console 단계에서도 실행하지 않고 `auto_execute_allowed: false`와 `protected_actions_executed: false`를 강제
- Control Plane Loop에서 triage 뒤, receipt application 전에 `npm run control-plane:review-cycle:console` 실행
- Review Dashboard에 `human_review_cycle_reviewer_console` stage와 actor/item/ready/context-link/error summary 추가
- Review API에서 `/api/human-review-cycle-reviewer-consoles`, `/api/human-review-cycle-console-items`, `/api/human-review-actor-consoles` route 제공
- Goal Checkpoint에서 Human Review Cycle Reviewer Console을 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-cycle:console`
- `src/human-review-cycle-reviewer-console.mjs`
- `schemas/human-review-cycle-reviewer-console.schema.json`
- `docs/human-review-cycle-reviewer-console.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- human review cycle reviewer console artifact가 schema validation을 통과함
- console item count가 triage item count와 일치함
- actor console count가 triage actor inbox count와 일치함
- 모든 console item이 context card와 decision row에 연결됨
- `/api/human-review-cycle-console-items?console_status=ready_for_human_review`로 ready console item을 조회할 수 있음
- `/api/human-review-actor-consoles?required_actor=attorney_or_designated_reviewer`로 actor별 console을 조회할 수 있음
- Dashboard summary가 console actor, item, ready, missing context/decision, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-cycle:console`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 74: Human Review Cycle Receipt Field Audit

목표: Human Review Cycle Reviewer Console이 가리키는 actor별 receipt input row의 required field 값 상태를 audit해, 사람이 어떤 필드를 채워야 하는지 구조적으로 확인한다.

- `Human Review Cycle Reviewer Console`을 입력으로 사용
- console item별 `target_receipt_input_path`와 `receipt_id` 또는 `gate_item_id`로 receipt row를 다시 읽음
- required receipt field가 key로 존재하는지와 값이 비어 있는지를 분리해서 기록
- pending receipt의 빈 human decision field는 validation error가 아니라 `pending_human_review`로 표시
- terminal receipt가 빈 required field를 갖고 있으면 `attention`으로 표시
- missing file, missing row, missing required field key는 validation error로 표시
- protected action은 field audit 단계에서도 실행하지 않고 `auto_execute_allowed: false`와 `protected_actions_executed: false`를 강제
- Control Plane Loop에서 reviewer console 뒤, receipt application 전에 `npm run control-plane:review-cycle:field-audit` 실행
- Review Dashboard에 `human_review_cycle_receipt_field_audit` stage와 actor/item/pending/missing-field/error summary 추가
- Review API에서 `/api/human-review-cycle-field-audits`, `/api/human-review-cycle-field-audit-items`, `/api/human-review-actor-field-audits` route 제공
- Goal Checkpoint에서 Human Review Cycle Receipt Field Audit을 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-cycle:field-audit`
- `src/human-review-cycle-receipt-field-audit.mjs`
- `schemas/human-review-cycle-receipt-field-audit.schema.json`
- `docs/human-review-cycle-receipt-field-audit.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- human review cycle receipt field audit artifact가 schema validation을 통과함
- field audit item count가 console item count와 일치함
- actor field audit count가 actor console count와 일치함
- pending receipt row는 `pending_human_review`로 유지되고 missing human field value를 노출함
- missing target file/row/key가 없으면 validation error가 0임
- `/api/human-review-cycle-field-audit-items?field_audit_status=pending_human_review`로 pending field audit item을 조회할 수 있음
- `/api/human-review-actor-field-audits?required_actor=attorney_or_designated_reviewer`로 actor별 field audit을 조회할 수 있음
- Dashboard summary가 field audit actor, item, pending, ready, attention, missing field, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-cycle:field-audit`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 75: Human Review Cycle Receipt Completion Pack

목표: Human Review Cycle Receipt Field Audit의 pending field 목록을 actor별 manual completion template로 변환해, 사람이 target receipt input을 안전하게 채울 수 있게 한다.

- `Human Review Cycle Receipt Field Audit`을 입력으로 사용
- field audit item별 missing required field value를 field prompt로 변환
- receipt_status, outcome, command_result 등 선택값이 있는 필드는 allowed values와 placeholder를 함께 기록
- actor별 `receipt-completion-template.json`과 Markdown completion pack을 생성
- target `receipt-input.json`은 수정하지 않으며 template-only로 유지
- protected action은 completion pack 단계에서도 실행하지 않고 `auto_execute_allowed: false`와 `protected_actions_executed: false`를 강제
- Control Plane Loop에서 receipt field audit 뒤, receipt application 전에 `npm run control-plane:review-cycle:completion-pack` 실행
- Review Dashboard에 `human_review_cycle_receipt_completion_pack` stage와 actor/item/template-field/error summary 추가
- Review API에서 `/api/human-review-cycle-completion-packs`, `/api/human-review-cycle-completion-items`, `/api/human-review-actor-completion-packs` route 제공
- Goal Checkpoint에서 Human Review Cycle Receipt Completion Pack을 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-cycle:completion-pack`
- `src/human-review-cycle-receipt-completion-pack.mjs`
- `schemas/human-review-cycle-receipt-completion-pack.schema.json`
- `docs/human-review-cycle-receipt-completion-pack.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- human review cycle receipt completion pack artifact가 schema validation을 통과함
- completion item count가 field audit item count와 일치함
- actor completion pack count가 actor field audit count와 일치함
- pending receipt row는 `ready_for_human_input` completion item으로 변환됨
- template field prompt count가 field audit missing required field value와 pending receipt의 terminal decision field를 함께 반영함
- `/api/human-review-cycle-completion-items?completion_status=ready_for_human_input`으로 completion item을 조회할 수 있음
- `/api/human-review-actor-completion-packs?required_actor=attorney_or_designated_reviewer`로 actor별 completion pack을 조회할 수 있음
- Dashboard summary가 completion pack actor, item, ready human input, template field prompt, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-cycle:completion-pack`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 76: Human Review Cycle Receipt Completion Verification

목표: Human Review Cycle Receipt Completion Pack의 actor별 template가 실제 target receipt input row에 수동 반영되었는지 read-only로 검증한다.

- `Human Review Cycle Receipt Completion Pack`을 입력으로 사용
- completion item별 `target_receipt_input_path`와 `receipt_id` 또는 `gate_item_id`로 실제 receipt row를 다시 읽음
- 각 field prompt의 실제 값을 `complete`, `pending`, `invalid`로 판정
- `receipt_status`, `outcome`, `command_result`, `decided_at` 등 terminal decision field의 allowed value와 형식을 검증
- pending/empty/placeholder 값은 validation error가 아니라 `pending_human_input`으로 표시
- missing target file/row는 structural validation error와 `blocked` 상태로 표시
- target `receipt-input.json`은 수정하지 않으며 verification-only로 유지
- protected action은 verification 단계에서도 실행하지 않고 `auto_execute_allowed: false`와 `protected_actions_executed: false`를 강제
- Control Plane Loop에서 completion pack 뒤, receipt application 전에 `npm run control-plane:review-cycle:completion-verify` 실행
- Review Dashboard에 `human_review_cycle_receipt_completion_verification` stage와 actor/item/pending/ready/prompt/error summary 추가
- Review API에서 `/api/human-review-cycle-completion-verifications`, `/api/human-review-cycle-completion-verification-items`, `/api/human-review-actor-completion-verifications` route 제공
- Goal Checkpoint에서 Human Review Cycle Receipt Completion Verification을 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-cycle:completion-verify`
- `src/human-review-cycle-receipt-completion-verification.mjs`
- `schemas/human-review-cycle-receipt-completion-verification.schema.json`
- `docs/human-review-cycle-receipt-completion-verification.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- human review cycle receipt completion verification artifact가 schema validation을 통과함
- verification item count가 completion pack item count와 일치함
- actor verification count가 actor completion pack count와 일치함
- pending target receipt row는 `pending_human_input` verification item으로 유지됨
- field prompt count가 completion pack template field prompt count와 일치함
- missing target file/row가 없으면 validation error가 0임
- `/api/human-review-cycle-completion-verification-items?verification_status=pending_human_input`으로 pending verification item을 조회할 수 있음
- `/api/human-review-actor-completion-verifications?required_actor=attorney_or_designated_reviewer`로 actor별 verification을 조회할 수 있음
- Dashboard summary가 completion verification actor, item, pending input, pending prompt, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-cycle:completion-verify`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 77: Human Review Cycle Receipt Completion Workbench

목표: Human Review Cycle Receipt Completion Verification의 pending human input을 actor별 read-only 작업판으로 렌더링해, 사람이 어떤 target receipt input의 어떤 필드를 채워야 하는지 한 화면에서 볼 수 있게 한다.

- `Human Review Cycle Receipt Completion Verification`과 `Human Review Cycle Receipt Completion Pack`을 입력으로 사용
- verification item별 pending/invalid/completed field 목록을 workbench item으로 변환
- actor별 completion template path와 target receipt input path를 함께 표시
- 전체 `index.html`과 actor별 `completion-workbench.html`을 생성
- target `receipt-input.json`은 수정하지 않으며 workbench-only로 유지
- protected action은 workbench 단계에서도 실행하지 않고 `auto_execute_allowed: false`와 `protected_actions_executed: false`를 강제
- Control Plane Loop에서 completion verification 뒤, receipt application 전에 `npm run control-plane:review-cycle:completion-workbench` 실행
- Review Dashboard에 `human_review_cycle_receipt_completion_workbench` stage와 actor/item/pending/template/error summary 추가
- Review API에서 `/api/human-review-cycle-completion-workbenches`, `/api/human-review-cycle-completion-workbench-items`, `/api/human-review-actor-completion-workbenches` route 제공
- Goal Checkpoint에서 Human Review Cycle Receipt Completion Workbench를 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-cycle:completion-workbench`
- `src/human-review-cycle-receipt-completion-workbench.mjs`
- `schemas/human-review-cycle-receipt-completion-workbench.schema.json`
- `docs/human-review-cycle-receipt-completion-workbench.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- human review cycle receipt completion workbench artifact가 schema validation을 통과함
- workbench item count가 completion verification item count와 일치함
- actor workbench count가 actor verification count와 일치함
- actor별 completion template path와 target receipt input path가 연결됨
- pending receipt row는 `pending_human_input` workbench item으로 유지됨
- 전체 HTML과 actor별 HTML workbench가 생성됨
- `/api/human-review-cycle-completion-workbench-items?workbench_status=pending_human_input`으로 pending workbench item을 조회할 수 있음
- `/api/human-review-actor-completion-workbenches?required_actor=attorney_or_designated_reviewer`로 actor별 workbench를 조회할 수 있음
- Dashboard summary가 completion workbench actor, item, pending prompt, template count, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-cycle:completion-workbench`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 78: Human Review Cycle Receipt Completion Runbook

목표: Human Review Cycle Receipt Completion Workbench의 pending human input 상태를 사람이 그대로 실행할 수 있는 read-only runbook으로 고정한다.

- `Human Review Cycle Receipt Completion Workbench`와 `Human Review Cycle Receipt Completion Verification`을 입력으로 사용
- actor별 runbook과 전체 command/manual step list를 생성
- completion workbench, actor template, target receipt input, 후속 검증 명령의 순서를 명시
- target `receipt-input.json`은 수정하지 않으며 runbook-only로 유지
- protected action은 runbook 단계에서도 실행하지 않고 `auto_execute_allowed: false`와 `protected_actions_executed: false`를 강제
- protected application command는 기록만 하며 explicit human approval 없이는 실행 대상으로 보지 않음
- Control Plane Loop에서 completion workbench 뒤, receipt application 전에 `npm run control-plane:review-cycle:completion-runbook` 실행
- Review Dashboard에 `human_review_cycle_receipt_completion_runbook` stage와 actor/step/manual/command/error summary 추가
- Review API에서 `/api/human-review-cycle-completion-runbooks`, `/api/human-review-cycle-completion-runbook-steps`, `/api/human-review-actor-completion-runbooks` route 제공
- Goal Checkpoint에서 Human Review Cycle Receipt Completion Runbook을 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-cycle:completion-runbook`
- `src/human-review-cycle-receipt-completion-runbook.mjs`
- `schemas/human-review-cycle-receipt-completion-runbook.schema.json`
- `docs/human-review-cycle-receipt-completion-runbook.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- human review cycle receipt completion runbook artifact가 schema validation을 통과함
- actor runbook count가 actor workbench count와 일치함
- workbench item count가 completion workbench item count와 일치함
- manual step과 command step이 모두 존재함
- actor별 workbench HTML과 completion template path가 연결됨
- pending receipt row는 `pending_human_input` runbook status로 유지됨
- 전체 HTML과 actor별 HTML runbook이 생성됨
- `/api/human-review-cycle-completion-runbook-steps?step_status=pending_human_input`으로 pending runbook step을 조회할 수 있음
- `/api/human-review-actor-completion-runbooks?required_actor=attorney_or_designated_reviewer`로 actor별 runbook을 조회할 수 있음
- Dashboard summary가 completion runbook actor, step, command, manual, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-cycle:completion-runbook`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 79: Human Review Cycle Receipt Completion Readiness

목표: Human Review Cycle Receipt Completion Runbook의 command step을 read-only readiness gate로 분류해, 사람이 receipt input을 채우기 전 실행 가능한 refresh command와 보류해야 할 command를 명확히 분리한다.

- `Human Review Cycle Receipt Completion Runbook`과 `Human Review Cycle Receipt Completion Verification`을 입력으로 사용
- command-bearing runbook step을 `command_gates`로 변환
- actor별 readiness와 manual requirement를 별도 JSON으로 생성
- verification/workbench/runbook/dashboard/API refresh command는 `available_now`로 표시
- correction merge, correction validation, receipt field audit, protected apply command는 manual input 완료 전 `blocked_until_manual_input`으로 표시
- protected application command는 manual input 완료 후에도 explicit human approval 대상으로만 유지
- target `receipt-input.json`은 수정하지 않으며 readiness-only로 유지
- Control Plane Loop에서 completion runbook 뒤, receipt application 전에 `npm run control-plane:review-cycle:completion-readiness` 실행
- Review Dashboard에 `human_review_cycle_receipt_completion_readiness` stage와 command gate/manual hold summary 추가
- Review API에서 `/api/human-review-cycle-completion-readiness`, `/api/human-review-cycle-completion-command-gates`, `/api/human-review-actor-completion-readiness` route 제공
- Goal Checkpoint에서 Human Review Cycle Receipt Completion Readiness를 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-cycle:completion-readiness`
- `src/human-review-cycle-receipt-completion-readiness.mjs`
- `schemas/human-review-cycle-receipt-completion-readiness.schema.json`
- `docs/human-review-cycle-receipt-completion-readiness.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- human review cycle receipt completion readiness artifact가 schema validation을 통과함
- actor readiness count가 actor runbook count와 일치함
- command gate count가 command-bearing runbook step 수와 일치함
- manual requirement count가 manual runbook step 수와 일치함
- available command와 blocked command가 모두 존재함
- protected command는 `command_allowed_now: false`로 유지됨
- pending receipt row는 `waiting_for_human_input` readiness status로 유지됨
- 전체 HTML과 summary markdown이 생성됨
- `/api/human-review-cycle-completion-command-gates?command_status=available_now`로 즉시 실행 가능 command를 조회할 수 있음
- `/api/human-review-actor-completion-readiness?required_actor=attorney_or_designated_reviewer`로 actor별 readiness를 조회할 수 있음
- Dashboard summary가 completion readiness actor, command gate, manual requirement, blocked/allowed command count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-cycle:completion-readiness`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 80: Human Review Cycle Receipt Completion Command Queue

목표: Human Review Cycle Receipt Completion Readiness가 분류한 command gate를 사람이 바로 볼 수 있는 read-only command queue로 고정한다. 실행 가능한 refresh command와 manual input 또는 explicit approval 전 보류해야 할 command를 분리하되, harness는 어떤 command도 실행하지 않는다.

- `Human Review Cycle Receipt Completion Readiness`를 입력으로 사용
- `available_now` command gate를 `command_queue_items`로 변환
- unavailable command gate를 `held_command_items`로 변환
- actor별 command queue view를 생성
- protected application command는 held command로 유지
- target `receipt-input.json`은 수정하지 않으며 command-queue-only로 유지
- Control Plane Loop에서 completion readiness 뒤, receipt application 전에 `npm run control-plane:review-cycle:completion-command-queue` 실행
- Review Dashboard에 `human_review_cycle_receipt_completion_command_queue` stage와 ready/held/protected hold summary 추가
- Review API에서 `/api/human-review-cycle-completion-command-queues`, `/api/human-review-cycle-completion-command-queue-items`, `/api/human-review-cycle-completion-held-commands`, `/api/human-review-actor-completion-command-queues` route 제공
- Goal Checkpoint에서 Human Review Cycle Receipt Completion Command Queue를 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-cycle:completion-command-queue`
- `src/human-review-cycle-receipt-completion-command-queue.mjs`
- `schemas/human-review-cycle-receipt-completion-command-queue.schema.json`
- `docs/human-review-cycle-receipt-completion-command-queue.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- human review cycle receipt completion command queue artifact가 schema validation을 통과함
- command queue item count가 readiness allowed command count와 일치함
- held command item count가 readiness blocked command count와 일치함
- actor command queue count가 readiness actor count와 일치함
- protected command는 held command로 유지됨
- 모든 item은 `auto_execute_allowed: false`와 `protected_actions_executed: false`를 유지함
- 전체 HTML과 summary markdown이 생성됨
- `/api/human-review-cycle-completion-command-queue-items?queue_status=ready_to_run_manually`로 즉시 수동 실행 가능한 command를 조회할 수 있음
- `/api/human-review-cycle-completion-held-commands?hold_status=held_until_manual_input`으로 held command를 조회할 수 있음
- Dashboard summary가 completion command queue ready, held, actor, protected held count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-cycle:completion-command-queue`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 81: Human Review Cycle Receipt Completion Command Receipts

목표: Human Review Cycle Receipt Completion Command Queue의 ready command를 사람이 수동 실행한 뒤 기록할 수 있는 receipt draft로 변환한다. held command는 참고용으로 유지하되, harness는 어떤 command도 실행하지 않고 protected action도 적용하지 않는다.

- `Human Review Cycle Receipt Completion Command Queue`를 입력으로 사용
- ready command queue item마다 `receipt_requirements`와 pending receipt draft row 생성
- held command는 `held_command_references`로 별도 보존
- receipt draft에는 `receipt_status`, `command_result`, `executed_by`, `executed_at`, `output_reference`, `notes`, `commands_run` 필수 필드 선언
- protected application command는 ready receipt draft에 들어가지 않음
- target `receipt-input.json`은 수정하지 않으며 command-receipts-only로 유지
- Control Plane Loop에서 completion command queue 뒤, receipt application 전에 `npm run control-plane:review-cycle:completion-command-receipts` 실행
- Review Dashboard에 `human_review_cycle_receipt_completion_command_receipts` stage와 draft/held-reference summary 추가
- Review API에서 `/api/human-review-cycle-completion-command-receipts`, `/api/human-review-cycle-completion-command-receipt-requirements`, `/api/human-review-cycle-completion-command-receipt-drafts`, `/api/human-review-cycle-completion-held-command-references` route 제공
- Goal Checkpoint에서 Human Review Cycle Receipt Completion Command Receipts를 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-cycle:completion-command-receipts`
- `src/human-review-cycle-receipt-completion-command-receipts.mjs`
- `schemas/human-review-cycle-receipt-completion-command-receipts.schema.json`
- `docs/human-review-cycle-receipt-completion-command-receipts.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- human review cycle receipt completion command receipts artifact가 schema validation을 통과함
- receipt requirement count와 draft count가 command queue ready item count와 일치함
- held command reference count가 command queue held item count와 일치함
- 모든 receipt draft는 `receipt_status: pending`, `command_result: not_run`으로 시작함
- protected application command는 ready receipt requirement에 포함되지 않음
- 전체 HTML과 summary markdown이 생성됨
- `/api/human-review-cycle-completion-command-receipt-drafts?command_result=not_run`으로 pending command receipt draft를 조회할 수 있음
- `/api/human-review-cycle-completion-held-command-references?requires_explicit_human_approval=true`로 held command reference를 조회할 수 있음
- Dashboard summary가 completion command receipt draft, held reference, required field count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-cycle:completion-command-receipts`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 82: Human Review Cycle Receipt Completion Command Receipt Validation

목표: Human Review Cycle Receipt Completion Command Receipts에서 생성한 pending command-run receipt input을 검증 계층으로 분리한다. 사람이 실제로 refresh command를 수동 실행하고 receipt row를 채운 경우에도, harness는 이를 바로 적용하거나 후속 protected action으로 넘기지 않고 pending/ready/invalid 상태로만 판정한다.

- `Human Review Cycle Receipt Completion Command Receipts`와 `receipt-input-draft.json`을 입력으로 사용
- command receipt requirement와 receipt row를 `queue_item_id`로 매칭
- pending receipt는 `pending_receipt`로 유지하고 proof of execution으로 취급하지 않음
- non-pending receipt는 `receipt_status`, `command_result`, `executed_by`, `executed_at`, `output_reference`, `notes`, `commands_run`을 검증
- `commands_run`은 원래 queued command를 정확히 포함해야 함
- unknown command receipt row는 validation error로 분리
- 검증 완료 receipt는 `validated-command-receipts.json`으로 별도 출력하되, target receipt input이나 protected action은 수정하지 않음
- Control Plane Loop에서 completion command receipts 뒤, receipt application 전에 `npm run control-plane:review-cycle:completion-command-receipts:validate` 실행
- Review Dashboard에 `human_review_cycle_receipt_completion_command_receipt_validation` stage와 pending/ready/invalid/error summary 추가
- Review API에서 `/api/human-review-cycle-completion-command-receipt-validations`, `/api/human-review-cycle-completion-command-receipt-validation-items`, `/api/human-review-cycle-completion-command-receipt-errors`, `/api/validated-human-review-cycle-completion-command-receipts` route 제공
- Goal Checkpoint에서 Human Review Cycle Receipt Completion Command Receipt Validation을 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-cycle:completion-command-receipts:validate`
- `scripts/human-review-cycle-receipt-completion-command-receipt-validation.mjs`
- `schemas/human-review-cycle-receipt-completion-command-receipt-validation.schema.json`
- `docs/human-review-cycle-receipt-completion-command-receipt-validation.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- command receipt validation artifact가 schema validation을 통과함
- validation item count가 command receipt draft count와 일치함
- pending command receipt는 `pending_receipt`와 `command_result: not_run`으로 유지됨
- pending 상태에서는 ready receipt가 0개이고 error가 0개임
- non-pending receipt를 위한 필수 실행 증빙 필드 검증 규칙이 존재함
- `/api/human-review-cycle-completion-command-receipt-validation-items?validation_status=pending_receipt`로 pending validation item을 조회할 수 있음
- `/api/validated-human-review-cycle-completion-command-receipts`로 검증 완료 receipt를 조회할 수 있음
- Dashboard summary가 command receipt validation item, pending, ready, invalid, error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-cycle:completion-command-receipts:validate`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 83: Human Review Cycle Receipt Completion Command Receipt Feedback

목표: command receipt validation 결과를 actor별 feedback bundle로 환류한다. 사람이 아직 실행하지 않은 refresh command나 수정이 필요한 command receipt row를 다시 actor에게 보여주되, harness는 command 실행, receipt input 수정, receipt application, protected action을 수행하지 않는다.

- Command Receipt Validation, Command Receipts, Command Queue artifact를 입력으로 사용
- validation item을 `feedback_items`로 변환하고 `required_actor`별 `actor_feedback` bundle 생성
- `pending_receipt`는 `needs_command_receipt`, `ready_to_confirm`은 `ready_for_confirmation`, invalid/missing/unknown은 `needs_correction`으로 매핑
- actor별 `actors/<required_actor>/feedback.json`과 `feedback.md` 생성
- safe handling은 `auto_execute_allowed: false`, `feedback_only: true`, `protected_actions_executed: false`로 고정
- Control Plane Loop에서 command receipt validation 뒤, human gate receipt application 전에 `npm run control-plane:review-cycle:completion-command-receipts:feedback` 실행
- Review Dashboard에 `human_review_cycle_receipt_completion_command_receipt_feedback` stage와 actor/pending/correction summary 추가
- Review API에서 `/api/human-review-cycle-completion-command-receipt-feedbacks`, `/api/human-review-cycle-completion-command-receipt-feedback-items`, `/api/human-review-cycle-completion-command-receipt-actor-feedback` route 제공
- Goal Checkpoint에서 Human Review Cycle Receipt Completion Command Receipt Feedback을 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-cycle:completion-command-receipts:feedback`
- `src/human-review-cycle-receipt-completion-command-receipt-feedback.mjs`
- `schemas/human-review-cycle-receipt-completion-command-receipt-feedback.schema.json`
- `docs/human-review-cycle-receipt-completion-command-receipt-feedback.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- command receipt feedback artifact가 schema validation을 통과함
- feedback item count가 command receipt validation item count와 일치함
- actor feedback bundle이 하나 이상 생성되고 command queue actor mapping을 보존함
- pending command receipt는 `needs_command_receipt` feedback으로 남고 ready/correction count가 정확히 집계됨
- actor별 JSON/Markdown feedback bundle이 생성됨
- `/api/human-review-cycle-completion-command-receipt-feedback-items?feedback_status=needs_command_receipt`로 pending feedback item을 조회할 수 있음
- `/api/human-review-cycle-completion-command-receipt-actor-feedback?required_actor=human_reviewer`로 actor feedback을 조회할 수 있음
- Dashboard summary가 command receipt feedback actor, item, pending, correction, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-cycle:completion-command-receipts:feedback`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 84: Human Review Cycle Receipt Completion Command Receipt Workspace

목표: command receipt feedback을 actor별 editable command receipt input workspace로 변환한다. 사람이 수동으로 refresh command를 실행하고 그 결과를 기록할 수 있는 파일을 만들되, harness는 command 실행, actor input merge, receipt application, protected action을 수행하지 않는다.

- Command Receipt Feedback과 Command Receipts artifact를 입력으로 사용
- feedback item을 `workspace_items`로 변환하고 `required_actor`별 `actor_workspaces` 생성
- actor별 `receipt-input.json`은 `human-review-cycle-receipt-completion-command-receipts-input.v1` 형식을 유지
- editable receipt에는 `receipt_status`, `command_result`, `executed_by`, `executed_at`, `output_reference`, `notes`, `commands_run` placeholder를 유지
- `commands_run`에는 원래 queued command가 포함됨
- actor별 `command-receipt-workspace.json`, `receipt-input.json`, `workspace.md` 생성
- safe handling은 `auto_execute_allowed: false`, `command_receipt_workspace_only: true`, `receipt_edits_must_be_manual: true`, `protected_actions_executed: false`로 고정
- Control Plane Loop에서 command receipt feedback 뒤, human gate receipt application 전에 `npm run control-plane:review-cycle:completion-command-receipts:workspace` 실행
- Review Dashboard에 `human_review_cycle_receipt_completion_command_receipt_workspace` stage와 actor/workspace/pending summary 추가
- Review API에서 `/api/human-review-cycle-completion-command-receipt-workspaces`, `/api/human-review-cycle-completion-command-receipt-workspace-items`, `/api/human-review-cycle-completion-command-receipt-actor-workspaces` route 제공
- Goal Checkpoint에서 Human Review Cycle Receipt Completion Command Receipt Workspace를 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-cycle:completion-command-receipts:workspace`
- `src/human-review-cycle-receipt-completion-command-receipt-workspace.mjs`
- `schemas/human-review-cycle-receipt-completion-command-receipt-workspace.schema.json`
- `docs/human-review-cycle-receipt-completion-command-receipt-workspace.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- command receipt workspace artifact가 schema validation을 통과함
- workspace item count가 command receipt feedback item count와 일치함
- actor workspace count가 command receipt feedback actor count와 일치함
- actor별 editable `receipt-input.json`이 생성되고 receipt row count가 workspace item count와 일치함
- editable receipt의 `commands_run`이 queued command를 포함함
- `/api/human-review-cycle-completion-command-receipt-workspace-items?workspace_status=needs_command_receipt`로 pending workspace item을 조회할 수 있음
- `/api/human-review-cycle-completion-command-receipt-actor-workspaces?required_actor=human_reviewer`로 actor workspace를 조회할 수 있음
- Dashboard summary가 command receipt workspace actor, item, receipt row, pending, editable file, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-cycle:completion-command-receipts:workspace`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 85: Human Review Cycle Receipt Completion Command Receipt Workspace Merge

목표: actor별 editable command receipt input을 하나의 canonical `receipt-input.json`으로 병합한다. 사람이 수동으로 command 실행 결과를 기록한 뒤 validation 단계로 넘길 수 있게 하되, harness는 command 실행, receipt 검증, receipt application, protected action을 수행하지 않는다.

- Command Receipt Workspace artifact를 입력으로 사용
- workspace가 참조하는 actor별 `receipt-input.json`을 읽어 `actor_inputs`로 정규화
- command receipt `queue_item_id` 기준으로 workspace item과 actor receipt row를 매칭
- missing, duplicate, unknown, invalid actor receipt 상태를 `merge_items`에 기록
- merged `receipt-input.json`은 `human-review-cycle-receipt-completion-command-receipts-input.v1` 형식을 유지
- safe handling은 `auto_execute_allowed: false`, `command_receipt_workspace_merge_only: true`, `receipt_edits_must_be_manual: true`, `validation_required_before_application: true`, `protected_actions_executed: false`로 고정
- Control Plane Loop에서 command receipt workspace 뒤, human gate receipt application 전에 `npm run control-plane:review-cycle:completion-command-receipts:workspace:merge` 실행
- Review Dashboard에 `human_review_cycle_receipt_completion_command_receipt_workspace_merge` stage와 actor/merge/pending/ready summary 추가
- Review API에서 `/api/human-review-cycle-completion-command-receipt-workspace-merges`, `/api/human-review-cycle-completion-command-receipt-merge-items`, `/api/human-review-cycle-completion-command-receipt-actor-inputs`, `/api/merged-human-review-cycle-completion-command-receipt-input` route 제공
- Goal Checkpoint에서 Human Review Cycle Receipt Completion Command Receipt Workspace Merge를 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-cycle:completion-command-receipts:workspace:merge`
- `src/human-review-cycle-receipt-completion-command-receipt-workspace-merge.mjs`
- `schemas/human-review-cycle-receipt-completion-command-receipt-workspace-merge.schema.json`
- `docs/human-review-cycle-receipt-completion-command-receipt-workspace-merge.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- command receipt workspace merge artifact가 schema validation을 통과함
- actor input count가 command receipt workspace actor count와 일치함
- merge item count와 receipt row count가 command receipt workspace item count와 일치함
- pending command receipt는 `pending_receipt` merge item으로 남고 ready validation count가 정확히 집계됨
- merged `receipt-input.json`이 생성되고 receipt row count가 merge item count와 일치함
- `/api/human-review-cycle-completion-command-receipt-merge-items?merge_status=pending_receipt`로 pending merge item을 조회할 수 있음
- `/api/human-review-cycle-completion-command-receipt-actor-inputs?required_actor=human_reviewer`로 actor input을 조회할 수 있음
- Dashboard summary가 command receipt workspace merge actor, item, receipt row, pending, ready, validation error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-cycle:completion-command-receipts:workspace:merge`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 86: Human Review Cycle Receipt Completion Command Receipt Workspace Validation

목표: actor workspace merge에서 생성한 canonical `receipt-input.json`을 command receipt validator에 다시 통과시킨다. merge 이후의 입력을 별도 stage로 검증하되, harness는 command 실행, receipt input 수정, receipt application, protected action을 수행하지 않는다.

- 기존 Command Receipt Validation 계약과 schema를 재사용
- Command Receipts artifact와 Command Receipt Workspace Merge의 `receipt-input.json`을 입력으로 사용
- merged receipt row를 `queue_item_id` 기준으로 command receipt requirement와 매칭
- pending/manual-run/invalid/unknown command receipt 상태를 validation item으로 기록
- 검증 완료 receipt는 `validated-command-receipts.json`으로 별도 출력하되, target receipt input이나 protected action은 수정하지 않음
- safe handling은 `auto_execute_allowed: false`, `command_receipt_validation_only: true`, `receipt_edits_must_be_manual: true`, `protected_actions_executed: false`로 고정
- Control Plane Loop에서 command receipt workspace merge 뒤, human gate receipt application 전에 `npm run control-plane:review-cycle:completion-command-receipts:workspace:validate` 실행
- Review Dashboard에 `human_review_cycle_receipt_completion_command_receipt_workspace_validation` stage와 item/pending/ready/error summary 추가
- Review API에서 `/api/human-review-cycle-completion-command-receipt-workspace-validations`, `/api/human-review-cycle-completion-command-receipt-workspace-validation-items`, `/api/human-review-cycle-completion-command-receipt-workspace-validation-errors`, `/api/validated-human-review-cycle-completion-command-workspace-receipts` route 제공
- Goal Checkpoint에서 Human Review Cycle Receipt Completion Command Receipt Workspace Validation을 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-cycle:completion-command-receipts:workspace:validate`
- `scripts/human-review-cycle-receipt-completion-command-receipt-validation.mjs`
- `schemas/human-review-cycle-receipt-completion-command-receipt-validation.schema.json`
- `docs/human-review-cycle-receipt-completion-command-receipt-workspace-validation.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- merged command receipt validation artifact가 schema validation을 통과함
- validation item count가 command receipt workspace merge item count와 일치함
- receipt count가 merged `receipt-input.json` row count와 일치함
- pending command receipt는 `pending_receipt`와 `command_result: not_run`으로 유지됨
- pending 상태에서는 ready receipt가 0개이고 error가 0개임
- `/api/human-review-cycle-completion-command-receipt-workspace-validation-items?validation_status=pending_receipt`로 pending validation item을 조회할 수 있음
- `/api/validated-human-review-cycle-completion-command-workspace-receipts`로 검증 완료 merged command receipt를 조회할 수 있음
- Dashboard summary가 command receipt workspace validation item, receipt, pending, ready, invalid, error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-cycle:completion-command-receipts:workspace:validate`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 87: Human Review Cycle Receipt Completion Command Receipt Application

목표: merged command receipt validation에서 검증 완료된 manual command receipt만 command queue ledger에 반영한다. 이 단계는 command 실행, receipt input 수정, protected action 실행을 하지 않고, 적용 가능한 receipt가 있을 때 derived patch와 audit event만 생성한다.

- Command Receipt Workspace Validation artifact와 Command Queue artifact를 입력으로 사용
- `validated_command_receipts.receipts`만 application 대상으로 사용
- pending command receipt는 `pending_command_receipts`로 보존
- ready receipt가 없으면 `application_status: nothing_to_apply`로 안전하게 종료
- ready receipt가 있으면 applied command receipt, patched command queue item, audit event artifact 생성
- safe handling은 `auto_execute_allowed: false`, `command_receipt_application_only: true`, `refresh_commands_executed: false`, `protected_actions_executed: false`, `receipt_edits_must_be_manual: true`로 고정
- Control Plane Loop에서 command receipt workspace validation 뒤, human gate receipt application 전에 `npm run control-plane:review-cycle:completion-command-receipts:apply` 실행
- Review Dashboard에 `human_review_cycle_receipt_completion_command_receipt_application` stage와 ready/pending/applied/patched/audit/error summary 추가
- Review API에서 `/api/human-review-cycle-completion-command-receipt-applications`, `/api/applied-human-review-cycle-completion-command-receipts`, `/api/human-review-cycle-completion-command-receipt-application-pending-receipts`, `/api/human-review-cycle-completion-command-receipt-application-audit-events` route 제공
- Goal Checkpoint에서 Human Review Cycle Receipt Completion Command Receipt Application을 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-cycle:completion-command-receipts:apply`
- `src/human-review-cycle-receipt-completion-command-receipt-application.mjs`
- `scripts/human-review-cycle-receipt-completion-command-receipt-application.mjs`
- `schemas/human-review-cycle-receipt-completion-command-receipt-application.schema.json`
- `docs/human-review-cycle-receipt-completion-command-receipt-application.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- command receipt application artifact가 schema validation을 통과함
- 현재 pending-only command receipt 상태에서는 `nothing_to_apply`와 applied count 0을 기록함
- pending count가 workspace validation의 pending receipt count와 일치함
- command/protected action 실행 count가 항상 0임
- `/api/human-review-cycle-completion-command-receipt-applications?application_status=nothing_to_apply`로 application artifact를 조회할 수 있음
- `/api/human-review-cycle-completion-command-receipt-application-pending-receipts?validation_status=pending_receipt`로 보류 중인 command receipt를 조회할 수 있음
- Dashboard summary가 command receipt application ready, pending, applied, patched queue, audit, error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-cycle:completion-command-receipts:apply`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 88: Human Review Cycle Receipt Completion Reconciliation

목표: command receipt application 이후에도 남아 있는 completion blocker를 한 장부에 모은다. pending command receipt, held command, explicit approval hold, actor follow-up을 read-only로 정리하되, command 실행, receipt input 수정, protected action 실행은 하지 않는다.

- Completion Readiness, Command Queue, Command Receipt Application artifact를 입력으로 사용
- pending command receipt를 `waiting_for_manual_command_receipt` reconciliation item으로 기록
- held command를 `waiting_for_manual_input` 또는 `waiting_for_explicit_human_approval` reconciliation item으로 기록
- actor별 command queue, held command, pending receipt 상태를 `actor_statuses`로 정규화
- safe handling은 `auto_execute_allowed: false`, `reconciliation_only: true`, `receipt_edits_must_be_manual: true`, `refresh_commands_executed: false`, `protected_actions_executed: false`로 고정
- Control Plane Loop에서 command receipt application 뒤, human gate receipt application 전에 `npm run control-plane:review-cycle:completion-reconcile` 실행
- Review Dashboard에 `human_review_cycle_receipt_completion_reconciliation` stage와 item/actor/pending/held/error summary 추가
- Review API에서 `/api/human-review-cycle-completion-reconciliations`, `/api/human-review-cycle-completion-reconciliation-items`, `/api/human-review-cycle-completion-reconciliation-actors` route 제공
- Goal Checkpoint에서 Human Review Cycle Receipt Completion Reconciliation을 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-cycle:completion-reconcile`
- `src/human-review-cycle-receipt-completion-reconciliation.mjs`
- `scripts/human-review-cycle-receipt-completion-reconciliation.mjs`
- `schemas/human-review-cycle-receipt-completion-reconciliation.schema.json`
- `docs/human-review-cycle-receipt-completion-reconciliation.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- reconciliation artifact가 schema validation을 통과함
- 현재 pending-only command receipt 상태에서는 `waiting_for_manual_command_receipts`를 기록함
- pending command receipt count가 command receipt application의 pending count와 일치함
- held command count와 protected held command count가 command queue summary와 일치함
- command/protected action 실행 count가 항상 0임
- `/api/human-review-cycle-completion-reconciliations?reconciliation_status=waiting_for_manual_command_receipts`로 reconciliation artifact를 조회할 수 있음
- `/api/human-review-cycle-completion-reconciliation-items?reconciliation_status=waiting_for_manual_command_receipt`로 pending command receipt item을 조회할 수 있음
- Dashboard summary가 reconciliation item, actor, pending command receipt, held command, blocked follow-on, error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-cycle:completion-reconcile`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 89: Human Review Cycle Receipt Completion Baseline

목표: Phase 88 reconciliation 결과를 기준선으로 고정한다. pending command receipt, held command, protected hold 수를 source reconciliation과 대조해 blocker inventory로 봉인하되, command 실행, receipt input 수정, protected action 실행은 하지 않는다.

- Reconciliation artifact를 단일 source of truth로 사용
- `waiting_for*` reconciliation item만 blocker inventory로 정규화
- pending command receipt count, held command count, protected hold count를 source summary와 대조
- reconciliation item count와 actor status count도 source array와 대조
- baseline report는 source reconciliation id, generated_at, status, source counts, inventory counts, count checks를 포함
- safe handling은 `auto_execute_allowed: false`, `baseline_only: true`, `source_artifact_mutation_allowed: false`, `receipt_edits_must_be_manual: true`, `refresh_commands_executed: false`, `protected_actions_executed: false`로 고정
- Control Plane Loop에서 reconciliation 뒤, human gate receipt application 전에 `npm run control-plane:review-cycle:completion-baseline` 실행
- Review Dashboard에 `human_review_cycle_receipt_completion_baseline` stage와 blocker/count-check/error summary 추가
- Review API에서 `/api/human-review-cycle-completion-baselines`, `/api/human-review-cycle-completion-baseline-blockers`, `/api/human-review-cycle-completion-baseline-count-checks` route 제공
- Goal Checkpoint에서 Human Review Cycle Receipt Completion Baseline을 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-cycle:completion-baseline`
- `src/human-review-cycle-receipt-completion-baseline.mjs`
- `scripts/human-review-cycle-receipt-completion-baseline.mjs`
- `schemas/human-review-cycle-receipt-completion-baseline.schema.json`
- `docs/human-review-cycle-receipt-completion-baseline.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- baseline artifact가 schema validation을 통과함
- baseline status가 현재 blocker 상태에서 `frozen_with_blockers`로 기록됨
- blocker inventory count가 source reconciliation의 blocked follow-on count와 일치함
- pending command receipt count가 source reconciliation의 pending command receipt count와 일치함
- held command count가 source reconciliation의 held command count와 일치함
- protected hold count가 source reconciliation의 protected held command count와 일치함
- command/protected action 실행 count가 항상 0임
- `/api/human-review-cycle-completion-baselines?baseline_status=frozen_with_blockers`로 baseline artifact를 조회할 수 있음
- `/api/human-review-cycle-completion-baseline-blockers?blocker_status=waiting_for_manual_command_receipt`로 frozen blocker를 조회할 수 있음
- Dashboard summary가 baseline blocker, pending command receipt, held command, protected hold, mismatch, error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-cycle:completion-baseline`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 90: Human Review Cycle Receipt Completion Manual Command Receipt Pack

목표: manual command receipt 입력 pack을 사람이 작성 가능한 형태로 정리한다. Phase 89 baseline의 pending command receipt blocker와 command receipt workspace의 editable receipt row를 대조해, actor별 target receipt input path와 required field를 누락 없이 표시한다.

- Baseline artifact와 Command Receipt Workspace artifact를 입력으로 사용
- pending command receipt blocker만 manual command receipt pack item으로 변환
- held command와 explicit approval hold는 non-receipt blocker로 보존해 후속 phase에서 처리
- actor별 `manual-command-receipt-pack.json`, `receipt-input-template.json`, `README.md` 생성
- 각 pack item은 target receipt input path, target template path, required receipt fields, missing required fields, editable receipt placeholder를 포함
- pack item count가 baseline pending command receipt count와 일치하는지 검증
- actor pack마다 target receipt input path와 required receipt field 목록이 존재하는지 검증
- safe handling은 `auto_execute_allowed: false`, `pack_only: true`, `command_receipt_edits_must_be_manual: true`, `source_artifact_mutation_allowed: false`, `refresh_commands_executed: false`, `protected_actions_executed: false`로 고정
- Control Plane Loop에서 baseline 뒤, human gate receipt application 전에 `npm run control-plane:review-cycle:completion-manual-command-receipt-pack` 실행
- Review Dashboard에 `human_review_cycle_receipt_completion_manual_command_receipt_pack` stage와 actor/item/target/field/error summary 추가
- Review API에서 `/api/human-review-cycle-completion-manual-command-receipt-packs`, `/api/human-review-cycle-completion-manual-command-receipt-pack-actors`, `/api/human-review-cycle-completion-manual-command-receipt-pack-items` route 제공
- Goal Checkpoint에서 Human Review Cycle Receipt Completion Manual Command Receipt Pack을 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-cycle:completion-manual-command-receipt-pack`
- `src/human-review-cycle-receipt-completion-manual-command-receipt-pack.mjs`
- `scripts/human-review-cycle-receipt-completion-manual-command-receipt-pack.mjs`
- `schemas/human-review-cycle-receipt-completion-manual-command-receipt-pack.schema.json`
- `docs/human-review-cycle-receipt-completion-manual-command-receipt-pack.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- manual command receipt pack artifact가 schema validation을 통과함
- pack status가 현재 pending command receipt 상태에서 `ready_for_manual_receipts`로 기록됨
- pack item count가 baseline pending command receipt blocker count와 일치함
- actor별 target receipt input path가 누락 없이 표시됨
- actor별 required receipt field 목록이 누락 없이 표시됨
- editable receipt placeholder에 required field 누락이 없음
- command/protected action 실행 count가 항상 0임
- `/api/human-review-cycle-completion-manual-command-receipt-packs?pack_status=ready_for_manual_receipts`로 pack artifact를 조회할 수 있음
- `/api/human-review-cycle-completion-manual-command-receipt-pack-actors?required_actor=human_reviewer`로 actor pack을 조회할 수 있음
- Dashboard summary가 manual command receipt pack actor, item, target path, required field, missing field, error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-cycle:completion-manual-command-receipt-pack`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 91: Human Review Cycle Receipt Completion Held Command Resolution

목표: held command를 actor별 resolution plan으로 분해한다. Phase 89 baseline의 held command blocker, Phase 90 manual command receipt pack의 non-receipt blocker, command queue의 held command item을 대조해 각 held command가 required actor, unblock condition, follow-on action을 갖도록 정리하되, command 실행, source artifact 수정, protected action 실행은 하지 않는다.

- Baseline, Manual Command Receipt Pack, Command Queue artifact를 입력으로 사용
- held command blocker만 resolution plan으로 변환
- 각 resolution plan은 required actor, unblock condition, follow-on action, command, protected approval requirement를 포함
- manual input hold와 explicit approval hold를 구분
- actor별 `held-command-resolution-plan.json`, `README.md` 생성
- resolution plan count가 baseline held command count와 일치하는지 검증
- manual command receipt pack non-receipt blocker count와 command queue held item count를 함께 대조
- protected held command는 explicit human approval을 unblock condition으로 강제
- safe handling은 `auto_execute_allowed: false`, `resolution_plan_only: true`, `source_artifact_mutation_allowed: false`, `commands_executed: false`, `protected_actions_executed: false`로 고정
- Control Plane Loop에서 manual command receipt pack 뒤, human gate receipt application 전에 `npm run control-plane:review-cycle:completion-held-command-resolution` 실행
- Review Dashboard에 `human_review_cycle_receipt_completion_held_command_resolution` stage와 plan/actor/protected/unblock/follow-on/error summary 추가
- Review API에서 `/api/human-review-cycle-completion-held-command-resolutions`, `/api/human-review-cycle-completion-held-command-resolution-plans`, `/api/human-review-cycle-completion-held-command-resolution-actors` route 제공
- Goal Checkpoint에서 Human Review Cycle Receipt Completion Held Command Resolution을 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-cycle:completion-held-command-resolution`
- `src/human-review-cycle-receipt-completion-held-command-resolution.mjs`
- `scripts/human-review-cycle-receipt-completion-held-command-resolution.mjs`
- `schemas/human-review-cycle-receipt-completion-held-command-resolution.schema.json`
- `docs/human-review-cycle-receipt-completion-held-command-resolution.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- held command resolution artifact가 schema validation을 통과함
- resolution status가 현재 held command 상태에서 `ready_for_actor_resolution`로 기록됨
- resolution plan count가 baseline held command blocker count와 일치함
- manual command receipt pack non-receipt blocker count와 command queue held item count가 resolution plan count와 일치함
- 각 held command에 required actor, unblock condition, follow-on action이 누락 없이 표시됨
- protected held command의 unblock condition이 explicit human approval로 표시됨
- command/protected action 실행 count가 항상 0임
- `/api/human-review-cycle-completion-held-command-resolutions?resolution_status=ready_for_actor_resolution`로 resolution artifact를 조회할 수 있음
- `/api/human-review-cycle-completion-held-command-resolution-plans?resolution_status=waiting_for_manual_input`으로 manual-input held command plan을 조회할 수 있음
- Dashboard summary가 held command resolution plan, actor, protected, unblock condition, follow-on action, missing field, error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-cycle:completion-held-command-resolution`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 92: Human Review Cycle Receipt Completion Protected Approval Request Pack

목표: protected held command를 manual command receipt와 분리해 explicit human approval 상태로 추적한다. Phase 91 held command resolution의 protected resolution plan만 approval request로 승격하고, actor별 approval input template을 생성하되 command 실행, protected action 실행, command receipt 수정, source artifact mutation은 하지 않는다.

- Held Command Resolution artifact를 입력으로 사용
- `requires_explicit_human_approval` 또는 protected follow-on action을 가진 plan만 approval request로 변환
- 각 approval request는 `pending_explicit_approval`, `explicit_human_approval`, `protected_action: true`, `separated_from_command_receipts: true`를 포함
- actor별 `protected-approval-request-pack.json`, `approval-input.json`, `README.md` 생성
- required approval field는 `decision`, `approved_by`, `approved_at`, `approval_scope`, `risk_acknowledgement`, `authorized_commands`, `notes`로 고정
- non-protected held command는 approval request에 섞이지 않도록 `non_protected_resolution_plan_ids`로만 추적
- safe handling은 `auto_execute_allowed: false`, `approval_request_pack_only: true`, `source_artifact_mutation_allowed: false`, `command_receipt_edits_allowed: false`, `commands_executed: false`, `protected_actions_executed: false`로 고정
- Control Plane Loop에서 held command resolution 뒤, human gate receipt application 전에 `npm run control-plane:review-cycle:completion-protected-approval-request-pack` 실행
- Review Dashboard에 `human_review_cycle_receipt_completion_protected_approval_request_pack` stage와 request/actor/pending/mixed/required-field/error summary 추가
- Review API에서 `/api/human-review-cycle-completion-protected-approval-request-packs`, `/api/human-review-cycle-completion-protected-approval-requests`, `/api/human-review-cycle-completion-protected-approval-actors` route 제공
- Goal Checkpoint에서 Human Review Cycle Receipt Completion Protected Approval Request Pack을 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-cycle:completion-protected-approval-request-pack`
- `src/human-review-cycle-receipt-completion-protected-approval-request-pack.mjs`
- `scripts/human-review-cycle-receipt-completion-protected-approval-request-pack.mjs`
- `schemas/human-review-cycle-receipt-completion-protected-approval-request-pack.schema.json`
- `docs/human-review-cycle-receipt-completion-protected-approval-request-pack.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- protected approval request pack artifact가 schema validation을 통과함
- pack status가 현재 protected hold 상태에서 `ready_for_explicit_approval`로 기록됨
- approval request count가 held command resolution protected resolution count와 일치함
- actor approval pack이 target approval input path와 required approval field를 누락 없이 포함함
- approval request가 command receipt와 섞이지 않고 `pending_explicit_approval` 상태로 유지됨
- non-protected held command가 approval request에 포함되지 않음
- command/protected action 실행 count가 항상 0임
- `/api/human-review-cycle-completion-protected-approval-request-packs?pack_status=ready_for_explicit_approval`로 pack artifact를 조회할 수 있음
- `/api/human-review-cycle-completion-protected-approval-requests?approval_status=pending_explicit_approval`로 pending explicit approval request를 조회할 수 있음
- Dashboard summary가 protected approval request, actor, pending, source protected, mixed, missing field, error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-cycle:completion-protected-approval-request-pack`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 93: Human Review Cycle Receipt Completion Manual Revalidation

목표: 수동 command receipt 재검증 루프를 닫는다. Manual Command Receipt Pack, Workspace Merge, Workspace Validation, Command Receipt Application, Protected Approval Request Pack을 대조해 사람이 실제로 입력한 receipt만 ready/applied 후보가 되도록 검증하되, receipt 수정, command 실행, protected action 실행은 하지 않는다.

- Manual Command Receipt Pack, Command Receipt Workspace Merge, Workspace Validation, Command Receipt Application, Protected Approval Request Pack artifact를 입력으로 사용
- manual command receipt pack item별로 revalidation item 생성
- `ready_or_applied_candidate`는 human-entered receipt인 경우에만 true가 됨
- human-entered receipt 조건은 terminal `receipt_status`, terminal `command_result`, non-automation `executed_by`, `executed_at`, `output_reference`, 정확한 `commands_run` 포함 여부로 판정
- pending placeholder receipt는 `pending_human_receipt`로 남기고 ready/applied 후보에 포함하지 않음
- protected approval request와 manual command receipt가 command/command gate 기준으로 겹치면 validation error 처리
- actor별 `manual-revalidation.json`, `README.md` 생성
- `ready-manual-receipts.json`는 human-entered ready receipt만 projection하고 적용/실행은 하지 않음
- safe handling은 `auto_execute_allowed: false`, `manual_revalidation_only: true`, `receipt_edits_must_be_manual: true`, `source_artifact_mutation_allowed: false`, `refresh_commands_executed: false`, `protected_actions_executed: false`로 고정
- Control Plane Loop에서 protected approval request pack 뒤, human gate receipt application 전에 `npm run control-plane:review-cycle:completion-manual-revalidation` 실행
- Review Dashboard에 `human_review_cycle_receipt_completion_manual_revalidation` stage와 item/actor/pending/ready/applied/non-human/protected-overlap/auto-executed/error summary 추가
- Review API에서 `/api/human-review-cycle-completion-manual-revalidations`, `/api/human-review-cycle-completion-manual-revalidation-items`, `/api/human-review-cycle-completion-manual-revalidation-actors`, `/api/human-review-cycle-completion-ready-manual-receipts` route 제공
- Goal Checkpoint에서 Human Review Cycle Receipt Completion Manual Revalidation을 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-cycle:completion-manual-revalidation`
- `src/human-review-cycle-receipt-completion-manual-revalidation.mjs`
- `scripts/human-review-cycle-receipt-completion-manual-revalidation.mjs`
- `schemas/human-review-cycle-receipt-completion-manual-revalidation.schema.json`
- `docs/human-review-cycle-receipt-completion-manual-revalidation.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- manual revalidation artifact가 schema validation을 통과함
- 현재 pending receipt 상태에서 revalidation status가 `waiting_for_human_receipts`로 기록됨
- revalidation item count가 manual command receipt pack item count와 일치함
- pending placeholder receipt는 ready/applied candidate가 되지 않음
- ready/applied candidate가 존재할 경우 모두 human-entered receipt임
- non-human ready/applied candidate, protected approval overlap, auto-executed receipt count가 0임
- command/protected action 실행 count가 항상 0임
- `/api/human-review-cycle-completion-manual-revalidations?revalidation_status=waiting_for_human_receipts`로 revalidation artifact를 조회할 수 있음
- `/api/human-review-cycle-completion-manual-revalidation-items?revalidation_status=pending_human_receipt`로 pending manual receipt item을 조회할 수 있음
- Dashboard summary가 manual revalidation item, actor, pending, ready/applied, non-human, protected-overlap, auto-executed, error count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-cycle:completion-manual-revalidation`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 94: Human Review Cycle Receipt Completion Command Queue Patch Projection

목표: command queue patch를 실행 전에 projection으로 검증한다. Manual Revalidation에서 human-entered ready/applied 후보로 확인된 receipt만 patch-ready가 될 수 있으며, 현재 pending receipt 상태에서는 모든 command queue target이 unchanged projection으로 유지된다. 이 단계는 command queue를 수정하거나 audit event를 emit하지 않는다.

- Command Queue, Manual Receipt Revalidation, Command Receipt Application artifact를 입력으로 사용
- manual revalidation item별로 command queue patch projection item 생성
- 각 projection item은 `before_state`, `after_state`, `patch_operations`, `audit_event_candidate`를 포함
- pending human receipt는 `waiting_for_human_receipt` projection으로 남고 before/after state는 동일하게 유지
- human-entered ready/applied candidate가 존재할 때만 `ready_for_patch_projection`과 emittable audit candidate가 생성됨
- non-human candidate, protected approval overlap, auto-executed receipt는 validation error로 차단
- safe handling은 `auto_execute_allowed: false`, `patch_projection_only: true`, `source_artifact_mutation_allowed: false`, `command_queue_patch_applied: false`, `commands_executed: false`, `audit_events_emitted: false`, `refresh_commands_executed: false`, `protected_actions_executed: false`로 고정
- Control Plane Loop에서 manual revalidation 뒤, human gate receipt application 전에 `npm run control-plane:review-cycle:completion-command-queue-patch-projection` 실행
- Review Dashboard에 `human_review_cycle_receipt_completion_command_queue_patch_projection` stage와 projection/target/operation/audit/error summary 추가
- Review API에서 `/api/human-review-cycle-completion-command-queue-patch-projections`, `/api/human-review-cycle-completion-command-queue-patch-projection-items`, `/api/human-review-cycle-completion-command-queue-patch-operations`, `/api/human-review-cycle-completion-command-queue-patch-audit-candidates` route 제공
- Goal Checkpoint에서 Command Queue Patch Projection을 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-cycle:completion-command-queue-patch-projection`
- `src/human-review-cycle-receipt-completion-command-queue-patch-projection.mjs`
- `scripts/human-review-cycle-receipt-completion-command-queue-patch-projection.mjs`
- `schemas/human-review-cycle-receipt-completion-command-queue-patch-projection.schema.json`
- `docs/human-review-cycle-receipt-completion-command-queue-patch-projection.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- patch projection artifact가 schema validation을 통과함
- projection item count가 manual revalidation item count와 일치함
- 모든 projection item이 command queue target, before state, after state, audit event candidate를 가짐
- patch target count가 projection item count와 일치하고 missing target count가 0임
- ready patch count가 manual revalidation ready/applied human candidate count와 일치함
- 현재 pending receipt 상태에서 patch operation count와 emittable audit candidate count가 0임
- non-human candidate, protected overlap, auto-executed receipt, blocked patch count가 0임
- patch application, command execution, audit event emission count가 항상 0임
- `/api/human-review-cycle-completion-command-queue-patch-projections?projection_status=waiting_for_human_receipts`로 projection artifact를 조회할 수 있음
- `/api/human-review-cycle-completion-command-queue-patch-projection-items?projection_status=waiting_for_human_receipt`로 pending projection item을 조회할 수 있음
- Dashboard summary가 projection item, target, ready/waiting, patch operation, audit candidate, missing target, error, execution count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-cycle:completion-command-queue-patch-projection`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 95: Human Review Cycle Receipt Completion Closeout Ledger

목표: Human Review Cycle receipt completion의 모든 blocker를 closeout ledger로 정규화한다. Baseline blocker를 기준으로 pending command receipt, held command, protected approval request를 하나의 ledger에 묶고, 각 blocker를 `pending`, `approved`, `rejected`, `superseded` 중 하나로만 표시한다. 이 단계는 closeout ledger만 생성하며 source artifact를 수정하거나 command, patch, audit event, protected action을 실행하지 않는다.

- Baseline, Manual Revalidation, Protected Approval Request Pack, Command Queue Patch Projection, Held Command Resolution artifact를 입력으로 사용
- baseline blocker마다 closeout item을 만들고 source blocker, reconciliation item, revalidation item, projection item, resolution plan, approval request 참조를 연결
- actor별 closeout summary를 만들어 human reviewer와 authorized operator의 남은 pending action을 분리
- normalized blocker status summary를 `pending`, `approved`, `rejected`, `superseded` 네 상태로 고정
- 현재 상태에서는 9개 blocker가 모두 `pending`이며, pending command receipt 5개, held command 4개, protected approval 1개를 dashboard/API/checkpoint가 그대로 반영
- safe handling은 `auto_execute_allowed: false`, `closeout_ledger_only: true`, `source_artifact_mutation_allowed: false`, `command_queue_patch_applied: false`, `commands_executed: false`, `audit_events_emitted: false`, `refresh_commands_executed: false`, `protected_actions_executed: false`로 고정
- Control Plane Loop에서 command queue patch projection 뒤, human gate receipt application 전에 `npm run control-plane:review-cycle:completion-closeout-ledger` 실행
- Review Dashboard에 `human_review_cycle_receipt_completion_closeout_ledger` stage와 closeout item, actor, normalized status, error, execution count summary 추가
- Review API에서 `/api/human-review-cycle-completion-closeout-ledgers`, `/api/human-review-cycle-completion-closeout-items`, `/api/human-review-cycle-completion-closeout-actors`, `/api/human-review-cycle-completion-normalized-blocker-statuses` route 제공
- Goal Checkpoint에서 Closeout Ledger를 별도 item으로 추적

현재 구현:

- `npm run control-plane:review-cycle:completion-closeout-ledger`
- `src/human-review-cycle-receipt-completion-closeout-ledger.mjs`
- `scripts/human-review-cycle-receipt-completion-closeout-ledger.mjs`
- `schemas/human-review-cycle-receipt-completion-closeout-ledger.schema.json`
- `docs/human-review-cycle-receipt-completion-closeout-ledger.md`
- `src/control-plane-loop.mjs`
- `src/review-dashboard.mjs`
- `src/review-api.mjs`

완료 기준:

- closeout ledger artifact가 schema validation을 통과함
- closeout item count가 baseline blocker count와 일치함
- actor closeout이 모든 required actor를 포함함
- `pending`, `approved`, `rejected`, `superseded` count 합계가 closeout item count와 일치하고 unknown status count가 0임
- 현재 pending 상태에서 pending count가 closeout item count와 일치하고 approved/rejected/superseded count가 0임
- pending command receipt, held command, protected approval count가 source artifact count와 일치함
- patch application, command execution, audit event emission, protected action execution count가 항상 0임
- `/api/human-review-cycle-completion-closeout-ledgers?closeout_status=open_pending`로 ledger artifact를 조회할 수 있음
- `/api/human-review-cycle-completion-closeout-items?normalized_status=pending`으로 pending closeout item을 조회할 수 있음
- `/api/human-review-cycle-completion-closeout-actors?required_actor=human_reviewer`로 actor closeout을 조회할 수 있음
- `/api/human-review-cycle-completion-normalized-blocker-statuses?normalized_status=pending`으로 normalized status summary를 조회할 수 있음
- Dashboard summary가 closeout item, actor, pending/approved/rejected/superseded, unknown, source baseline, execution count를 반영함
- `npm test`, `npm run validate`, `npm run control-plane:review-cycle:completion-closeout-ledger`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 96: Human Review v1 Regression Freeze

Phase 96은 Human Review Cycle Closure v1을 다음 트랙으로 넘기기 전에 회귀 기준으로 동결했다.

구현:

- `npm run control-plane:review-cycle:freeze`
- `src/human-review-v1-regression-freeze.mjs`
- `scripts/human-review-v1-regression-freeze.mjs`
- `schemas/human-review-v1-regression-freeze.schema.json`
- `docs/human-review-v1-regression-freeze.md`

핵심 산출물:

- `artifacts/human-review-v1-regression-freeze/latest/human-review-v1-regression-freeze.json`
- `artifacts/human-review-v1-regression-freeze/latest/regression-fixture.json`
- `artifacts/human-review-v1-regression-freeze/latest/artifact-manifest.json`
- `artifacts/human-review-v1-regression-freeze/latest/verification-checkpoints.json`
- `artifacts/human-review-v1-regression-freeze/latest/freeze-note.json`
- `artifacts/human-review-v1-regression-freeze/latest/summary.md`

완료 기준:

- Phase 89-95 closure artifact의 hash manifest와 invariant snapshot을 생성함
- `frozen_with_pending_human_actions` 상태로 수동 처리 필요 항목을 유지하면서 P097 진행 가능성을 명시함
- closeout item count, baseline blocker count, manual pack, held command, protected approval, revalidation, patch projection count가 서로 일치함
- control-plane loop가 passed이고 failed/missing artifact step이 0임
- freeze command가 source artifact 수정, command execution, patch application, audit event emission, protected action execution을 수행하지 않음
- Dashboard stage, goal checkpoint, Review API route가 freeze artifact를 노출함
- `/api/human-review-v1-regression-freezes?freeze_status=frozen_with_pending_human_actions`로 freeze artifact를 조회할 수 있음
- `/api/human-review-v1-regression-fixture-artifacts?available=true`로 frozen fixture source refs를 조회할 수 있음
- `/api/human-review-v1-regression-checkpoints?checkpoint_status=passed`로 verification checkpoint를 조회할 수 있음
- `/api/human-review-v1-freeze-notes?freeze_status=frozen_with_pending_human_actions`로 freeze note를 조회할 수 있음
- `npm test`, `npm run validate`, `npm run control-plane:review-cycle:freeze`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 97: Contract Inventory and Owner Map

Phase 97은 Core Contracts, Schema, Migration Spine 트랙의 첫 단계로 현재 계약 표면을 전수 inventory화했다.

구현:

- `npm run contracts:inventory`
- `src/contract-inventory.mjs`
- `scripts/contract-inventory.mjs`
- `schemas/contract-inventory.schema.json`
- `docs/contract-inventory.md`

핵심 산출물:

- `artifacts/contract-inventory/latest/contract-inventory.json`
- `artifacts/contract-inventory/latest/schema-inventory.json`
- `artifacts/contract-inventory/latest/script-output-contracts.json`
- `artifacts/contract-inventory/latest/dashboard-api-artifacts.json`
- `artifacts/contract-inventory/latest/owner-map.json`
- `artifacts/contract-inventory/latest/summary.md`

완료 기준:

- `schemas/`의 모든 JSON schema가 목록화되고 parse 상태와 content hash가 기록됨
- `package.json`의 모든 script와 `src/control-plane-loop.mjs`의 expected artifact contract가 목록화됨
- Review Dashboard source와 Review API route index가 목록화됨
- dashboard/loop artifact path가 artifact contract로 중복 제거되어 기록됨
- 모든 inventory item에 owner area, plane, domain pack, stability tier가 포함된 owner map entry가 존재함
- Dashboard stage와 goal checkpoint가 `contract_inventory`를 추적함
- Review API에서 `/api/contract-inventories`, `/api/contract-inventory-items`, `/api/contract-schemas`, `/api/contract-artifacts`, `/api/contract-owner-map` route를 제공함
- `npm test`, `npm run validate`, `npm run contracts:inventory`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 98: Contract Dependency Map and Breaking Risk List

Phase 98은 Phase 97 inventory를 입력으로 삼아 contract 간 dependency graph와 breaking-change risk list를 생성했다.

구현:

- `npm run contracts:dependencies`
- `src/contract-dependency-map.mjs`
- `scripts/contract-dependency-map.mjs`
- `schemas/contract-dependency-map.schema.json`
- `docs/contract-dependency-map.md`

핵심 산출물:

- `artifacts/contract-dependency-map/latest/contract-dependency-map.json`
- `artifacts/contract-dependency-map/latest/dependency-graph.json`
- `artifacts/contract-dependency-map/latest/breaking-change-risks.json`
- `artifacts/contract-dependency-map/latest/owner-dependency-map.json`
- `artifacts/contract-dependency-map/latest/summary.md`

완료 기준:

- schema -> artifact contract -> dashboard source -> Review API route 의존 방향이 graph edge로 기록됨
- package script -> control-plane loop output contract -> artifact contract 연결이 기록됨
- owner area 간 dependency aggregate와 cross-owner edge count가 기록됨
- schema version, artifact schema mapping, dashboard/API source mapping, script/output artifact coverage에 대한 breaking-change risk list가 생성됨
- Dashboard stage와 goal checkpoint가 `contract_dependency_map`을 추적함
- Review API에서 `/api/contract-dependency-maps`, `/api/contract-dependency-nodes`, `/api/contract-dependency-edges`, `/api/contract-breaking-change-risks`, `/api/contract-owner-dependencies` route를 제공함
- `npm test`, `npm run validate`, `npm run contracts:inventory`, `npm run contracts:dependencies`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 99: Resource and ResourceVersion v2 Contract Freeze

Phase 99는 기존 `resource-evidence.v1` ingest 결과를 입력으로 `resource-core.v2`와 `resource-version.v2` fixture를 생성하고 Resource plane의 필수 계약을 고정했다.

구현:

- `npm run contracts:resources`
- `src/resource-contract-freeze.mjs`
- `scripts/resource-contract-freeze.mjs`
- `schemas/resource-contract-freeze.schema.json`
- `docs/resource-contract-freeze.md`

핵심 산출물:

- `artifacts/resource-contract-freeze/latest/resource-contract-freeze.json`
- `artifacts/resource-contract-freeze/latest/resource-contract-v2-fixture.json`
- `artifacts/resource-contract-freeze/latest/resource-version-v2-fixture.json`
- `artifacts/resource-contract-freeze/latest/validation-report.json`
- `artifacts/resource-contract-freeze/latest/summary.md`

완료 기준:

- Resource v2 fixture가 `content_hash`, `source_system`, `external_id`, `classification`, `matter_id`, `latest_resource_version_id`를 필수 계약으로 가진다
- ResourceVersion v2 fixture가 `resource_id`, `source_system`, `external_id`, `classification`, `matter_id`, `content_hash`, `version_status`를 보존한다
- Resource와 현재 ResourceVersion의 content hash가 일치하는지 validation item으로 검증된다
- source system별 external id 중복 여부가 validation item으로 남는다
- Dashboard stage와 goal checkpoint가 `resource_contract_freeze`를 추적함
- Review API에서 `/api/resource-contract-freezes`, `/api/resource-v2-contracts`, `/api/resource-version-v2-contracts`, `/api/resource-contract-validations` route를 제공함
- `npm test`, `npm run validate`, `npm run contracts:resources`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 100: Matter, Client, Party, Team, and Boundary v2 Contract Freeze

Phase 100은 기존 `identity_policy.v1`를 입력으로 `client.v2`, `party.v2`, `matter-core.v2`, `matter-team.v2`, `matter-boundary.v2` fixture를 생성하고 Matter Boundary plane의 필수 계약을 고정했다.

구현:

- `npm run contracts:matters`
- `src/matter-contract-freeze.mjs`
- `scripts/matter-contract-freeze.mjs`
- `schemas/matter-contract-freeze.schema.json`
- `docs/matter-contract-freeze.md`

핵심 산출물:

- `artifacts/matter-contract-freeze/latest/matter-contract-freeze.json`
- `artifacts/matter-contract-freeze/latest/matter-contract-v2-fixture.json`
- `artifacts/matter-contract-freeze/latest/party-contract-v2-fixture.json`
- `artifacts/matter-contract-freeze/latest/matter-boundary-v2-fixture.json`
- `artifacts/matter-contract-freeze/latest/validation-report.json`
- `artifacts/matter-contract-freeze/latest/summary.md`

완료 기준:

- Client v2 fixture가 `client_id`, `tenant_id`, `display_name`, `classification_floor`, `default_policy_snapshot_id`를 필수 계약으로 가진다
- Party v2 fixture가 client와 counterparty를 같은 party registry 안에 보존하고, counterparty는 matter link를 가진다
- Matter v2 fixture가 `client_id`, `matter_team_id`, `party_ids`, `counterparty_party_ids`, `wall_ids`, `default_policy_snapshot_id`를 필수 계약으로 가진다
- MatterTeam v2 fixture가 member role, responsible partner, wall id를 검증한다
- MatterBoundary v2 fixture가 tenant/client/matter/team/wall/classification retrieval filter를 노출한다
- Dashboard stage와 goal checkpoint가 `matter_contract_freeze`를 추적함
- Review API에서 `/api/matter-contract-freezes`, `/api/client-v2-contracts`, `/api/party-v2-contracts`, `/api/matter-v2-contracts`, `/api/matter-team-v2-contracts`, `/api/matter-boundary-v2-contracts`, `/api/matter-contract-validations` route를 제공함
- `npm test`, `npm run validate`, `npm run contracts:matters`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 101: Data Classification and Policy Reference v2 Contract Freeze

Phase 101은 Policy Matrix, Policy Snapshot Ledger, Resource v2 contract, Matter Boundary v2 contract를 입력으로 `data-classification.v2`, `policy-reference.v2`, `policy-decision.v2` fixture를 생성하고 Policy plane의 필수 계약을 고정했다.

구현:

- `npm run contracts:policies`
- `src/policy-contract-freeze.mjs`
- `scripts/policy-contract-freeze.mjs`
- `schemas/policy-contract-freeze.schema.json`
- `docs/policy-contract-freeze.md`

핵심 산출물:

- `artifacts/policy-contract-freeze/latest/policy-contract-freeze.json`
- `artifacts/policy-contract-freeze/latest/data-classification-v2-fixture.json`
- `artifacts/policy-contract-freeze/latest/policy-reference-v2-fixture.json`
- `artifacts/policy-contract-freeze/latest/policy-decision-v2-fixture.json`
- `artifacts/policy-contract-freeze/latest/validation-report.json`
- `artifacts/policy-contract-freeze/latest/summary.md`

완료 기준:

- `P0_PUBLIC`부터 `P5_SECRET`까지 6개 classification이 `data-classification.v2` fixture로 존재한다
- 각 classification이 runtime rule, model rule, required gate, external/local model policy, redaction policy를 가진다
- `P3_PRIVILEGED`, `P4_HIGHLY_RESTRICTED`, `P5_SECRET`은 external model policy가 `forbidden`으로 고정된다
- Policy Snapshot Ledger의 snapshot, workflow, event, run-ledger reference가 `policy-reference.v2`로 정규화된다
- Resource v2와 Matter/Client/Boundary v2의 policy snapshot reference가 canonical snapshot id로 resolved 상태를 가진다
- Dashboard stage와 goal checkpoint가 `policy_contract_freeze`를 추적함
- Review API에서 `/api/policy-contract-freezes`, `/api/data-classification-contracts`, `/api/policy-reference-contracts`, `/api/policy-decision-contracts`, `/api/policy-contract-validations` route를 제공함
- `npm test`, `npm run validate`, `npm run contracts:policies`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 102: Evidence, Fact, Issue, Citation, and Lineage v2 Contract Freeze

Phase 102는 Law Firm LDD slice, Resource v2 contract, Matter Boundary v2 contract, PolicyReference v2 contract를 입력으로 Evidence plane의 필수 lineage 계약을 고정했다. 목적은 후속 Evidence Store 구현 전에 `source_span -> evidence -> fact -> issue -> citation` 경로가 데이터 객체 수준에서 끊기지 않도록 만드는 것이다.

구현:

- `npm run contracts:evidence`
- `src/evidence-contract-freeze.mjs`
- `scripts/evidence-contract-freeze.mjs`
- `schemas/evidence-contract-freeze.schema.json`
- `docs/evidence-contract-freeze.md`

핵심 산출물:

- `artifacts/evidence-contract-freeze/latest/evidence-contract-freeze.json`
- `artifacts/evidence-contract-freeze/latest/source-span-v2-fixture.json`
- `artifacts/evidence-contract-freeze/latest/evidence-item-v2-fixture.json`
- `artifacts/evidence-contract-freeze/latest/fact-claim-v2-fixture.json`
- `artifacts/evidence-contract-freeze/latest/issue-v2-fixture.json`
- `artifacts/evidence-contract-freeze/latest/citation-v2-fixture.json`
- `artifacts/evidence-contract-freeze/latest/lineage-edge-v2-fixture.json`
- `artifacts/evidence-contract-freeze/latest/validation-report.json`
- `artifacts/evidence-contract-freeze/latest/summary.md`

완료 기준:

- `source-span.v2`, `evidence-item.v2`, `fact-claim.v2`, `issue.v2`, `citation.v2`, `evidence-lineage-edge.v2` fixture가 생성됨
- 모든 SourceSpan이 Resource v2, ResourceVersion, matter id, classification, policy snapshot을 보존함
- 모든 EvidenceItem이 SourceSpan, matter, classification, policy snapshot을 보존함
- 모든 FactClaim이 EvidenceItem에 연결되고 confidence/review status를 보존함
- 모든 Issue가 FactClaim과 EvidenceItem lineage를 보존함
- 모든 Citation이 SourceSpan, EvidenceItem, FactClaim, Issue를 거쳐 `bound` 상태가 됨
- Dashboard stage와 goal checkpoint가 `evidence_contract_freeze`를 추적함
- Review API에서 `/api/evidence-contract-freezes`, `/api/source-span-contracts`, `/api/evidence-item-contracts`, `/api/fact-claim-contracts`, `/api/issue-contracts`, `/api/citation-contracts`, `/api/evidence-lineage-edges`, `/api/evidence-contract-validations` route를 제공함
- `npm test`, `npm run validate`, `npm run contracts:evidence`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 103: Capability, Workflow, Run, Gate, Runtime, and IO v2 Contract Freeze

Phase 103은 Domain Pack Registry의 capability manifest와 세 vertical slice의 `workflow_runtime`을 입력으로 Capability/Workflow plane의 실행 계약을 고정했다. 목적은 후속 Runtime Adapter, Gate Engine, Context Builder 단계가 prompt나 self-report가 아니라 `input/output/gate/runtime/version` 필드가 명시된 계약을 기준으로 움직이게 만드는 것이다.

구현:

- `npm run contracts:capabilities`
- `src/capability-workflow-contract-freeze.mjs`
- `scripts/capability-workflow-contract-freeze.mjs`
- `schemas/capability-workflow-contract-freeze.schema.json`
- `docs/capability-workflow-contract-freeze.md`

핵심 산출물:

- `artifacts/capability-workflow-contract-freeze/latest/capability-workflow-contract-freeze.json`
- `artifacts/capability-workflow-contract-freeze/latest/capability-manifest-v2-fixture.json`
- `artifacts/capability-workflow-contract-freeze/latest/workflow-v2-fixture.json`
- `artifacts/capability-workflow-contract-freeze/latest/workflow-run-v2-fixture.json`
- `artifacts/capability-workflow-contract-freeze/latest/agent-run-v2-fixture.json`
- `artifacts/capability-workflow-contract-freeze/latest/capability-io-contract-v2-fixture.json`
- `artifacts/capability-workflow-contract-freeze/latest/capability-gate-runtime-contract-v2-fixture.json`
- `artifacts/capability-workflow-contract-freeze/latest/workflow-execution-bindings.json`
- `artifacts/capability-workflow-contract-freeze/latest/validation-report.json`
- `artifacts/capability-workflow-contract-freeze/latest/summary.md`

완료 기준:

- `capability-manifest.v2`, `workflow.v2`, `workflow-run.v2`, `agent-run.v2`, `capability-io-contract.v2`, `capability-gate-runtime-contract.v2` fixture가 생성됨
- CapabilityManifest v2가 input/output schema, required resources, required gates, allowed runtimes, version, policy, approval, idempotency, retry, timeout, cost, observability 필드를 보존함
- Workflow v2가 capability link, step input refs, output contract, runtime binding, gate binding, state machine을 보존함
- WorkflowRun v2와 AgentRun v2가 workflow/capability/runtime/policy snapshot linkage를 보존함
- Field requirement matrix가 capability, workflow, workflow run, agent run의 required/optional 필드를 구분함
- Runtime binding이 capability의 allowed runtime에 모두 포함되어 blocked runtime count가 0임
- Dashboard stage와 goal checkpoint가 `capability_workflow_contract_freeze`를 추적함
- Review API에서 `/api/capability-workflow-contract-freezes`, `/api/capability-manifest-v2-contracts`, `/api/workflow-v2-contracts`, `/api/workflow-run-v2-contracts`, `/api/agent-run-v2-contracts`, `/api/capability-io-contracts`, `/api/capability-gate-runtime-contracts`, `/api/workflow-execution-bindings`, `/api/capability-workflow-contract-validations` route를 제공함
- `npm test`, `npm run validate`, `npm run contracts:capabilities`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 104: Runtime Adapter and AgentRun Runtime v2 Contract Freeze

Phase 104는 `runtime-adapter-registry.v1`, `runtime-command-bindings.v1`, Phase 103의 AgentRun v2, Observability Catalog, Output Artifact Catalog를 연결해 Runtime/AgentRun plane의 실행 계약을 고정했다. 목적은 Claude Code, Codex, Hermes, local script, document renderer의 self-report를 직접 신뢰하지 않고, output/log/artifact/risk/verification 의무를 모두 계약 객체로 검증하는 것이다.

구현:

- `npm run contracts:runtimes`
- `src/runtime-agentrun-contract-freeze.mjs`
- `scripts/runtime-agentrun-contract-freeze.mjs`
- `schemas/runtime-agentrun-contract-freeze.schema.json`
- `docs/runtime-agentrun-contract-freeze.md`

핵심 산출물:

- `artifacts/runtime-agentrun-contract-freeze/latest/runtime-agentrun-contract-freeze.json`
- `artifacts/runtime-agentrun-contract-freeze/latest/runtime-adapter-v2-fixture.json`
- `artifacts/runtime-agentrun-contract-freeze/latest/runtime-execution-contract-v2-fixture.json`
- `artifacts/runtime-agentrun-contract-freeze/latest/agent-run-runtime-v2-fixture.json`
- `artifacts/runtime-agentrun-contract-freeze/latest/runtime-output-contract-v2-fixture.json`
- `artifacts/runtime-agentrun-contract-freeze/latest/runtime-log-contract-v2-fixture.json`
- `artifacts/runtime-agentrun-contract-freeze/latest/runtime-artifact-contract-v2-fixture.json`
- `artifacts/runtime-agentrun-contract-freeze/latest/runtime-verification-contract-v2-fixture.json`
- `artifacts/runtime-agentrun-contract-freeze/latest/validation-report.json`
- `artifacts/runtime-agentrun-contract-freeze/latest/summary.md`

완료 기준:

- `runtime-adapter.v2`, `runtime-execution-contract.v2`, `agent-run-runtime.v2`, `runtime-output-contract.v2`, `runtime-log-contract.v2`, `runtime-artifact-contract.v2`, `runtime-verification-contract.v2` fixture가 생성됨
- RuntimeAdapter v2가 risk level, execution environment, input/output trust, workspace policy, tool policy, lifecycle, observability, verification, data access, command binding을 보존함
- AgentRun runtime v2가 adapter id, runtime risk level, output ref/hash, log ref, artifact refs, output trust, verification required flag를 보존함
- RuntimeOutput/RuntimeLog/RuntimeArtifact/RuntimeVerification contract가 AgentRun별로 생성되고 high-risk/untrusted runtime은 verification gate를 요구함
- Required log는 모두 `captured` 상태이며 artifact capture required run은 `captured` 또는 `reference_only`로 추적됨
- Dashboard stage와 goal checkpoint가 `runtime_agentrun_contract_freeze`를 추적함
- Review API에서 `/api/runtime-agentrun-contract-freezes`, `/api/runtime-adapter-v2-contracts`, `/api/runtime-execution-contracts`, `/api/agent-run-runtime-contracts`, `/api/runtime-output-contracts`, `/api/runtime-log-contracts`, `/api/runtime-artifact-contracts`, `/api/runtime-verification-contracts`, `/api/runtime-agentrun-contract-validations` route를 제공함
- `npm test`, `npm run validate`, `npm run contracts:runtimes`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 105 - Gate/Approval Contract Freeze

목표: `gate-result.v1`과 `approval.v1`/approval queue/inbox를 v2 계약으로 투영해, GateResult는 게이트 판단만 보존하고 Human Approval은 별도 ApprovalRequest/ApprovalDecision/Authority 객체로 남도록 고정한다.

구현 산출물:

- `src/gate-approval-contract-freeze.mjs`
- `scripts/gate-approval-contract-freeze.mjs`
- `schemas/gate-approval-contract-freeze.schema.json`
- `docs/gate-approval-contract-freeze.md`
- `artifacts/gate-approval-contract-freeze/latest/gate-approval-contract-freeze.json`
- `artifacts/gate-approval-contract-freeze/latest/gate-result-v2-fixture.json`
- `artifacts/gate-approval-contract-freeze/latest/approval-request-v2-fixture.json`
- `artifacts/gate-approval-contract-freeze/latest/approval-decision-v2-fixture.json`
- `artifacts/gate-approval-contract-freeze/latest/human-gate-contract-v2-fixture.json`
- `artifacts/gate-approval-contract-freeze/latest/approval-authority-contract-v2-fixture.json`
- `artifacts/gate-approval-contract-freeze/latest/gate-approval-binding-v2-fixture.json`
- `artifacts/gate-approval-contract-freeze/latest/validation-report.json`
- `artifacts/gate-approval-contract-freeze/latest/summary.md`

완료 기준:

- `gate-result.v2`, `approval-request.v2`, `approval-decision.v2`, `human-gate-contract.v2`, `approval-authority-contract.v2`, `gate-approval-binding.v2` fixture가 생성됨
- `GateResult v2`는 `approval_status`나 `decision`을 직접 보유하지 않고, gate outcome, stage, blocking, findings, event/policy/workflow link만 보존함
- `human_approval_gate`는 별도 `ApprovalRequest v2`에 연결되고 `gate-approval-binding.v2`가 해당 관계를 명시함
- governance output approval, approval queue, approval inbox, protected approval request pack, approval decision result가 같은 v2 계약 아래에 투영됨
- Human gate item은 `human-gate-contract.v2`로, 각 approval request의 승인 주체는 `approval-authority-contract.v2`로 분리됨
- Dashboard stage와 summary가 `gate_approval_contract_freeze` 지표를 추적함
- Review API에서 `/api/gate-approval-contract-freezes`, `/api/gate-result-contracts`, `/api/approval-request-contracts`, `/api/approval-decision-contracts`, `/api/human-gate-v2-contracts`, `/api/approval-authority-contracts`, `/api/gate-approval-bindings`, `/api/gate-approval-contract-validations` route를 제공함
- `npm test`, `npm run validate`, `npm run contracts:gates`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 106 - Output/Delivery Contract Freeze

목표: 생성 산출물과 보호된 전달 행위, 전달 receipt를 v2 계약으로 분리해 OutputArtifact가 곧바로 발송/전달을 의미하지 않도록 고정한다.

구현 산출물:

- `src/output-delivery-contract-freeze.mjs`
- `scripts/output-delivery-contract-freeze.mjs`
- `schemas/output-delivery-contract-freeze.schema.json`
- `docs/output-delivery-contract-freeze.md`
- `artifacts/output-delivery-contract-freeze/latest/output-delivery-contract-freeze.json`
- `artifacts/output-delivery-contract-freeze/latest/output-artifact-v2-fixture.json`
- `artifacts/output-delivery-contract-freeze/latest/delivery-action-v2-fixture.json`
- `artifacts/output-delivery-contract-freeze/latest/delivery-receipt-v2-fixture.json`
- `artifacts/output-delivery-contract-freeze/latest/output-delivery-binding-v2-fixture.json`
- `artifacts/output-delivery-contract-freeze/latest/delivery-state-transition-v2-fixture.json`
- `artifacts/output-delivery-contract-freeze/latest/validation-report.json`
- `artifacts/output-delivery-contract-freeze/latest/summary.md`

완료 기준:

- `output-artifact.v2`, `delivery-action.v2`, `delivery-receipt.v2`, `output-delivery-binding.v2`, `delivery-state-transition.v2` fixture가 생성됨
- 모든 OutputArtifact v2가 `tenant_id`, `matter_id`, `workflow_run_id`, `content_hash`, approval request link, delivery action link를 보존함
- pending approval artifact는 별도 `ApprovalRequest v2`에 연결되고, delivery는 별도 `DeliveryAction v2`에 연결됨
- protected delivery action은 human approval requirement와 draft-only 상태를 보존하고 receipt 없이는 executed로 취급되지 않음
- 전달 receipt는 DeliveryReceipt v2로 분리되며 delivered receipt에는 실행자, 실행시각, delivery reference가 요구됨
- Dashboard stage와 summary가 `output_delivery_contract_freeze` 지표를 추적함
- Review API에서 `/api/output-delivery-contract-freezes`, `/api/output-artifact-v2-contracts`, `/api/delivery-action-v2-contracts`, `/api/delivery-receipt-v2-contracts`, `/api/output-delivery-bindings`, `/api/delivery-state-transitions`, `/api/output-delivery-contract-validations` route를 제공함
- `npm test`, `npm run validate`, `npm run contracts:outputs`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 107 - Event/Audit/Run Ledger Contract Freeze

목표: EventRecord, AuditEvent, RunLedger를 v2 계약으로 고정해 모든 주요 실행 기록이 correlation id, actor, policy snapshot, schema version을 보존하도록 한다.

구현 산출물:

- `src/event-audit-run-contract-freeze.mjs`
- `scripts/event-audit-run-contract-freeze.mjs`
- `schemas/event-audit-run-contract-freeze.schema.json`
- `docs/event-audit-run-contract-freeze.md`
- `artifacts/event-audit-run-contract-freeze/latest/event-audit-run-contract-freeze.json`
- `artifacts/event-audit-run-contract-freeze/latest/event-record-v2-fixture.json`
- `artifacts/event-audit-run-contract-freeze/latest/audit-event-v2-fixture.json`
- `artifacts/event-audit-run-contract-freeze/latest/run-ledger-v2-fixture.json`
- `artifacts/event-audit-run-contract-freeze/latest/event-run-binding-v2-fixture.json`
- `artifacts/event-audit-run-contract-freeze/latest/validation-report.json`
- `artifacts/event-audit-run-contract-freeze/latest/summary.md`

완료 기준:

- `event-record.v2`, `audit-event.v2`, `run-ledger.v2`, `event-run-binding.v2` fixture가 생성됨
- 모든 EventRecord v2가 correlation id, actor, subject, policy snapshot, schema version, RunLedger link를 보존함
- AuditEvent v2는 RunLedger에 연결되거나 external control event로 명시되어 audit-only 행위와 workflow-linked 행위가 구분됨
- RunLedger v2는 workflow run, capability, matter, policy snapshot, event id, agent run id, gate/approval/output link를 보존함
- EventRunBinding v2가 event/audit record와 run ledger를 correlation id로 연결함
- Dashboard stage와 summary가 `event_audit_run_contract_freeze` 지표를 추적함
- Review API에서 `/api/event-audit-run-contract-freezes`, `/api/event-record-v2-contracts`, `/api/audit-event-v2-contracts`, `/api/run-ledger-v2-contracts`, `/api/event-run-bindings`, `/api/event-audit-run-contract-validations` route를 제공함
- `npm test`, `npm run validate`, `npm run contracts:events`, `npm run dashboard:build`, `npm run api:smoke`, `npm run control-plane:loop`가 통과함

## Phase 108 - Error/Cost/Observability Contract Freeze

목표: ErrorRecord, CostObservation, TraceProjection을 v2 계약으로 고정해 실패, retry, token, cost, latency가 Event/Run Ledger와 분리된 독립 projection으로 남도록 한다.

구현 산출물:

- `src/error-cost-observability-contract-freeze.mjs`
- `scripts/error-cost-observability-contract-freeze.mjs`
- `schemas/error-cost-observability-contract-freeze.schema.json`
- `docs/error-cost-observability-contract-freeze.md`
- `artifacts/error-cost-observability-contract-freeze/latest/error-cost-observability-contract-freeze.json`
- `artifacts/error-cost-observability-contract-freeze/latest/error-record-v2-fixture.json`
- `artifacts/error-cost-observability-contract-freeze/latest/cost-observation-v2-fixture.json`
- `artifacts/error-cost-observability-contract-freeze/latest/trace-projection-v2-fixture.json`
- `artifacts/error-cost-observability-contract-freeze/latest/validation-report.json`
- `artifacts/error-cost-observability-contract-freeze/latest/summary.md`

완료 기준:

- `error-record.v2`, `cost-observation.v2`, `trace-projection.v2` fixture가 생성됨
- ErrorRecord v2가 `run_blocked`, `gate_failed`, retry 가능성, blocking 여부, correlation id, policy snapshot을 보존함
- CostObservation v2가 attribution, token usage, budget alert, projected cost, token count, runtime seconds를 한 레코드로 연결함
- TraceProjection v2가 RunLedger, event, audit event, error record, cost observation, latency, retry 상태를 workflow run 단위로 연결함
- Dashboard stage와 summary가 `error_cost_observability_contract_freeze` 지표를 추적함
- Review API에서 `/api/error-cost-observability-contract-freezes`, `/api/error-record-v2-contracts`, `/api/cost-observation-v2-contracts`, `/api/trace-projection-v2-contracts`, `/api/error-cost-observability-contract-validations` route를 제공함
- Control Plane Loop와 Goal Checkpoint가 Error/Cost/Observability contract freeze를 독립 단계와 checkpoint로 검증함
- `npm test`, `npm run validate`, `npm run contracts:observability`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 109 - Schema Versioning Rules

목표: schema versioning guideline을 확정해 optional addition, deprecation, migration manifest rule이 문서와 validator에서 함께 검증되도록 한다.

구현 산출물:

- `src/schema-versioning-rules.mjs`
- `scripts/schema-versioning-rules.mjs`
- `schemas/schema-versioning-rules.schema.json`
- `docs/schema-versioning-rules.md`
- `artifacts/schema-versioning-rules/latest/schema-versioning-rules.json`
- `artifacts/schema-versioning-rules/latest/schema-versioning-guideline.json`
- `artifacts/schema-versioning-rules/latest/schema-version-records.json`
- `artifacts/schema-versioning-rules/latest/legacy-schema-exceptions.json`
- `artifacts/schema-versioning-rules/latest/validation-report.json`
- `artifacts/schema-versioning-rules/latest/summary.md`

완료 기준:

- 모든 non-legacy schema가 `*.vN` schema version const와 required `schema_version` field를 가진다.
- `matter.schema.json`, `dev-projects.schema.json`은 legacy exception으로 reason, containment, migration target을 가진다.
- optional addition rule은 새 field를 기본 optional로 요구하고 closed-world schema를 차단한다.
- deprecation rule은 field 제거 전에 deprecated/replaced/removed metadata를 요구한다.
- migration rule은 breaking change에 migration manifest를 요구하고 data migration과 index migration을 분리한다.
- Dashboard stage와 summary가 `schema_versioning_rules` 지표를 추적함
- Review API에서 `/api/schema-versioning-rules`, `/api/schema-version-policies`, `/api/schema-version-records`, `/api/schema-legacy-exceptions`, `/api/schema-versioning-validations` route를 제공함
- Control Plane Loop와 Goal Checkpoint가 Schema Versioning Rules를 독립 단계와 checkpoint로 검증함
- `npm test`, `npm run validate`, `npm run contracts:versioning`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 110 - Schema Migration Manifest

목표: Phase 109의 schema versioning rule을 실제 migration manifest 구조로 승격해 core/pack/index migration이 분리되어 추적되도록 한다.

구현 산출물:

- `src/schema-migration-manifest.mjs`
- `scripts/schema-migration-manifest.mjs`
- `schemas/schema-migration-manifest.schema.json`
- `docs/schema-migration-manifest.md`
- `artifacts/schema-migration-manifest/latest/schema-migration-manifest-ledger.json`
- `artifacts/schema-migration-manifest/latest/migration-manifest-schema.json`
- `artifacts/schema-migration-manifest/latest/core-migration-manifest.json`
- `artifacts/schema-migration-manifest/latest/pack-migration-manifest.json`
- `artifacts/schema-migration-manifest/latest/index-migration-manifest.json`
- `artifacts/schema-migration-manifest/latest/migration-records.json`
- `artifacts/schema-migration-manifest/latest/validation-report.json`
- `artifacts/schema-migration-manifest/latest/summary.md`

완료 기준:

- Phase 109 `schema_versioning_rules` artifact를 입력으로 받아 migration manifest ledger를 생성한다.
- `core`, `pack`, `index` scope가 각각 독립 manifest로 선언된다.
- 각 manifest는 data migration steps와 index migration steps를 분리하고 dry-run command, rollback note, validation command를 가진다.
- legacy schema exception인 `matter`, `dev-projects`가 core migration coverage로 추적된다.
- migration record가 manifest별로 생성되고 dry-run status는 아직 실행되지 않은 상태로 유지된다.
- Dashboard stage와 summary가 `schema_migration_manifest` 지표를 추적함
- Review API에서 `/api/schema-migration-manifests`, `/api/schema-migration-manifest-records`, `/api/schema-migration-records`, `/api/schema-migration-validations` route를 제공함
- Control Plane Loop와 Goal Checkpoint가 Schema Migration Manifest를 독립 단계와 checkpoint로 검증함
- `npm test`, `npm run validate`, `npm run contracts:migrations`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 111 - Contract Golden Fixtures

목표: 대표 contract artifact를 golden fixture set으로 고정해 schema validation과 regression hash test에 사용한다.

구현 산출물:

- `src/contract-golden-fixtures.mjs`
- `scripts/contract-golden-fixtures.mjs`
- `schemas/contract-golden-fixtures.schema.json`
- `docs/contract-golden-fixtures.md`
- `artifacts/contract-golden-fixtures/latest/contract-golden-fixtures.json`
- `artifacts/contract-golden-fixtures/latest/golden-fixture-manifest.json`
- `artifacts/contract-golden-fixtures/latest/golden-fixture-records.json`
- `artifacts/contract-golden-fixtures/latest/regression-hash-manifest.json`
- `artifacts/contract-golden-fixtures/latest/validation-report.json`
- `artifacts/contract-golden-fixtures/latest/summary.md`

완료 기준:

- contract inventory, dependency map, schema versioning, schema migration, Resource, Matter, Policy, Evidence, Capability/Workflow, Runtime/AgentRun, Gate/Approval, Output/Delivery, Event/Audit/Run, Error/Cost/Observability 대표 artifact 14개가 golden fixture로 등록된다. Phase 113부터 identity_model fixture가 추가되었고 Phase 114부터 client_counterparty_registry fixture, Phase 115부터 matter_profile_team_ledger fixture, Phase 116부터 wall_policy_contract fixture, Phase 117부터 matter_access_policy_evaluator fixture가 추가되어 현재 golden fixture set은 19개다.
- 각 fixture는 artifact path, schema path, artifact schema version, content hash, schema hash, schema validation status, regression lock status를 가진다.
- 모든 fixture가 대응 schema로 검증되고 regression hash manifest에 포함된다.
- Dashboard stage와 summary가 `contract_golden_fixtures` 지표를 추적함
- Review API에서 `/api/contract-golden-fixtures`, `/api/contract-golden-fixture-records`, `/api/contract-golden-regression-hashes`, `/api/contract-golden-fixture-validations` route를 제공함
- Control Plane Loop와 Goal Checkpoint가 Contract Golden Fixtures를 독립 단계와 checkpoint로 검증함
- `npm test`, `npm run validate`, `npm run contracts:golden-fixtures`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 112 - Contract Validation CLI

목표: 전체 contract fixture를 한 명령으로 검증하는 `contracts:validate` CLI를 통합해 Core Contracts, Schema, Migration Spine 구간을 닫는다.

구현 산출물:

- `src/contract-validation-suite.mjs`
- `scripts/contract-validation-suite.mjs`
- `schemas/contract-validation-suite.schema.json`
- `docs/contract-validation-suite.md`
- `artifacts/contract-validation-suite/latest/contract-validation-suite.json`
- `artifacts/contract-validation-suite/latest/fixture-validation-results.json`
- `artifacts/contract-validation-suite/latest/validation-command-manifest.json`
- `artifacts/contract-validation-suite/latest/validation-report.json`
- `artifacts/contract-validation-suite/latest/summary.md`

완료 기준:

- `npm run contracts:validate -- --check`가 Phase 111 golden fixture set을 읽어 모든 fixture를 schema validation, content hash, schema hash, regression status로 검증한다.
- required contract package scripts가 command manifest에 기록되고 누락 시 validation fail이 된다.
- Phase 112 roadmap 선언과 `npm run contracts:validate` 문구가 validation item으로 검증된다.
- Dashboard stage와 summary가 `contract_validation_suite` 지표를 추적함
- Review API에서 `/api/contract-validation-suites`, `/api/contract-validation-fixture-results`, `/api/contract-validation-commands`, `/api/contract-validation-items` route를 제공함
- Control Plane Loop와 Goal Checkpoint가 Contract Validation Suite를 독립 단계와 checkpoint로 검증함
- `npm test`, `npm run validate`, `npm run contracts:validate`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 113 - Identity Model

목표: tenant, human user, role, role assignment, actor principal, actor-user binding을 별도 객체로 투영해 actor와 human user를 혼동하지 않는 identity boundary를 구축한다.

구현 산출물:

- `src/identity-model.mjs`
- `scripts/identity-model.mjs`
- `schemas/identity-model.schema.json`
- `docs/identity-model.md`
- `artifacts/identity-model/latest/identity-model.json`
- `artifacts/identity-model/latest/identity-users.json`
- `artifacts/identity-model/latest/actor-principals.json`
- `artifacts/identity-model/latest/role-assignments.json`
- `artifacts/identity-model/latest/actor-user-bindings.json`
- `artifacts/identity-model/latest/validation-report.json`
- `artifacts/identity-model/latest/summary.md`

완료 기준:

- `npm run contracts:identity -- --check`가 vertical slice의 `identity_policy`에서 tenant, user, role, actor principal, actor-user binding을 생성한다.
- human user와 human actor principal이 별도 id로 구분되고 binding으로 연결된다.
- connector, harness, script, manual runtime actor는 human user 없이 system/runtime actor principal로 남는다.
- tenant role, matter role, system actor role이 role assignment로 기록된다.
- approval `requested_from`이 human user와 human actor principal로 역추적된다.
- Contract Golden Fixtures와 Contract Validation Suite에 `identity_model` fixture가 포함된다.
- Dashboard stage와 summary가 `identity_model` 지표를 추적함
- Review API에서 `/api/identity-models`, `/api/identity-users`, `/api/identity-roles`, `/api/identity-role-assignments`, `/api/identity-actors`, `/api/identity-bindings`, `/api/identity-validations` route를 제공함
- Control Plane Loop와 Goal Checkpoint가 Identity Model을 독립 단계와 checkpoint로 검증함
- `npm test`, `npm run validate`, `npm run contracts:identity`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 114 - Client/Counterparty Registry

목표: Matter/Client/Party v2 contract 위에 conflict check와 matter access가 안정적으로 참조할 수 있는 client/counterparty registry projection을 구축한다.

구현 산출물:

- `src/client-counterparty-registry.mjs`
- `scripts/client-counterparty-registry.mjs`
- `schemas/client-counterparty-registry.schema.json`
- `docs/client-counterparty-registry.md`
- `artifacts/client-counterparty-registry/latest/client-counterparty-registry.json`
- `artifacts/client-counterparty-registry/latest/party-registry.json`
- `artifacts/client-counterparty-registry/latest/client-registry.json`
- `artifacts/client-counterparty-registry/latest/counterparty-registry.json`
- `artifacts/client-counterparty-registry/latest/matter-party-links.json`
- `artifacts/client-counterparty-registry/latest/conflict-reference-index.json`
- `artifacts/client-counterparty-registry/latest/validation-report.json`
- `artifacts/client-counterparty-registry/latest/summary.md`

완료 기준:

- `npm run contracts:party-registry -- --check`가 `matter-contract-freeze`에서 stable party registry, client registry, counterparty registry, matter-party link, conflict reference index를 생성한다.
- 모든 Party v2 source row가 `stable_party_id`를 가진 party registry row로 투영된다.
- 모든 Client v2 source row가 stable client party id와 conflict reference를 가진 client registry row로 투영된다.
- 모든 non-client party row가 matter link와 conflict reference를 가진 counterparty registry row로 투영된다.
- 모든 `matter.party_ids` relation이 `matter_party_links`에 materialize된다.
- tenant 내부 alias collision이 validation item으로 차단된다.
- Contract Golden Fixtures와 Contract Validation Suite에 `client_counterparty_registry` fixture가 포함되어 golden fixture set이 16개로 확장된다.
- Dashboard stage와 summary가 `client_counterparty_registry` 지표를 추적함
- Review API에서 `/api/client-counterparty-registries`, `/api/party-registry`, `/api/client-registry`, `/api/counterparty-registry`, `/api/matter-party-links`, `/api/conflict-reference-index`, `/api/client-counterparty-validations` route를 제공함
- Control Plane Loop와 Goal Checkpoint가 Client/Counterparty Registry를 독립 단계와 checkpoint로 검증함
- `npm test`, `npm run validate`, `npm run contracts:party-registry`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 115 - Matter Profile/Team Ledger

목표: Matter/Client/Party v2와 Identity Model, Client/Counterparty Registry를 조합해 matter profile, matter team roster, team membership, matter access subject를 별도 장부로 고정한다.

구현 산출물:

- `src/matter-profile-team-ledger.mjs`
- `scripts/matter-profile-team-ledger.mjs`
- `schemas/matter-profile-team-ledger.schema.json`
- `docs/matter-profile-team-ledger.md`
- `artifacts/matter-profile-team-ledger/latest/matter-profile-team-ledger.json`
- `artifacts/matter-profile-team-ledger/latest/matter-profiles.json`
- `artifacts/matter-profile-team-ledger/latest/matter-team-rosters.json`
- `artifacts/matter-profile-team-ledger/latest/matter-team-memberships.json`
- `artifacts/matter-profile-team-ledger/latest/matter-access-subjects.json`
- `artifacts/matter-profile-team-ledger/latest/validation-report.json`
- `artifacts/matter-profile-team-ledger/latest/summary.md`

완료 기준:

- `npm run contracts:matter-teams -- --check`가 matter profile, roster, membership, access subject projection을 생성한다.
- 모든 Matter v2 source row가 team, boundary, client registry, conflict reference를 가진 matter profile로 투영된다.
- 모든 MatterTeam v2 source row가 roster로 투영되고 source member count와 membership count가 일치한다.
- 모든 team member가 human actor principal과 matter role assignment에 연결된 membership row를 가진다.
- 모든 human user의 per-matter access subject가 team membership 기준으로 allow/deny를 받는다.
- 각 matter에는 최소 1명의 allowed access subject와 responsible partner가 존재한다.
- Contract Golden Fixtures와 Contract Validation Suite에 `matter_profile_team_ledger` fixture가 포함되어 golden fixture set이 17개로 확장된다.
- Dashboard stage와 summary가 `matter_profile_team_ledger` 지표를 추적함
- Review API에서 `/api/matter-profile-team-ledgers`, `/api/matter-profiles`, `/api/matter-team-rosters`, `/api/matter-team-memberships`, `/api/matter-access-subjects`, `/api/matter-profile-team-validations` route를 제공함
- Control Plane Loop와 Goal Checkpoint가 Matter Profile/Team Ledger를 독립 단계와 checkpoint로 검증함
- `npm test`, `npm run validate`, `npm run contracts:matter-teams`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 116 - Wall Policy Contract

목표: ethical wall/conflict wall rule을 retrieval 이전에 적용 가능한 명시적 contract로 분리하고, matter boundary wall id와 conflict reference를 access subject 및 retrieval filter에 결합한다.

구현 산출물:

- `src/wall-policy-contract.mjs`
- `scripts/wall-policy-contract.mjs`
- `schemas/wall-policy-contract.schema.json`
- `docs/wall-policy-contract.md`
- `artifacts/wall-policy-contract/latest/wall-policy-contract.json`
- `artifacts/wall-policy-contract/latest/wall-policy-rules.json`
- `artifacts/wall-policy-contract/latest/retrieval-wall-filters.json`
- `artifacts/wall-policy-contract/latest/wall-subject-bindings.json`
- `artifacts/wall-policy-contract/latest/conflict-wall-bindings.json`
- `artifacts/wall-policy-contract/latest/validation-report.json`
- `artifacts/wall-policy-contract/latest/summary.md`

완료 기준:

- `npm run contracts:walls -- --check`가 wall policy rule, retrieval wall filter, wall subject binding, conflict wall binding projection을 생성한다.
- 모든 MatterBoundary v2 `wall_ids`가 `pre_retrieval` enforcement와 `deny_unless_allowed` decision mode를 가진 wall policy rule로 투영된다.
- 모든 wall policy rule은 tenant, client, matter, wall, classification filter를 가진 complete retrieval wall filter에 연결된다.
- allowed retrieval은 Matter Profile/Team Ledger의 allowed access subject와 active membership을 통해서만 가능하다.
- 모든 boundary party와 profile conflict reference가 conflict wall binding으로 연결되고 conflict check status가 ready로 검증된다.
- Contract Golden Fixtures와 Contract Validation Suite에 `wall_policy_contract` fixture가 포함되어 golden fixture set이 18개로 확장된다.
- Dashboard stage와 summary가 `wall_policy_contract` 지표를 추적함
- Review API에서 `/api/wall-policy-contracts`, `/api/wall-policy-rules`, `/api/retrieval-wall-filters`, `/api/wall-subject-bindings`, `/api/conflict-wall-bindings`, `/api/wall-policy-validations` route를 제공함
- Control Plane Loop와 Goal Checkpoint가 Wall Policy Contract를 독립 단계와 checkpoint로 검증함
- `npm test`, `npm run validate`, `npm run contracts:walls`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 117 - Matter Access Policy Evaluator

목표: matter team, wall policy, runtime adapter, resource contract를 조합하여 retrieval 이전에 사용자/런타임/리소스/사건별 접근 결정을 명시적으로 생성한다.

구현 산출물:

- `src/matter-access-policy-evaluator.mjs`
- `scripts/matter-access-policy-evaluator.mjs`
- `schemas/matter-access-policy-evaluator.schema.json`
- `docs/matter-access-policy-evaluator.md`
- `artifacts/matter-access-policy/latest/matter-access-policy-evaluator.json`
- `artifacts/matter-access-policy/latest/matter-access-policy.json`
- `artifacts/matter-access-policy/latest/access-policy-rules.json`
- `artifacts/matter-access-policy/latest/matter-access-decisions.json`
- `artifacts/matter-access-policy/latest/resource-access-decisions.json`
- `artifacts/matter-access-policy/latest/runtime-access-matrix.json`
- `artifacts/matter-access-policy/latest/validation-report.json`
- `artifacts/matter-access-policy/latest/summary.md`

완료 기준:

- `npm run contracts:matter-access -- --check`가 Matter Access Policy Evaluator를 생성하고 validation error 0으로 통과한다.
- Matter-level decision은 allowed matter access subject와 runtime adapter를 wall policy rule에 결합해 `allow`, `review`, `deny`로 판정한다.
- Runtime classification policy상 raw context가 가능한 경우에만 `allow`, redacted context만 가능한 경우에는 `review`, 불가능한 경우에는 `deny`로 판정한다.
- Resource-level decision은 target matter/tenant boundary를 강제하고, 미분류/unassigned resource를 항상 `review`로 보류한다.
- unassigned resource는 retrieval `allow`가 되지 않으며 matter tagging gate가 필요한 review decision으로 남는다.
- Contract Golden Fixtures와 Contract Validation Suite에 `matter_access_policy_evaluator` fixture가 포함되어 golden fixture set이 19개로 확장된다.
- Dashboard stage와 summary가 `matter_access_policy_evaluator` 지표를 추적함
- Review API에서 `/api/matter-access-policy-evaluators`, `/api/matter-access-policy-rules`, `/api/matter-access-decisions`, `/api/resource-access-decisions`, `/api/runtime-access-matrix`, `/api/matter-access-policy-validations` route를 제공함
- Control Plane Loop와 Goal Checkpoint가 Matter Access Policy Evaluator를 독립 단계와 checkpoint로 검증함
- `npm test`, `npm run validate`, `npm run contracts:matter-access`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 118 - Data Classification Rule Engine

목표: Resource v2의 classification을 PolicyReference v2, PolicyDecision v2, Matter Access Policy Evaluator decision에 연결해 resource별 정책 결정을 구조화한다.

구현 산출물:

- `src/data-classification-rule-engine.mjs`
- `scripts/data-classification-rule-engine.mjs`
- `schemas/data-classification-rule-engine.schema.json`
- `docs/data-classification-rule-engine.md`
- `artifacts/data-classification-rules/latest/data-classification-rule-engine.json`
- `artifacts/data-classification-rules/latest/classification-rule-catalog.json`
- `artifacts/data-classification-rules/latest/classification-rules.json`
- `artifacts/data-classification-rules/latest/resource-classification-decisions.json`
- `artifacts/data-classification-rules/latest/classification-policy-bindings.json`
- `artifacts/data-classification-rules/latest/validation-report.json`
- `artifacts/data-classification-rules/latest/summary.md`

완료 기준:

- `npm run contracts:classification-rules -- --check`가 Data Classification Rule Engine을 생성하고 validation error 0으로 통과한다.
- P0-P5 DataClassification contract마다 classification rule이 생성되고 PolicyDecision v2에 연결된다.
- 각 Resource v2는 resolved PolicyReference와 PolicyDecision에 연결된 `resource-classification-decision.v1`을 가진다.
- unassigned matter resource는 classification이 낮아도 자동 허용되지 않고 `review`와 `matter_tagging_gate`/`human_approval_gate`가 필요하다.
- 외부 모델 정책은 `allowed_with_audit -> allow`, `approval_required -> review`, `forbidden -> deny`로 deterministic하게 매핑된다.
- Matter Access Policy Evaluator의 resource access decision count가 resource classification decision에 링크된다.
- Contract Golden Fixtures와 Contract Validation Suite에 `data_classification_rule_engine` fixture가 포함되어 golden fixture set이 20개로 확장된다.
- Dashboard stage와 summary가 `data_classification_rule_engine` 지표를 추적함
- Review API에서 `/api/data-classification-rule-engines`, `/api/data-classification-rules`, `/api/resource-classification-decisions`, `/api/classification-policy-bindings`, `/api/data-classification-rule-validations` route를 제공함
- Control Plane Loop와 Goal Checkpoint가 Data Classification Rule Engine을 독립 단계와 checkpoint로 검증함
- `npm test`, `npm run validate`, `npm run contracts:classification-rules`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 119 - Model Policy Matrix Enforcement

목표: Data Classification Rule Engine과 Model Routing Ledger를 대조해 P2-P5 자료가 외부 모델 경계를 `allow` 상태로 통과하지 못하도록 별도 model policy gate를 고정한다.

구현 산출물:

- `src/model-policy-enforcement.mjs`
- `scripts/model-policy-enforcement.mjs`
- `schemas/model-policy-enforcement.schema.json`
- `docs/model-policy-enforcement.md`
- `artifacts/model-policy-enforcement/latest/model-policy-enforcement.json`
- `artifacts/model-policy-enforcement/latest/model-policy-gates.json`
- `artifacts/model-policy-enforcement/latest/classification-model-gates.json`
- `artifacts/model-policy-enforcement/latest/resource-model-gates.json`
- `artifacts/model-policy-enforcement/latest/route-model-gates.json`
- `artifacts/model-policy-enforcement/latest/validation-report.json`
- `artifacts/model-policy-enforcement/latest/summary.md`

완료 기준:

- `npm run contracts:model-policy -- --check`가 Model Policy Enforcement를 생성하고 validation error 0으로 통과한다.
- P0-P5 classification rule마다 `classification-model-policy-gate.v1`이 생성된다.
- Resource classification decision마다 `resource-model-policy-gate.v1`이 생성된다.
- Model routing decision마다 `route-model-policy-gate.v1`이 생성된다.
- P2 classification은 외부 모델 route가 `review`/approval gate를 요구하고, P3-P5 classification은 외부 모델 route가 `deny`가 된다.
- P2-P5 external transfer route가 `allow`로 통과하는 경우는 `unauthorized_external_allow_count`로 잡히며 현재 0이다.
- 외부 전송 route에서 required redaction이 누락되면 route model gate가 `deny`로 고정된다.
- Contract Golden Fixtures와 Contract Validation Suite에 `model_policy_enforcement` fixture가 포함되어 golden fixture set이 21개로 확장된다.
- Dashboard stage와 summary가 `model_policy_enforcement` 지표를 추적함
- Review API에서 `/api/model-policy-enforcements`, `/api/classification-model-gates`, `/api/resource-model-gates`, `/api/route-model-gates`, `/api/model-policy-enforcement-validations` route를 제공함
- Control Plane Loop와 Goal Checkpoint가 Model Policy Enforcement를 독립 단계와 checkpoint로 검증함
- `npm test`, `npm run validate`, `npm run contracts:model-policy`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 120 - Tool/Runtime Policy Enforcement

목표: RuntimeAdapter/AgentRun contract, Policy Matrix, Capability/Workflow gate binding, Model Policy Enforcement를 합쳐 runtime별 허용 도구와 금지 action을 `tool_permission_gate`로 고정한다.

구현 산출물:

- `src/tool-runtime-policy-enforcement.mjs`
- `scripts/tool-runtime-policy-enforcement.mjs`
- `schemas/tool-runtime-policy-enforcement.schema.json`
- `docs/tool-runtime-policy-enforcement.md`
- `artifacts/tool-runtime-policy/latest/tool-runtime-policy-enforcement.json`
- `artifacts/tool-runtime-policy/latest/tool-runtime-policy-catalog.json`
- `artifacts/tool-runtime-policy/latest/runtime-policy-gates.json`
- `artifacts/tool-runtime-policy/latest/tool-permission-gates.json`
- `artifacts/tool-runtime-policy/latest/agent-run-tool-gates.json`
- `artifacts/tool-runtime-policy/latest/validation-report.json`
- `artifacts/tool-runtime-policy/latest/summary.md`

완료 기준:

- `npm run contracts:tool-runtime -- --check`가 Tool/Runtime Policy Enforcement를 생성하고 validation error 0으로 통과한다.
- Runtime/classification 조합마다 `runtime-policy-gate.v1`이 생성되고 forbidden runtime binding은 `blocked`로 고정된다.
- Runtime별 `allowed_tools`와 `forbidden_tools`가 겹치면 validation failure로 잡힌다.
- Runtime이 금지한 tool은 항상 `deny` tool permission gate로 고정된다.
- `email.send`, `erp.billing.issue`, `github.merge` 같은 protected action은 approval-required gate와 human approval gate를 요구한다.
- Non-manual runtime이 tool을 보유하면 `tool_permission_gate` 선언이 필수이며, `document_renderer`도 이 gate를 통과한다.
- AgentRun마다 `agent-run-tool-gate.v1`이 생성되고 capability-required tool gate와 runtime-required tool gate가 맞물린다.
- Contract Golden Fixtures와 Contract Validation Suite에 `tool_runtime_policy_enforcement` fixture가 포함되어 golden fixture set이 22개로 확장된다.
- Dashboard stage와 summary가 `tool_runtime_policy_enforcement` 지표를 추적함
- Review API에서 `/api/tool-runtime-policy-enforcements`, `/api/runtime-policy-gates`, `/api/tool-permission-gates`, `/api/agent-run-tool-gates`, `/api/tool-runtime-policy-validations` route를 제공함
- Control Plane Loop와 Goal Checkpoint가 Tool/Runtime Policy Enforcement를 독립 단계와 checkpoint로 검증함
- `npm test`, `npm run validate`, `npm run contracts:tool-runtime`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 121 - Output Destination Policy Enforcement

목표: Policy Matrix, Output/Delivery contract freeze, Protected Delivery Queue, Delivery Execution Draft, Tool/Runtime Policy Enforcement를 합쳐 산출물 draft 생성과 email/ERP/GitHub/manual delivery 같은 final action을 `output_destination_gate`로 분리한다.

구현 산출물:

- `src/output-destination-policy-enforcement.mjs`
- `scripts/output-destination-policy-enforcement.mjs`
- `schemas/output-destination-policy-enforcement.schema.json`
- `docs/output-destination-policy-enforcement.md`
- `artifacts/output-destination-policy/latest/output-destination-policy-enforcement.json`
- `artifacts/output-destination-policy/latest/output-destination-policy-catalog.json`
- `artifacts/output-destination-policy/latest/policy-destination-rules.json`
- `artifacts/output-destination-policy/latest/artifact-destination-gates.json`
- `artifacts/output-destination-policy/latest/delivery-action-destination-gates.json`
- `artifacts/output-destination-policy/latest/final-action-separation-gates.json`
- `artifacts/output-destination-policy/latest/validation-report.json`
- `artifacts/output-destination-policy/latest/summary.md`

완료 기준:

- `npm run contracts:output-destination -- --check`가 Output Destination Policy Enforcement를 생성하고 validation error 0으로 통과한다.
- 각 output rule은 draft 생성과 final destination action을 분리하는 `policy-destination-rule.v1`로 materialize된다.
- OutputArtifact마다 `artifact-destination-gate.v1`이 생성되고 tenant/matter boundary와 delivery separation 상태를 보존한다.
- DeliveryAction마다 `delivery-action-destination-gate.v1`이 생성되고 final action은 approval/receipt 전 `draft_only`와 `blocked_pending_approval` 상태로 유지된다.
- `email.send`, `erp.billing.issue`, `github.merge`는 `final-action-separation-gate.v1`와 Tool/Runtime protected tool gate에 연결된다.
- `docx`, `pptx`, `email_draft`, `pr_draft`, `erp_billing_draft`, `public_content` output policy에는 `output_destination_gate`가 명시된다.
- Contract Golden Fixtures와 Contract Validation Suite에 `output_destination_policy_enforcement` fixture가 포함되어 golden fixture set이 23개로 확장된다.
- Dashboard stage와 summary가 `output_destination_policy_enforcement` 지표를 추적함
- Review API에서 `/api/output-destination-policy-enforcements`, `/api/policy-destination-rules`, `/api/artifact-destination-gates`, `/api/delivery-action-destination-gates`, `/api/final-action-separation-gates`, `/api/output-destination-policy-validations` route를 제공함
- Control Plane Loop와 Goal Checkpoint가 Output Destination Policy Enforcement를 독립 단계와 checkpoint로 검증함
- `npm test`, `npm run validate`, `npm run contracts:output-destination -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 122 - Approval Authority Ledger

목표: Gate/Approval contract, Output/Delivery contract, Output Destination Policy, Identity Model, Matter Profile/Team Ledger를 합쳐 산출물별 승인권자를 role/matter 기준으로 판정한다.

구현 산출물:

- `src/approval-authority-ledger.mjs`
- `scripts/approval-authority-ledger.mjs`
- `schemas/approval-authority-ledger.schema.json`
- `docs/approval-authority-ledger.md`
- `artifacts/approval-authority/latest/approval-authority-ledger.json`
- `artifacts/approval-authority/latest/authority-policies.json`
- `artifacts/approval-authority/latest/artifact-authority-decisions.json`
- `artifacts/approval-authority/latest/approval-request-authority-decisions.json`
- `artifacts/approval-authority/latest/delivery-action-authority-decisions.json`
- `artifacts/approval-authority/latest/validation-report.json`
- `artifacts/approval-authority/latest/summary.md`

완료 기준:

- `npm run contracts:approval-authority -- --check`가 Approval Authority Ledger를 생성하고 validation error 0으로 통과한다.
- 각 OutputArtifact, ApprovalRequest, DeliveryAction마다 authority decision이 생성되고 `tenant_id`, `matter_id`, `domain_pack`, delivery policy, required authority role을 보존한다.
- 로펌 domain decision은 모두 human authority를 요구하고 runtime/model/script actor를 최종 승인권자로 지정하지 않는다.
- Matter Profile/Team Ledger와 Identity Model을 이용해 가능한 human candidate를 배정하고, 배정 불가 항목은 auto-approval이 아니라 `assignment_required`로 남긴다.
- Contract Golden Fixtures와 Contract Validation Suite에 `approval_authority_ledger` fixture가 포함되어 golden fixture set이 24개로 확장된다.
- Dashboard stage와 summary가 `approval_authority_ledger` 지표를 추적함
- Review API에서 `/api/approval-authority-ledgers`, `/api/authority-policies`, `/api/artifact-authority-decisions`, `/api/approval-request-authority-decisions`, `/api/delivery-action-authority-decisions`, `/api/approval-authority-validations` route를 제공함
- Control Plane Loop와 Goal Checkpoint가 Approval Authority Ledger를 독립 단계와 checkpoint로 검증함
- `npm test`, `npm run validate`, `npm run contracts:approval-authority -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 123 - Policy Snapshot Binding Ledger

목표: workflow, AgentRun, event/audit/run ledger, gate, approval, output/delivery action이 실행 당시의 policy snapshot에 묶여 있는지 deterministic하게 검증한다.

구현 산출물:

- `src/policy-snapshot-binding-ledger.mjs`
- `scripts/policy-snapshot-binding-ledger.mjs`
- `schemas/policy-snapshot-binding-ledger.schema.json`
- `docs/policy-snapshot-binding-ledger.md`
- `artifacts/policy-snapshot-bindings/latest/policy-snapshot-binding-ledger.json`
- `artifacts/policy-snapshot-bindings/latest/policy-snapshot-binding-catalog.json`
- `artifacts/policy-snapshot-bindings/latest/workflow-policy-bindings.json`
- `artifacts/policy-snapshot-bindings/latest/agent-run-policy-bindings.json`
- `artifacts/policy-snapshot-bindings/latest/event-policy-bindings.json`
- `artifacts/policy-snapshot-bindings/latest/gate-policy-bindings.json`
- `artifacts/policy-snapshot-bindings/latest/approval-policy-bindings.json`
- `artifacts/policy-snapshot-bindings/latest/output-policy-bindings.json`
- `artifacts/policy-snapshot-bindings/latest/validation-report.json`
- `artifacts/policy-snapshot-bindings/latest/summary.md`

완료 기준:

- `npm run contracts:policy-bindings -- --check`가 Policy Snapshot Binding Ledger를 생성하고 validation error 0으로 통과한다.
- WorkflowRun, AgentRun, EventRecord, AuditEvent, RunLedger, GateResult, ApprovalRequest, OutputArtifact, DeliveryAction마다 `policy_snapshot_binding`이 생성된다.
- 각 binding은 declared snapshot, workflow inherited snapshot, linked output snapshot, final `policy_snapshot_id`, binding source, known/bound status를 보존한다.
- unresolved placeholder는 누락으로 숨기지 않고 `unresolved_declared_reference_count`와 `fallback_resolved` 상태로 추적된다.
- Contract Golden Fixtures와 Contract Validation Suite에 `policy_snapshot_binding_ledger` fixture가 포함되어 golden fixture set이 25개로 확장된다.
- Dashboard stage와 summary가 `policy_snapshot_binding_ledger` 지표를 추적함
- Review API에서 `/api/policy-snapshot-binding-ledgers`, `/api/workflow-policy-bindings`, `/api/agent-run-policy-bindings`, `/api/event-policy-bindings`, `/api/gate-policy-bindings`, `/api/approval-policy-bindings`, `/api/output-policy-bindings`, `/api/policy-snapshot-binding-validations` route를 제공함
- Control Plane Loop와 Goal Checkpoint가 Policy Snapshot Binding Ledger를 독립 단계와 checkpoint로 검증함
- `npm test`, `npm run validate`, `npm run contracts:policy-bindings -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 124: Matter Tagging Decision Ledger

목표: unassigned resource를 실제 matter에 자동 적용하지 않고, Matter Access Policy와 Data Classification 결과를 근거로 자동 후보, 사람 확인 대기열, 수정 이력을 분리한 matter tagging ledger를 만든다.

구현:

- `src/matter-tagging-decision-ledger.mjs`
- `scripts/matter-tagging-decision-ledger.mjs`
- `schemas/matter-tagging-decision-ledger.schema.json`
- `docs/matter-tagging-decision-ledger.md`
- `artifacts/matter-tagging/latest/matter-tagging-ledger.json`
- `artifacts/matter-tagging/latest/matter-tagging-decisions.json`
- `artifacts/matter-tagging/latest/matter-tagging-candidates.json`
- `artifacts/matter-tagging/latest/matter-tagging-confirmations.json`
- `artifacts/matter-tagging/latest/matter-tagging-corrections.json`
- `artifacts/matter-tagging/latest/validation-report.json`
- `artifacts/matter-tagging/latest/summary.md`

완료 기준:

- `npm run contracts:matter-tagging -- --check`가 Matter Tagging Decision Ledger를 생성하고 validation error 0으로 통과한다.
- Resource별 `matter_tagging_decision`이 생성되고, `matter.unassigned.*` resource는 `pending_human_confirmation`으로 남으며 `auto_apply_allowed=false`를 유지한다.
- Matter Access Policy Evaluator의 `target_matter_id`는 automatic candidate로만 기록되고, tenant boundary mismatch와 `matter_tagging_gate` 필요성이 reason code로 남는다.
- Human confirmation queue는 pending decision 수와 일치하고, `resource.matter_tag.apply` protected action은 human approval gate 뒤에 남는다.
- Correction history는 현재 비어 있어도 별도 collection으로 분리되어 추후 사람이 수정한 tagging 이력을 원본 결정과 섞지 않는다.
- Contract Golden Fixtures와 Contract Validation Suite에 `matter_tagging_decision_ledger` fixture가 포함되어 golden fixture set이 26개로 확장된다.
- Dashboard stage와 summary가 `matter_tagging_decision_ledger` 지표를 추적함
- Review API에서 `/api/matter-tagging-ledgers`, `/api/matter-tagging-decisions`, `/api/matter-tagging-candidates`, `/api/matter-tagging-confirmations`, `/api/matter-tagging-corrections`, `/api/matter-tagging-validations` route를 제공함
- Control Plane Loop와 Goal Checkpoint가 Matter Tagging Decision Ledger를 독립 단계와 checkpoint로 검증함
- `npm test`, `npm run validate`, `npm run contracts:matter-tagging -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 125: Access Audit Projection

P125에서는 Matter Access Policy Evaluator의 matter/resource access decision을 사람이 조회 가능한 Access Audit Projection으로 materialize했다. 이 단계의 목표는 “누가 어떤 matter/resource를 어떤 runtime/policy snapshot 아래에서 볼 수 있는지”를 원본 접근 판단과 분리된 조회 view로 제공하는 것이다.

구현 내용:

- `src/access-audit-projection.mjs`와 `scripts/access-audit-projection.mjs`를 추가해 `npm run contracts:access-audit` 명령으로 실행 가능하게 함
- `schemas/access-audit-projection.schema.json`을 추가해 projection, audit record, actor rollup, resource rollup, validation item을 schema 검증 대상으로 고정함
- Matter access decision과 resource access decision을 `access_audit_records`로 통합하되 `target_type`, `user_id`, `runtime_id`, `target_matter_id`, `target_resource_id`, `view_status`, `policy_snapshot_id`를 조회 key로 유지함
- `allow/review/deny`를 각각 `view_allowed`, `view_requires_human_confirmation`, `view_denied`로 정규화해 실제 자료 열람 실행 없이 audit view로만 표현함
- resource-level audit row가 matter tagging 필요 상태이면 P124의 `matter_tagging_decision_id`와 confirmation 상태를 연결해 unassigned resource 접근을 추적 가능하게 함
- actor별 rollup과 resource별 rollup을 분리해 user/runtime/matter/resource 축으로 조회할 수 있게 함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 access audit projection을 통합함

완료 기준:

- Access audit projection이 Matter Access Policy Evaluator와 Matter Tagging Decision Ledger를 source로 삼아 153개 audit record, 9개 actor rollup, 16개 resource rollup을 생성함
- 모든 matter/resource access decision이 audit record로 1:1 투영되고, resource-level row는 matter tagging decision에 연결됨
- Dashboard/API에서 `/api/access-audit-projections`, `/api/access-audit-records`, `/api/access-audit-actor-rollups`, `/api/access-audit-resource-rollups`, `/api/access-audit-validations` route로 조회 가능함
- Golden fixture 수가 27개로 증가하고 access audit projection이 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run contracts:access-audit -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 126: Store Policy Adapter

P126에서는 Access Audit Projection의 access audit row를 실제 store query layer가 사용할 수 있는 policy-bound query plan으로 컴파일했다. 이 단계의 목표는 “검색 후 prompt로 걸러내기”가 아니라 tenant, matter, classification, policy snapshot, access audit record filter가 query 단계에서 빠지지 않도록 강제하는 것이다.

구현 내용:

- `src/store-policy-adapter.mjs`와 `scripts/store-policy-adapter.mjs`를 추가해 `npm run contracts:store-policy` 명령으로 실행 가능하게 함
- `schemas/store-policy-adapter.schema.json`과 `docs/store-policy-adapter.md`를 추가해 store policy rule, RLS filter template, query policy binding, store query plan, enforcement probe를 계약으로 고정함
- 모든 access audit row를 store query plan으로 컴파일하고, matter/resource query 모두 `tenant_id`, `matter_id`, `classification`, `policy_snapshot_id`, `access_audit_record_id` filter를 요구하게 함
- resource query plan은 추가로 `resource_id` filter를 요구하고 Data Classification Rule Engine의 resource classification decision과 연결함
- `view_allowed`와 `can_retrieve = true`인 row만 `executable` query plan이 되며, review/deny row는 `held_for_human_confirmation` 또는 `blocked` 상태로 유지함
- 각 query plan마다 baseline, missing matter filter, missing classification filter, missing policy snapshot filter, cross-matter filter, unfiltered query probe를 생성하고 dangerous probe는 모두 blocked로 검증함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 store policy adapter를 통합함

완료 기준:

- Store Policy Adapter가 Access Audit Projection과 Data Classification Rule Engine을 source로 삼아 153개 store query plan과 918개 enforcement probe를 생성함
- 모든 query plan이 RLS enforcement를 켜고 matter/classification/policy snapshot/access audit filter를 포함함
- 153개 unfiltered query probe, cross-matter probe, missing matter/classification/policy snapshot probe가 전부 blocked로 검증됨
- Dashboard/API에서 `/api/store-policy-adapters`, `/api/store-policy-rules`, `/api/rls-filter-templates`, `/api/store-query-plans`, `/api/store-enforcement-probes`, `/api/store-policy-validations` route로 조회 가능함
- Golden fixture 수가 28개로 증가하고 store policy adapter가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run contracts:store-policy -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 127: Conflict Check Interface

목표: Client/Counterparty Registry, Matter Profile/Team Ledger, Wall Policy Contract, Store Policy Adapter를 조합해 수임 또는 자료 접근 전에 conflict check request/result/signal을 남기는 deterministic interface를 구현한다.

구현 내용:

- `src/conflict-check-interface.mjs`, `scripts/conflict-check-interface.mjs`, `schemas/conflict-check-interface.schema.json`, `docs/conflict-check-interface.md`를 추가함
- matter intake request 1개와 resource access request 16개를 생성하고, 각 request가 client/counterparty conflict reference, conflict wall binding, policy snapshot, store query plan을 보존함
- conflict signal 34개를 생성하며 client signal은 `clear`, counterparty signal은 `review`로 기록해 모든 result를 `hold_for_conflict_review` 상태로 유지함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 conflict check interface를 통합함
- `/api/conflict-check-interfaces`, `/api/conflict-check-requests`, `/api/conflict-check-results`, `/api/conflict-check-signals`, `/api/conflict-check-validations` route를 추가함

완료 기준:

- Conflict Check Interface가 17개 request, 17개 result, 34개 signal을 생성하고 validation error 없이 complete 상태가 됨
- 모든 resource access request가 store query plan에 연결되고 missing conflict reference가 0으로 검증됨
- Counterparty conflict signal은 자동 clear되지 않고 human review가 필요한 review-held result로 남음
- Golden fixture 수가 29개로 증가하고 conflict check interface가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run contracts:conflict-check -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 128: Personal Workspace Boundary

목표: 개인 개발 workspace와 로펌 matter workspace를 tenant, policy snapshot, domain pack, search namespace 기준으로 분리해 검색/정책 계층에서 컨텍스트가 섞이지 않도록 deterministic boundary를 구현한다.

구현 내용:

- `src/personal-workspace-boundary.mjs`, `scripts/personal-workspace-boundary.mjs`, `schemas/personal-workspace-boundary.schema.json`, `docs/personal-workspace-boundary.md`를 추가함
- Identity Model, Matter Profile/Team Ledger, Store Policy Adapter, Conflict Check Interface, Personal Dev Slice, Domain Pack Registry를 입력으로 law-firm boundary 1개와 personal boundary 1개를 생성함
- 각 boundary에 별도 `tenant_id`, `policy_snapshot_id`, `domain_pack_id`, `search_namespace_id`, allowed resource/matter/policy snapshot 목록을 보존함
- tenant policy boundary와 search namespace policy를 생성해 law-firm resource와 personal-dev resource가 서로의 namespace에 들어가지 않도록 검증함
- cross-workspace probe 6개를 생성하고 cross tenant, cross domain pack, unscoped query 시도가 모두 `blocked`인지 검증함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 personal workspace boundary를 통합함
- `/api/personal-workspace-boundaries`, `/api/workspace-boundaries`, `/api/tenant-policy-boundaries`, `/api/search-namespace-policies`, `/api/cross-workspace-probes`, `/api/personal-workspace-boundary-validations` route를 추가함

완료 기준:

- Personal Workspace Boundary가 workspace boundary 2개, tenant policy boundary 2개, search namespace policy 2개, cross-workspace probe 6개를 생성하고 validation error 없이 complete 상태가 됨
- law-firm tenant는 `tenant.amic`, personal tenant는 `tenant.personal.jws`로 분리되고 policy snapshot도 각각 `policy.default.law_firm.v1`, `policy.default.personal_dev.v1`로 분리됨
- cross-workspace probe는 모두 blocked이고 allowed cross-workspace probe와 mixed search namespace count는 0임
- Golden fixture 수가 30개로 증가하고 personal workspace boundary가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run contracts:personal-boundary -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 129: Policy Golden Fixtures

목표: Matter Access, Model Policy, Tool/Runtime Policy, Output Destination, Store Policy, Personal Workspace Boundary에서 대표 허용/검토/차단 결정을 뽑아 policy regression fixture로 고정한다.

구현 내용:

- `src/policy-golden-fixtures.mjs`, `scripts/policy-golden-fixtures.mjs`, `schemas/policy-golden-fixtures.schema.json`, `docs/policy-golden-fixtures.md`를 추가함
- `npm run contracts:policy-golden -- --check` 명령을 추가해 policy fixture set, case table, outcome matrix, regression hash manifest, validation report, summary markdown을 생성함
- `matter_access`, `model_policy`, `tool_runtime`, `output_destination`, `store_policy`, `workspace_boundary` 6개 fixture group에서 15개 대표 케이스를 잠금
- allow/review/deny 케이스가 각각 5개씩 존재하고, review 케이스는 human/approval/confirmation gate 뒤에 보존되며 deny 케이스는 실행/검색/교차 workspace 접근을 차단함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 policy golden fixtures를 통합함
- `/api/policy-golden-fixtures`, `/api/policy-fixture-cases`, `/api/policy-outcome-matrix`, `/api/policy-regression-hashes`, `/api/policy-golden-fixture-validations` route를 추가함

완료 기준:

- Policy Golden Fixtures가 fixture group 6개, policy case 15개, allow/review/deny 5/5/5개를 생성하고 validation error 없이 complete 상태가 됨
- 모든 case가 regression hash를 가지며 locked case count와 locked regression hash count가 case count와 일치함
- review case는 전부 human-gated이고 deny case는 전부 blocked 상태로 검증됨
- Golden fixture 수가 31개로 증가하고 policy golden fixtures가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run contracts:policy-golden -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 130: Policy Operations Surface

목표: Identity/Policy/Matter Boundary 계층에서 흩어져 있던 policy decision, violation, pending approval을 dashboard/API에서 바로 조회 가능한 운영 표면으로 묶는다.

구현 내용:

- `src/policy-operations-surface.mjs`, `scripts/policy-operations-surface.mjs`, `schemas/policy-operations-surface.schema.json`, `docs/policy-operations-surface.md`를 추가함
- `npm run policy:surface -- --check` 명령을 추가해 policy operations catalog, decision rows, violation rows, pending approval rows, validation report, summary markdown을 생성함
- Matter Access, Data Classification, Model Policy, Tool/Runtime Policy, Output Destination, Approval Authority, Matter Tagging, Conflict Check, Store Policy, Personal Workspace Boundary, Policy Golden Fixtures artifact를 같은 row contract로 정규화함
- 각 decision row는 policy layer, decision, gate status, control effect, tenant/matter/resource/runtime/classification/policy snapshot, required gates, reason codes, approval/protected-action 여부를 함께 보존함
- 각 violation row는 deny decision을 critical/warning remediation queue로 노출하고, pending approval row는 human reviewer 또는 assignment required 항목을 별도 queue로 노출함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 policy operations surface를 통합함
- `/api/policy-operation-surfaces`, `/api/policy-decision-rows`, `/api/policy-violation-rows`, `/api/policy-pending-approvals`, `/api/policy-surface-validations` route를 추가함

완료 기준:

- Policy Operations Surface가 decision, violation, pending approval row를 생성하고 validation error 없이 complete 상태가 됨
- allow/review/deny decision이 모두 존재하고 critical/warning violation과 human gate 또는 assignment required pending approval이 조회 가능함
- Review Dashboard summary와 stage status에서 policy operations surface 상태, decision/violation/pending approval count, validation error count가 노출됨
- Review API smoke가 policy operations surface, decision, violation, pending approval, validation route를 모두 조회함
- Golden fixture 수가 32개로 증가하고 policy operations surface가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run policy:surface -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 131: Matter Boundary Slice

목표: Resource ingest부터 retrieval gate까지 matter boundary가 끊기지 않고 보존되는지 검증하는 vertical slice를 만든다.

구현 내용:

- `src/matter-boundary-slice.mjs`, `scripts/matter-boundary-slice.mjs`, `schemas/matter-boundary-slice.schema.json`, `docs/matter-boundary-slice.md`를 추가함
- `npm run matter-boundary:slice -- --check` 명령을 추가해 resource boundary path, retrieval gate check, validation report, summary markdown을 생성함
- Resource Ingest, Resource v2 freeze, Matter Access Policy, Access Audit Projection, Store Policy Adapter, Policy Operations Surface를 같은 slice 계약으로 연결함
- 각 resource boundary path가 promoted ingest resource, access decision, access audit record, store query plan, policy decision row를 모두 보존하는지 검증함
- retrieval gate check가 tenant/matter/classification/policy snapshot/access audit/resource filter와 negative RLS probe 차단을 모두 통과하는지 검증함
- unassigned resource는 matter tagging/human gate에 held 되고 executable query plan이 0으로 유지되는 것을 완료 조건으로 둠
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 matter boundary slice를 통합함
- `/api/matter-boundary-slices`, `/api/matter-boundary-resource-paths`, `/api/matter-boundary-retrieval-gates`, `/api/matter-boundary-validations` route를 추가함

완료 기준:

- Matter Boundary Slice가 resource boundary path와 retrieval gate check를 생성하고 validation error 없이 complete 상태가 됨
- 모든 Resource v2 row가 resource ingest에서 promoted 되었고 access decision, access audit, store query plan, policy surface row로 이어짐
- 모든 retrieval gate가 required store filter와 negative RLS probe 차단을 통과함
- unassigned resource가 executable retrieval 없이 matter tagging/human confirmation gate에 held 됨
- Review Dashboard summary와 stage status에서 matter boundary slice 상태, resource path count, retrieval gate count, validation error count가 노출됨
- Review API smoke가 matter boundary slice, resource path, retrieval gate, validation route를 모두 조회함
- Golden fixture 수가 33개로 증가하고 matter boundary slice가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run matter-boundary:slice -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 132: Identity/Policy/Matter Freeze

목표: P113-P131 Identity, Policy, Matter Boundary 트랙을 하나의 회귀 고정 보고서로 닫고 다음 Resource/Data/Evidence/Lineage 트랙으로 넘어갈 기준선을 만든다.

구현 내용:

- `src/identity-policy-matter-freeze.mjs`, `scripts/identity-policy-matter-freeze.mjs`, `schemas/identity-policy-matter-freeze.schema.json`, `docs/identity-policy-matter-freeze.md`를 추가함
- `npm run identity-policy:freeze -- --check` 명령을 추가해 freeze source status, freeze checkpoint, freeze note, validation report, summary markdown을 생성함
- P113-P131 artifact를 source status로 고정하고 각 source의 complete status, validation error, content hash를 검증함
- Policy Golden Fixtures의 allow/review/deny case와 locked regression hash, Policy Operations Surface의 decision/violation/pending approval row, Matter Boundary Slice의 retrieval gate와 matter tagging hold를 함께 checkpoint로 검증함
- freeze report는 protected action, external delivery, auto approval을 실행하지 않는 safe handling contract를 가진다
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 identity/policy/matter freeze를 통합함
- `/api/identity-policy-matter-freezes`, `/api/identity-policy-freeze-sources`, `/api/identity-policy-freeze-checkpoints`, `/api/identity-policy-freeze-validations` route를 추가함

완료 기준:

- Identity/Policy/Matter Freeze가 validation error 없이 `frozen_with_pending_human_actions` 또는 `frozen_clear` 상태가 됨
- P113-P131 source artifact가 모두 읽히고 expected status와 validation-clean 상태를 유지함
- policy fixture, policy operations, matter boundary, personal workspace boundary checkpoint가 모두 통과함
- protected action, external delivery, auto approval count가 모두 0으로 유지됨
- Review Dashboard summary와 stage status에서 freeze source/checkpoint/policy/boundary count와 validation 상태가 노출됨
- Review API smoke가 freeze artifact, source, checkpoint, validation route를 모두 조회함
- Golden fixture 수가 34개로 증가하고 identity/policy/matter freeze가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run identity-policy:freeze -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 133: Resource Store Interface

목표: Resource/Data/Evidence/Lineage 트랙의 첫 단계로 registry, ingestion, dashboard가 같은 Resource Store interface contract를 사용하도록 고정한다.

구현 내용:

- `src/resource-store-interface.mjs`, `scripts/resource-store-interface.mjs`, `schemas/resource-store-interface.schema.json`, `docs/resource-store-interface.md`를 추가함
- `npm run resource:store-interface -- --check` 명령을 추가해 resource store record, resource version store record, adapter binding, query interface, validation report, summary markdown을 생성함
- Resource Contract Freeze의 Resource v2/ResourceVersion v2를 `resource_store`와 `resource_version_store` record로 projection함
- registry, ingestion, dashboard, policy query adapter binding이 모두 `resource-store-interface.v1`을 참조하도록 고정함
- Store Policy Adapter의 `resource_store` RLS/filter template과 resource query plan을 query interface로 연결하고 unconfirmed resource query plan이 executable이 아님을 검증함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 resource store interface를 통합함
- `/api/resource-store-interfaces`, `/api/resource-store-records`, `/api/resource-version-store-records`, `/api/resource-store-adapter-bindings`, `/api/resource-store-validations` route를 추가함

완료 기준:

- Resource Store Interface가 validation error 없이 `complete` 상태가 됨
- Resource v2와 ResourceVersion v2 fixture가 store record로 1:1 projection됨
- registry, ingestion, dashboard adapter binding이 같은 interface contract를 참조함
- resource query interface가 tenant, matter, classification, resource filter를 요구하고 store policy RLS template에 연결됨
- unassigned/unconfirmed resource query plan은 executable 상태로 열리지 않음
- Review Dashboard summary와 stage status에서 resource store interface 상태, record count, adapter binding count, filter/query plan count, validation 상태가 노출됨
- Review API smoke가 interface, records, version records, adapter bindings, validation route를 모두 조회함
- Golden fixture 수가 35개로 증가하고 resource store interface가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run resource:store-interface -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 134: Immutable Object Store Layout

목표: raw source와 generated output이 충돌 없이 immutable object key로 resolve되도록 path resolver 계약을 고정한다.

구현 내용:

- `src/immutable-object-store-layout.mjs`, `scripts/immutable-object-store-layout.mjs`, `schemas/immutable-object-store-layout.schema.json`, `docs/immutable-object-store-layout.md`를 추가함
- `npm run object-store:layout -- --check` 명령을 추가해 layout contract, raw source path, generated output path, resolver, collision report, validation report, summary markdown을 생성함
- Resource Store Interface의 ResourceVersion store record를 `raw-source` namespace의 content-addressed object key로 projection함
- OutputArtifact/Delivery v2 contract의 OutputArtifact를 `generated-output` namespace의 content-addressed object key로 projection함
- object key가 tenant, matter, namespace, stable id, content hash를 포함하고 절대 로컬 source path를 포함하지 않음을 검증함
- raw source/generated output namespace를 분리하고 duplicate object key collision이 0개임을 검증함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 immutable object store layout을 통합함
- `/api/immutable-object-store-layouts`, `/api/object-path-resolvers`, `/api/raw-source-object-paths`, `/api/generated-output-object-paths`, `/api/object-store-collisions`, `/api/object-store-layout-validations` route를 추가함

완료 기준:

- Immutable Object Store Layout이 validation error 없이 `complete` 상태가 됨
- raw source object path 수가 ResourceVersion store record 수와 일치함
- generated output object path 수가 OutputArtifact v2 수와 일치함
- raw source와 generated output이 서로 다른 namespace와 resolver를 사용함
- 모든 object key가 `object-store/immutable` 아래에 있고 content hash segment를 포함함
- object key collision이 0개이고 절대 source path가 key에 포함되지 않음
- Review Dashboard summary와 stage status에서 layout status, resolver count, raw/generated path count, collision count, validation 상태가 노출됨
- Review API smoke가 layout, resolver, raw source path, generated output path, collision, validation route를 모두 조회함
- Golden fixture 수가 36개로 증가하고 immutable object store layout이 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run object-store:layout -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 135: Resource Version Ledger

목표: 동일 `source_system + external_id` 안에서 ResourceVersion의 변경, 중복, skipped duplicate 후보를 분리하는 version ledger를 구현한다.

구현 내용:

- `src/resource-version-ledger.mjs`, `scripts/resource-version-ledger.mjs`, `schemas/resource-version-ledger.schema.json`, `docs/resource-version-ledger.md`를 추가함
- `npm run resource:version-ledger -- --check` 명령을 추가해 version family, version event, version transition, duplicate candidate, object path binding, validation report, summary markdown을 생성함
- Resource Store Interface의 ResourceVersion store record를 `source_system + external_id` family로 묶음
- 같은 external id에서 content hash가 바뀌면 `content_changed`, 같은 content hash가 반복되면 `duplicate_content`, resource ingest의 skipped duplicate는 `duplicate_candidate_skipped`로 분리함
- P134 raw-source immutable object path와 모든 ResourceVersion을 binding함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 resource version ledger를 통합함
- `/api/resource-version-ledgers`, `/api/resource-version-families`, `/api/resource-version-events`, `/api/resource-version-transitions`, `/api/resource-duplicate-candidates`, `/api/resource-version-object-bindings`, `/api/resource-version-ledger-validations` route를 추가함

완료 기준:

- Resource Version Ledger가 validation error 없이 `complete` 상태가 됨
- 모든 ResourceVersion store record가 정확히 하나의 version family에 들어감
- version event가 모든 ResourceVersion과 skipped duplicate 후보를 커버함
- duplicate candidate count가 Resource Ingest duplicate count와 일치함
- 모든 ResourceVersion이 P134 raw-source immutable object path에 binding됨
- changed content, duplicate content, duplicate candidate event type이 ledger contract에 고정됨
- Review Dashboard summary와 stage status에서 family/version/current/duplicate/object binding/validation 상태가 노출됨
- Review API smoke가 ledger, family, event, transition, duplicate candidate, object binding, validation route를 모두 조회함
- Golden fixture 수가 37개로 증가하고 resource version ledger가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run resource:version-ledger -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 136: Normalized Text Contract

목표: extraction output의 normalized text를 source span 생성에 필요한 offset/page/paragraph/line 좌표가 보존된 contract artifact로 승격한다.

구현 내용:

- `src/normalized-text-contract.mjs`, `scripts/normalized-text-contract.mjs`, `schemas/normalized-text-contract.schema.json`, `docs/normalized-text-contract.md`를 추가함
- `npm run resource:normalized-text -- --check` 명령을 추가해 normalized text artifact, location map, source span seed, validation report, summary markdown을 생성함
- Resource Ingest의 `normalized-text.v1`을 Resource Store Interface의 ResourceVersion store record, Resource Version Ledger family, P134 raw-source immutable object key에 binding함
- 각 normalized text에 `utf16_code_unit` 기준 char range, page unit, paragraph unit, line unit을 생성하고 source span seed가 page range와 char offset을 보존하도록 함
- page marker나 form-feed가 없으면 synthetic page 1을 부여해 P138 source span store가 최소 page 좌표를 항상 받을 수 있게 함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 normalized text contract를 통합함
- `/api/normalized-text-contracts`, `/api/normalized-text-artifacts`, `/api/normalized-text-location-maps`, `/api/normalized-source-span-seeds`, `/api/normalized-text-validations` route를 추가함

완료 기준:

- Normalized Text Contract가 validation error 없이 `complete` 상태가 됨
- normalized text artifact 수가 Resource Ingest normalized text 수와 일치함
- 모든 artifact가 ResourceVersion, Resource Version Ledger family, raw-source object key에 binding됨
- 모든 artifact가 text hash, tenant, matter, classification을 보존함
- 모든 location map이 page, paragraph, line offset unit과 canonical offset unit을 가짐
- 모든 source span seed가 ready 상태이고 page range와 char range를 보존함
- Review Dashboard summary와 stage status에서 artifact/location/source-span-seed/page/paragraph/line/validation 상태가 노출됨
- Review API smoke가 normalized text contract, artifact, location map, source span seed, validation route를 모두 조회함
- Golden fixture 수가 38개로 증가하고 normalized text contract가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run resource:normalized-text -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 137: Extractor Adapter Contract

목표: parser/OCR extractor를 공통 input/output contract와 local-only adapter boundary로 감싸서 문서 유형별 extractor가 downstream Resource/Evidence plane에 동일한 계약으로 노출되게 한다.

구현 내용:

- `src/extractor-adapter-contract.mjs`, `scripts/extractor-adapter-contract.mjs`, `schemas/extractor-adapter-contract.schema.json`, `docs/extractor-adapter-contract.md`를 추가함
- `npm run resource:extractor-adapters -- --check` 명령을 추가해 extractor adapter catalog, extractor I/O contract, document type binding, OCR fallback policy, normalized text binding, validation report, summary markdown을 생성함
- P136 Normalized Text Contract의 모든 normalized text artifact를 `extractor_id` 기준으로 등록된 adapter와 I/O contract에 binding함
- plain text, DOCX, PPTX, XLSX, PDF, Outlook EML, Claude plugin archive, ZIP archive, malformed archive header 계열 extractor를 `extractor-adapter.v1` 형식으로 정규화함
- PDF OCR fallback은 기본적으로 local/manual only로 고정하고 external OCR/API 사용은 별도 policy snapshot 없이 금지함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 extractor adapter contract를 통합함
- `/api/extractor-adapter-contracts`, `/api/extractor-adapters`, `/api/extractor-io-contracts`, `/api/extractor-document-type-bindings`, `/api/ocr-fallback-policies`, `/api/extractor-normalized-text-bindings`, `/api/extractor-adapter-validations` route를 추가함

완료 기준:

- Extractor Adapter Contract가 validation error 없이 `complete` 상태가 됨
- extractor adapter 수와 extractor I/O contract 수가 일치함
- 모든 adapter가 local deterministic, no external service, no network access 기본값을 가짐
- 모든 P136 normalized text artifact가 adapter, I/O contract, document type binding에 bound 상태로 연결됨
- unbound normalized text count와 external-service adapter count가 0임
- PDF OCR fallback policy가 local/manual only로 등록됨
- Review Dashboard summary와 stage status에서 adapter/I/O/document binding/OCR policy/normalized text binding/validation 상태가 노출됨
- Review API smoke가 extractor contract, adapter, I/O contract, document binding, OCR policy, normalized text binding, validation route를 모두 조회함
- Golden fixture 수가 39개로 증가하고 extractor adapter contract가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run resource:extractor-adapters -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 138: Source Span Store

목표: normalized text와 extractor adapter binding을 근거 위치 단위로 materialize해 downstream evidence/fact/issue/citation 계층이 원문 좌표를 일관되게 참조하게 한다.

구현 내용:

- `src/source-span-store.mjs`, `scripts/source-span-store.mjs`, `schemas/source-span-store.schema.json`, `docs/source-span-store.md`를 추가함
- `npm run resource:source-spans -- --check` 명령을 추가해 source span store, source span catalog, locator rows, location unit rows, source span index, validation report, summary markdown을 생성함
- P136 Normalized Text Contract의 모든 source span seed를 P137 Extractor Adapter Contract의 normalized text binding과 결합함
- 각 normalized text artifact마다 `whole_document`, `page`, `paragraph`, `line`, `char_range` source span을 생성하고 `utf16_code_unit` 기준 offset을 보존함
- 파일 기반 source에는 timestamp 좌표를 임의 생성하지 않고 `timestamp_status: not_applicable`로 명시해 영상/음성 transcript 확장 지점을 남김
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 source span store를 통합함
- `/api/source-span-stores`, `/api/source-spans`, `/api/source-span-locators`, `/api/source-span-location-units`, `/api/source-span-indexes`, `/api/source-span-validations` route를 추가함

완료 기준:

- Source Span Store가 validation error 없이 `complete` 상태가 됨
- 모든 P136 normalized text artifact가 whole document/page/paragraph/line/char range span을 각각 1개 이상 가짐
- source span, locator, location unit 수가 일치함
- 모든 source span이 P137 extractor adapter와 I/O contract binding을 보존함
- canonical offset 단위가 `utf16_code_unit`로 통일되고 char range span 수가 normalized text artifact 수와 일치함
- timestamp span은 0개이고 모든 file resource span은 `timestamp_status: not_applicable`로 조회됨
- Review Dashboard summary와 stage status에서 source span count, locator count, location unit count, page/paragraph/line/char range count, extractor binding, validation 상태가 노출됨
- Review API smoke가 source span store, span, locator, location unit, index, validation route를 모두 조회함
- Golden fixture 수가 40개로 증가하고 source span store가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run resource:source-spans -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 139: Evidence Item Store

목표: P138 Source Span Store의 source span을 attorney-reviewable evidence item 후보로 승격하고 matter/classification/policy snapshot boundary를 evidence 계층에 보존한다.

구현 내용:

- `src/evidence-item-store.mjs`, `scripts/evidence-item-store.mjs`, `schemas/evidence-item-store.schema.json`, `docs/evidence-item-store.md`를 추가함
- `npm run resource:evidence-items -- --check` 명령을 추가해 evidence item store, evidence item rows, source-span binding rows, review queue rows, index, validation report, summary markdown을 생성함
- 모든 P138 `source-span.v2` row에서 `evidence-item.v2` 후보를 하나씩 생성함
- `tenant_id`, `matter_id`, `classification`, `policy_snapshot_id`, `resource_id`, `resource_version_id`, `normalized_text_id`, `location_type`을 source span에서 evidence item으로 보존함
- evidence item과 source span의 연결을 `evidence-source-span-binding.v1` row로 분리하고 matter/classification/policy snapshot preservation 여부를 검증함
- 모든 machine-extracted evidence item을 `needs_review`와 `machine_extracted_pending_review`로 두고 자동 승인 count를 0으로 유지함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 evidence item store를 통합함
- `/api/evidence-item-stores`, `/api/evidence-items`, `/api/evidence-source-span-bindings`, `/api/evidence-review-queue`, `/api/evidence-item-indexes`, `/api/evidence-item-store-validations` route를 추가함

완료 기준:

- Evidence Item Store가 validation error 없이 `complete` 상태가 됨
- evidence item 수가 source span 수와 일치함
- 모든 evidence item이 source span binding과 review queue row를 가짐
- 모든 evidence item이 source span의 matter, classification, policy snapshot을 보존함
- 모든 machine-extracted evidence item이 human review 대기 상태이고 자동 approved count는 0임
- Review Dashboard summary와 stage status에서 evidence item count, source-span binding count, review queue count, matter/classification/policy snapshot preservation, validation 상태가 노출됨
- Review API smoke가 evidence item store, evidence item, source-span binding, review queue, index, validation route를 모두 조회함
- Golden fixture 수가 41개로 증가하고 evidence item store가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run resource:evidence-items -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 140: Fact Claim Store

목표: P139 Evidence Item Store의 evidence item을 attorney-reviewable fact claim 후보로 승격하고 evidence id와 reliability를 fact 계층에 보존한다.

구현 내용:

- `src/fact-claim-store.mjs`, `scripts/fact-claim-store.mjs`, `schemas/fact-claim-store.schema.json`, `docs/fact-claim-store.md`를 추가함
- `npm run resource:fact-claims -- --check` 명령을 추가해 fact claim store, fact claim rows, evidence binding rows, fact review queue rows, index, validation report, summary markdown을 생성함
- 모든 P139 `evidence-item.v2` row에서 `fact-claim.v2` 후보를 하나씩 생성함
- `evidence_item_ids`, `primary_evidence_item_id`, `source_span_ids`, `tenant_id`, `matter_id`, `classification`, `policy_snapshot_id`, `reliability`를 evidence item에서 fact claim으로 보존함
- fact claim과 evidence item의 연결을 `fact-evidence-binding.v1` row로 분리하고 reliability/matter/classification/policy snapshot preservation 여부를 검증함
- 모든 machine-extracted fact claim을 `needs_review`와 `machine_extracted_pending_review`로 두고 자동 승인 count를 0으로 유지함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 fact claim store를 통합함
- `/api/fact-claim-stores`, `/api/fact-claims`, `/api/fact-evidence-bindings`, `/api/fact-review-queue`, `/api/fact-claim-indexes`, `/api/fact-claim-store-validations` route를 추가함

완료 기준:

- Fact Claim Store가 validation error 없이 `complete` 상태가 됨
- fact claim 수가 evidence item 수와 일치함
- 모든 fact claim이 evidence binding과 review queue row를 가짐
- 모든 fact claim이 evidence id, reliability, matter, classification, policy snapshot, source span link를 보존함
- 모든 machine-extracted fact claim이 human review 대기 상태이고 자동 approved count는 0임
- Review Dashboard summary와 stage status에서 fact claim count, evidence binding count, review queue count, reliability/matter/classification/policy snapshot preservation, validation 상태가 노출됨
- Review API smoke가 fact claim store, fact claim, evidence binding, review queue, index, validation route를 모두 조회함
- Golden fixture 수가 42개로 증가하고 fact claim store가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run resource:fact-claims -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 141: Issue Graph Store

목표: P140 Fact Claim Store의 fact claim을 attorney-reviewable issue 후보로 승격하고 fact, issue, legal rule placeholder, risk severity assessment를 같은 lineage 아래에 연결한다.

구현 내용:

- `src/issue-graph-store.mjs`, `scripts/issue-graph-store.mjs`, `schemas/issue-graph-store.schema.json`, `docs/issue-graph-store.md`를 추가함
- `npm run resource:issue-graph -- --check` 명령을 추가해 issue graph store, issue rows, fact issue binding rows, legal rule placeholder rows, legal rule binding rows, risk severity assessment rows, issue review queue rows, index, validation report, summary markdown을 생성함
- 모든 P140 `fact-claim.v2` row에서 `issue.v2` 후보를 하나씩 생성함
- `tenant_id`, `matter_id`, `classification`, `policy_snapshot_id`, `linked_fact_ids`, `evidence_item_ids`를 fact claim에서 issue로 보존함
- issue와 fact claim의 연결을 `fact-issue-binding.v1` row로 분리하고 matter/classification/policy snapshot/evidence link preservation 여부를 검증함
- issue별 legal rule placeholder와 `issue-legal-rule-binding.v1` row를 만들되 모든 법률 rule은 `requires_attorney_confirmation` 상태로 유지함
- issue별 risk severity assessment와 issue review queue row를 생성하고 자동 승인 count를 0으로 유지함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 issue graph store를 통합함
- `/api/issue-graph-stores`, `/api/issues`, `/api/fact-issue-bindings`, `/api/legal-rules`, `/api/issue-legal-rule-bindings`, `/api/risk-severity-assessments`, `/api/issue-review-queue`, `/api/issue-graph-indexes`, `/api/issue-graph-store-validations` route를 추가함

완료 기준:

- Issue Graph Store가 validation error 없이 `complete` 상태가 됨
- issue 수가 fact claim 수와 일치함
- 모든 issue가 fact binding, legal rule binding, risk severity assessment, review queue row를 가짐
- 모든 issue가 fact claim의 matter, classification, policy snapshot, evidence link를 보존함
- 모든 legal rule placeholder와 risk severity assessment가 attorney/human review required 상태로 남음
- 모든 machine-extracted issue가 human review 대기 상태이고 자동 approved count는 0임
- Review Dashboard summary와 stage status에서 issue count, legal rule placeholder count, risk severity assessment count, review queue count, matter/classification/policy/evidence preservation, validation 상태가 노출됨
- Review API smoke가 issue graph store, issue, fact issue binding, legal rule, legal rule binding, risk severity assessment, review queue, index, validation route를 모두 조회함
- Golden fixture 수가 43개로 증가하고 issue graph store가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run resource:issue-graph -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 142: Citation Object Store

목표: P141 Issue Graph Store의 review-pending issue 후보를 output paragraph 후보와 source span citation 객체로 연결해, 법률 산출물 문단이 어떤 원자료 span에 기대는지 객체 수준에서 추적 가능하게 만든다.

구현 내용:

- `src/citation-object-store.mjs`, `scripts/citation-object-store.mjs`, `schemas/citation-object-store.schema.json`, `docs/citation-object-store.md`를 추가함
- `npm run resource:citations -- --check` 명령을 추가해 citation object store, output paragraph rows, citation rows, paragraph-source binding rows, citation review queue, index, validation report, summary markdown을 생성함
- 모든 P141 `issue.v2` row에서 `output-paragraph.v1` 후보를 하나씩 생성하고 `citation.v2` 객체를 source span마다 생성함
- `tenant_id`, `matter_id`, `classification`, `policy_snapshot_id`, `issue_id`, `fact_id`, `evidence_item_id`, `source_span_id`를 issue graph에서 citation 객체로 보존함
- output paragraph와 source span의 연결을 `paragraph-source-binding.v1` row로 분리하고 matter/classification/policy snapshot/issue link preservation 여부를 검증함
- 모든 citation과 output paragraph를 `needs_review`, `not_client_facing`, `client_facing_ready=false` 상태로 유지해 변호사 검토 전 고객 제출 가능 상태가 되지 않도록 함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 citation object store를 통합함
- `/api/citation-object-stores`, `/api/output-paragraphs`, `/api/citations`, `/api/paragraph-source-bindings`, `/api/citation-review-queue`, `/api/citation-indexes`, `/api/citation-object-store-validations` route를 추가함

완료 기준:

- Citation Object Store가 validation error 없이 `complete` 상태가 됨
- output paragraph 수가 issue 수와 일치함
- 모든 output paragraph가 하나 이상의 citation object를 가지고 client-facing 상태가 아님
- 모든 citation이 source span, issue, fact, evidence item, output paragraph에 연결됨
- 모든 paragraph-source binding이 bound 상태이고 matter, classification, policy snapshot, issue link를 보존함
- 모든 citation이 human review 대기 상태이고 자동 approved count와 client-facing ready count는 0임
- Review Dashboard summary와 stage status에서 output paragraph count, citation count, paragraph-source binding count, source-span binding, preservation, review 상태가 노출됨
- Review API smoke가 citation object store, output paragraph, citation, paragraph-source binding, review queue, index, validation route를 모두 조회함
- Golden fixture 수가 44개로 증가하고 citation object store가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run resource:citations -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 143: Lineage Graph Builder

목표: P142 Citation Object Store의 citation 객체를 source span, evidence item, fact claim, issue, output paragraph 경로로 재구성해 산출물 문단의 근거 lineage를 graph artifact로 재현한다.

구현 내용:

- `src/lineage-graph-builder.mjs`, `scripts/lineage-graph-builder.mjs`, `schemas/lineage-graph-builder.schema.json`, `docs/lineage-graph-builder.md`를 추가함
- `npm run resource:lineage-graph -- --check` 명령을 추가해 lineage graph, node, edge, path, index, validation report, summary markdown을 생성함
- citation object마다 `source_span -> evidence_item -> fact_claim -> issue -> output_paragraph` canonical path를 생성하고, `source_span -> output_paragraph` direct citation edge도 함께 기록함
- `lineage-node.v1`, `lineage-edge.v1`, `lineage-path.v1` row를 분리하고 complete path마다 canonical edge 5개를 검증함
- `tenant_id`, `matter_id`, `classification`, `policy_snapshot_id`가 source/evidence/fact/issue/output 전체 path에서 유지되는지 필드별로 검증함
- 모든 lineage path가 citation-bound, review-pending, not-client-facing 상태를 유지하도록 gate를 추가함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 lineage graph builder를 통합함
- `/api/lineage-graphs`, `/api/lineage-nodes`, `/api/lineage-edges`, `/api/lineage-paths`, `/api/lineage-indexes`, `/api/lineage-graph-validations` route를 추가함

완료 기준:

- Lineage Graph Builder가 validation error 없이 `complete` 상태가 됨
- lineage path 수가 citation 수와 일치하고 모든 path가 complete 상태임
- 모든 complete path가 source, evidence, fact, issue, output node와 canonical edge 5개를 가짐
- 모든 edge가 complete 상태이고 모든 node가 원천 store 객체로 resolve됨
- 모든 path가 matter, classification, policy snapshot을 보존함
- 모든 output path가 `needs_review`, `not_client_facing`, `client_facing_ready=false` 상태를 유지함
- Review Dashboard summary와 stage status에서 node, edge, path, preservation, citation-bound, review/client-facing 상태가 노출됨
- Review API smoke가 lineage graph, node, edge, path, index, validation route를 모두 조회함
- Golden fixture 수가 45개로 증가하고 lineage graph builder가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run resource:lineage-graph -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 144: Evidence Coverage Scoring

목표: P143 lineage path를 기준으로 산출물 문단별 claim/date/party/amount/legal_basis coverage를 계산해, 로펌 산출물이 human review 전에 근거 부족 지점을 명시적으로 드러내도록 한다.

구현 내용:

- `src/evidence-coverage-score.mjs`, `scripts/evidence-coverage-score.mjs`, `schemas/evidence-coverage-score.schema.json`, `docs/evidence-coverage-score.md`를 추가함
- `npm run resource:evidence-coverage -- --check` 명령을 추가해 coverage score, coverage dimension, coverage index, validation report, summary markdown을 생성함
- lineage path마다 하나의 `coverage-score.v1`을 생성하고 claim, date, party, amount, legal_basis 5개 `coverage-dimension.v1`을 계산함
- claim과 legal_basis는 항상 required로 두고, date/party/amount는 deterministic signal이 있을 때 required로 승격함
- legal_basis는 issue legal rule placeholder binding을 기준으로 covered로 계산하되 attorney confirmation이 필요한 상태로 유지함
- 모든 coverage score가 matter, classification, policy snapshot을 보존하고 `needs_review`, `not_client_facing`, `client_facing_ready=false` 상태를 유지하도록 gate를 추가함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 evidence coverage score를 통합함
- `/api/evidence-coverage-scores`, `/api/evidence-coverage-records`, `/api/evidence-coverage-dimensions`, `/api/evidence-coverage-indexes`, `/api/evidence-coverage-validations` route를 추가함

완료 기준:

- Evidence Coverage Score가 validation error 없이 `complete` 상태가 됨
- coverage score 수가 lineage path 수와 일치함
- 모든 coverage score가 5개 dimension을 가지며 claim과 legal_basis가 covered 상태임
- 모든 coverage score가 matter, classification, policy snapshot을 보존함
- 모든 coverage score가 `needs_review`, `not_client_facing`, `client_facing_ready=false` 상태를 유지함
- missing required date/party/amount는 자동 제출 실패가 아니라 human review 보완 대상으로 노출됨
- Review Dashboard summary와 stage status에서 score, dimension, coverage status, preservation, review/client-facing 상태가 노출됨
- Review API smoke가 evidence coverage score, record, dimension, index, validation route를 모두 조회함
- Golden fixture 수가 46개로 증가하고 evidence coverage score가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run resource:evidence-coverage -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 145: Evidence Flags

목표: P144 coverage score마다 자동추출 상태, 사람확인 상태, privilege 상태, redaction 상태, 외부전송 가능 상태를 별도 flag decision으로 분리해 로펌 evidence가 human review 전에는 client-facing 또는 외부전송-ready로 오인되지 않도록 한다.

구현 내용:

- `src/evidence-flags.mjs`, `scripts/evidence-flags.mjs`, `schemas/evidence-flags.schema.json`, `docs/evidence-flags.md`를 추가함
- `npm run resource:evidence-flags -- --check` 명령을 추가해 evidence flag record, flag decision, flag index, validation report, summary markdown을 생성함
- coverage score마다 하나의 `evidence-flag-record.v1`을 생성하고 extraction, human_confirmation, privilege, redaction, external_transfer 5개 `evidence-flag-decision.v1`을 분리함
- machine-extracted reliability와 pending human confirmation을 서로 다른 flag로 보존해 agent self-report와 사람 확인을 혼동하지 않도록 함
- P2 client confidential 자료는 `client_confidential_review_required`, `redaction_review_required`, `external_transfer_requires_approval`로 보수적으로 판정하고 P3-P5 또는 민감 signal은 차단/검토 상태로 승격함
- 모든 evidence flag record가 matter, classification, policy snapshot을 보존하고 `needs_review`, `not_client_facing`, `client_facing_ready=false` 상태를 유지하도록 gate를 추가함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 evidence flags를 통합함
- `/api/evidence-flags`, `/api/evidence-flag-records`, `/api/evidence-flag-decisions`, `/api/evidence-flag-indexes`, `/api/evidence-flag-validations` route를 추가함

완료 기준:

- Evidence Flags가 validation error 없이 `complete` 상태가 됨
- evidence flag record 수가 coverage score 수와 일치함
- flag decision 수가 evidence flag record 수의 5배와 일치함
- 모든 record가 extraction/human_confirmation/privilege/redaction/external_transfer flag를 별도 decision으로 가짐
- 모든 machine-extracted record가 pending human confirmation 상태로 유지되어 사람 확인 전 자동 승인되지 않음
- 모든 record가 matter, classification, policy snapshot을 보존함
- 모든 record가 `needs_review`, `not_client_facing`, `client_facing_ready=false` 상태를 유지함
- Review Dashboard summary와 stage status에서 flag count, privilege/redaction/external-transfer 상태, preservation, review/client-facing 상태가 노출됨
- Review API smoke가 evidence flags, record, decision, index, validation route를 모두 조회함
- Golden fixture 수가 47개로 증가하고 evidence flags가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run resource:evidence-flags -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 146: Exhibit Mapping

목표: Evidence Flags로 분리된 review-pending 근거를 보고서/소송서면의 별첨번호 체계에 연결해, citation renderer 이전 단계에서도 `별첨 n -> evidence/citation/output paragraph/lineage path` 경로가 재현되도록 한다.

구현 내용:

- `src/exhibit-map.mjs`, `scripts/exhibit-map.mjs`, `schemas/exhibit-map.schema.json`, `docs/exhibit-mapping.md`를 추가함
- `npm run resource:exhibit-map -- --check` 명령을 추가해 exhibit map, record, binding, index, validation report, summary markdown을 생성함
- P145 evidence flag record마다 하나의 `exhibit-record.v1`을 생성하고 `별첨 n`, `EX-000n`, report/litigation brief target을 부여함
- 각 exhibit record마다 evidence item, citation object, output paragraph, lineage path로 향하는 4개 `exhibit-binding.v1`을 생성함
- matter, classification, policy snapshot, privilege/redaction/external-transfer 상태를 exhibit layer까지 보존함
- 모든 exhibit가 `needs_review`, `attorney_review_required=true`, `not_client_facing`, `client_facing_ready=false` 상태를 유지하도록 gate를 추가함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 exhibit map을 통합함
- `/api/exhibit-maps`, `/api/exhibit-records`, `/api/exhibit-bindings`, `/api/exhibit-indexes`, `/api/exhibit-map-validations` route를 추가함

완료 기준:

- Exhibit Map이 validation error 없이 `complete` 상태가 됨
- exhibit record 수가 evidence flag record, citation, lineage path, coverage score 수와 일치함
- exhibit binding 수가 exhibit record 수의 4배와 일치함
- 모든 exhibit가 evidence, citation, output paragraph, lineage path에 bound 상태로 연결됨
- 모든 exhibit가 matter, classification, policy snapshot을 보존함
- 모든 exhibit가 attorney review 전에는 client-facing ready가 아님
- Review Dashboard summary와 stage status에서 exhibit count, binding count, preservation, review/client-facing 상태가 노출됨
- Review API smoke가 exhibit map, record, binding, index, validation route를 모두 조회함
- Golden fixture 수가 48개로 증가하고 exhibit map이 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run resource:exhibit-map -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 147: Chain of Custody Events

목표: P146 Exhibit Map까지 이어진 resource/evidence/output 경로를 append-only custody event ledger로 묶어, 업로드, 정규화, 추출, 검토, 승인대기 상태가 actor, matter, classification, policy snapshot, event hash와 함께 재현되도록 한다.

구현 내용:

- `src/chain-of-custody-events.mjs`, `scripts/chain-of-custody-events.mjs`, `schemas/chain-of-custody-events.schema.json`, `docs/chain-of-custody-events.md`를 추가함
- `npm run resource:custody-events -- --check` 명령을 추가해 custody ledger, event rows, event link rows, stage index, validation report, summary markdown을 생성함
- ResourceVersion마다 `upload`, NormalizedTextArtifact마다 `normalize`, Exhibit record마다 `extract -> review -> approve` custody event를 생성함
- 각 event가 `custody_chain_id`, global/chain sequence, previous event hash, event hash, actor, subject, linked refs를 보존함
- resource chain은 upload/normalize, evidence chain은 extract/review/approve-hold 단계가 모두 포함되도록 검증함
- `review`와 `approve` 단계는 사람 승인 actor가 필요하며, 자동 approval 없이 `held_pending_human_approval` 상태로 남김
- 모든 event가 tenant, matter, classification, policy snapshot을 보존하고 `client_facing_ready=false`를 유지하도록 gate를 추가함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 custody event ledger를 통합함
- `/api/custody-event-ledgers`, `/api/custody-events`, `/api/custody-event-links`, `/api/custody-stage-indexes`, `/api/custody-event-validations` route를 추가함

완료 기준:

- Chain of Custody Events가 validation error 없이 `complete` 상태가 됨
- custody event 수가 resource version 수 + normalized text artifact 수 + exhibit record 수의 3배와 일치함
- upload, normalize, extract, review, approve stage count가 각 source artifact 수와 일치함
- 모든 event가 append-only/immutable이고 event hash를 가지며 chain 내 previous hash가 연결됨
- 모든 event가 matter, classification, policy snapshot, actor/runtime을 보존함
- 모든 review/approve event가 human approval actor를 요구하고 approve event는 자동 승인 없이 held 상태를 유지함
- 모든 event가 client-facing ready가 아님
- Review Dashboard summary와 stage status에서 custody event count, stage count, chain count, preservation, pending approval 상태가 노출됨
- Review API smoke가 custody ledger, event, link, stage index, validation route를 모두 조회함
- Golden fixture 수가 49개로 증가하고 chain of custody events가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run resource:custody-events -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 148: Search Index Contract

목표: Resource/Evidence/Lineage/Custody 계층 위에 검색 index 계약을 추가하되, 실제 검색 실행 전 단계에서 tenant, matter, classification, policy snapshot 필터를 필수로 요구하는 non-executable manifest/query plan으로 고정한다.

구현 내용:

- `src/search-index-contract.mjs`, `scripts/search-index-contract.mjs`, `schemas/search-index-contract.schema.json`, `docs/search-index-contract.md`를 추가함
- `npm run resource:search-index -- --check` 명령을 추가해 search index contract, manifest rows, field catalog rows, held query plan rows, validation report, summary markdown을 생성함
- Resource store, ResourceVersion, normalized text, source span, evidence item, fact claim, issue, citation, lineage path, exhibit, custody event collection을 search source collection으로 등록함
- 모든 search manifest가 `tenant_id`, `matter_id`, `classification`, `policy_snapshot_id`를 required query filter로 선언하고 `matter_id`, `classification` 없는 query를 index access 전에 차단하도록 정의함
- 모든 query plan은 `held_for_retrieval_filter_compiler`, `executable=false`로 유지되어 P150 retrieval filter compiler 전에는 검색 실행이 불가능함
- 모든 query plan이 matter wall, classification, policy snapshot, pre-retrieval gate, source ref preservation을 명시하도록 검증함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 Search Index Contract를 통합함
- `/api/search-index-contracts`, `/api/search-index-manifests`, `/api/search-index-fields`, `/api/search-index-query-plans`, `/api/search-index-validations` route를 추가함

완료 기준:

- Search Index Contract가 validation error 없이 `complete` 상태가 됨
- search index manifest 수가 source collection 수와 일치함
- search index query plan 수가 manifest 수와 일치함
- required filter field 수가 manifest 수의 4배와 일치함
- 모든 query plan이 tenant, matter, classification, policy snapshot filter를 요구함
- 모든 query plan이 pre-retrieval gate와 matter wall/classification/policy snapshot boundary를 요구함
- 모든 query plan이 held 상태이며 executable query plan 수는 0임
- 모든 query plan이 source ref preservation을 유지함
- Review Dashboard summary와 stage status에서 manifest, field, query plan, filter enforcement, held/executable count가 노출됨
- Review API smoke가 search index contract, manifest, field, query plan, validation route를 모두 조회함
- Golden fixture 수가 50개로 증가하고 search index contract가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run resource:search-index -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 149: Vector Index Policy Boundary

목표: Phase 148 search index query plan 위에 vector/embedding policy boundary를 추가하되, 실제 vector index나 embedding route는 실행하지 않고 matter wall, classification, external model policy, policy snapshot gate가 모두 적용된 held contract로 고정한다.

구현 내용:

- `src/vector-index-policy-boundary.mjs`, `scripts/vector-index-policy-boundary.mjs`, `schemas/vector-index-policy-boundary.schema.json`, `docs/vector-index-policy-boundary.md`를 추가함
- `npm run resource:vector-policy -- --check` 명령을 추가해 vector index policy boundary, vector policy gate rows, embedding route policy rows, validation report, summary markdown을 생성함
- P148 Search Index Contract의 11개 held query plan을 11개 `vector_policy_gate`로 1:1 감싸고, 각 gate가 `tenant_id`, `matter_id`, `classification`, `policy_snapshot_id` 필터를 필수로 요구하도록 고정함
- 각 vector policy gate가 matter wall, retrieval wall filter, matter access policy, classification policy, external model policy, policy snapshot reference를 보존하도록 구현함
- Model Policy Enforcement의 classification model gate 6개를 각 vector policy gate에 결합해 66개 embedding route policy를 생성함
- P2-P5 route는 external embedding이 허용되지 않고 approval 또는 forbidden 상태로만 남도록 검증함
- 모든 vector gate와 embedding route를 `held_for_vector_policy`, `executable=false`, `route_executable=false`로 유지해 P150 retrieval filter compiler 전에는 vector retrieval이 실행되지 않도록 함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 Vector Index Policy Boundary를 통합함
- `/api/vector-index-policies`, `/api/vector-policy-gates`, `/api/embedding-route-policies`, `/api/vector-policy-validations` route를 추가함

완료 기준:

- Vector Index Policy Boundary가 validation error 없이 `complete` 상태가 됨
- vector policy gate 수가 P148 search index query plan 수와 일치함
- embedding route policy 수가 vector policy gate 수와 classification model gate 수의 곱과 일치함
- 모든 vector policy gate가 matter wall, classification policy, external model policy, policy snapshot boundary를 enforce함
- 모든 vector policy gate와 embedding route가 held 상태이며 executable vector route 수는 0임
- P2-P5 embedding route가 external allow 없이 approval 또는 deny로 유지됨
- 모든 vector policy gate와 embedding route가 source ref preservation을 유지함
- Review Dashboard summary와 stage status에서 vector gate, embedding route, matter/model/classification enforcement, held/executable count가 노출됨
- Review API smoke가 vector policy boundary, vector gate, embedding route, validation route를 모두 조회함
- Golden fixture 수가 51개로 증가하고 vector index policy boundary가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run resource:vector-policy -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 150: Retrieval Filter Compiler

목표: P148 search index query plan과 P149 vector/embedding policy boundary를 실제 query adapter 앞에서 사용할 수 있는 compiled retrieval filter bundle로 묶되, query adapter가 없으면 검색 실행은 계속 금지한다.

구현 내용:

- `src/retrieval-filter-compiler.mjs`, `scripts/retrieval-filter-compiler.mjs`, `schemas/retrieval-filter-compiler.schema.json`, `docs/retrieval-filter-compiler.md`를 추가함
- `npm run resource:retrieval-filters -- --check` 명령을 추가해 compiled retrieval filter, retrieval query binding, blocked probe, validation report, summary markdown을 생성함
- P148의 11개 held search query plan마다 1개 `compiled_retrieval_filter`를 생성하고, 각 filter가 `tenant_id`, `matter_id`, `classification`, `policy_snapshot_id`, `wall_ids`, `access_audit_record_id` predicate를 필수로 요구하도록 고정함
- P149의 66개 embedding route policy마다 1개 `retrieval_query_binding`을 생성하고, route별 classification/external embedding policy decision/source ref를 보존함
- unscoped query, tenant 누락, matter 누락, classification 누락, policy snapshot 누락, cross-matter query probe를 모든 compiled filter에 적용하고 전부 blocked 상태로 검증함
- 모든 retrieval filter와 query binding을 `compiled_held_for_query_adapter`, `query_execution_allowed=false`, `executable=false`로 유지해 P151 이후 실제 retrieval adapter가 bound되기 전에는 검색 실행이 불가능하도록 함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 Retrieval Filter Compiler를 통합함
- `/api/retrieval-filter-compilers`, `/api/compiled-retrieval-filters`, `/api/retrieval-query-bindings`, `/api/retrieval-filter-probes`, `/api/retrieval-filter-validations` route를 추가함

완료 기준:

- Retrieval Filter Compiler가 validation error 없이 `complete` 상태가 됨
- compiled retrieval filter 수가 P148 search index query plan 및 P149 vector policy gate 수와 일치함
- retrieval query binding 수가 P149 embedding route policy 수와 일치함
- 모든 compiled filter가 tenant, matter, classification, policy snapshot, wall, access audit filter를 enforce함
- 모든 retrieval query binding이 non-executable 상태이며 executable query binding 수는 0임
- 모든 missing-filter/unscoped/cross-matter probe가 blocked 상태임
- P2-P5 retrieval binding이 external allow 없이 approval 또는 deny control을 유지함
- Review Dashboard summary와 stage status에서 compiled filter, query binding, enforcement, probe, executable count가 노출됨
- Review API smoke가 retrieval filter compiler, compiled filter, query binding, probe, validation route를 모두 조회함
- Golden fixture 수가 53개로 증가하고 retrieval filter compiler와 evidence golden fixtures가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run resource:retrieval-filters -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 151: Evidence Extraction Golden Cases

목표: LDD, 회의록, 계약서/SPA 협상 메시지, 고객 이메일 follow-up을 대표 evidence extraction golden case로 고정하고, 기대 evidence가 source span 및 Evidence Item Store 후보로 재현되는지 검증한다.

구현 내용:

- `src/evidence-golden-fixtures.mjs`, `scripts/evidence-golden-fixtures.mjs`, `schemas/evidence-golden-fixtures.schema.json`, `docs/evidence-golden-fixtures.md`를 추가함
- `npm run evidence:golden-fixtures -- --check` 명령을 추가해 evidence golden case, store match, extraction matrix, regression manifest, validation report, summary markdown을 생성함
- LDD VDR inventory, 이사회 의사록, SPA indemnity fallback 지시, disclosure schedule/tax memo 이메일을 대표 golden case로 고정함
- 각 golden case가 expected term, expected source span locator, observed extraction, EvidenceItem Store match, classification floor, human review requirement, local deterministic boundary를 검증함
- 모든 golden case에 regression hash를 부여하고 `locked` 상태가 아니면 validation error로 처리함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 Evidence Golden Fixtures를 통합함
- `/api/evidence-golden-fixtures`, `/api/evidence-golden-cases`, `/api/evidence-golden-store-matches`, `/api/evidence-regression-hashes`, `/api/evidence-golden-validations` route를 추가함

완료 기준:

- Evidence Golden Fixtures가 validation error 없이 `complete` 상태가 됨
- LDD, meeting minutes, contract, client email fixture group이 모두 포함됨
- 모든 golden case가 expected term을 빠짐없이 match하고 `locked` 상태가 됨
- 모든 golden case가 현재 Evidence Item Store 후보와 SourceSpan에 match됨
- 모든 golden extraction이 local deterministic 경계 안에서 실행되고 external service 사용 수가 0임
- 모든 golden evidence가 human review required 및 `needs_review` 상태를 유지함
- regression hash 수와 locked regression hash 수가 golden case 수와 일치함
- Review Dashboard summary와 stage status에서 case, store match, locked hash, validation count가 노출됨
- Review API smoke가 evidence golden fixture, case, store match, regression hash, validation route를 모두 조회함
- Golden fixture 수가 53개로 증가하고 evidence golden fixtures가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run evidence:golden-fixtures -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 152: Resource Dedup/Hash Ledger

목표: Resource Store와 Resource Version Ledger 위에 content hash, source external id, resource version 기준의 deterministic dedup ledger를 추가해 중복·변경·skipped duplicate 후보를 분류한다.

구현 내용:

- `src/resource-dedup-hash-ledger.mjs`, `scripts/resource-dedup-hash-ledger.mjs`, `schemas/resource-dedup-hash-ledger.schema.json`, `docs/resource-dedup-hash-ledger.md`를 추가함
- `npm run resource:dedup-hash -- --check` 명령을 추가해 hash group, external id group, dedup decision, duplicate candidate link, hash integrity check, validation report, summary markdown을 생성함
- 모든 ResourceVersion store record를 content hash group과 `source_system + external_id` group에 배정함
- 모든 ResourceVersion과 skipped duplicate candidate에 대해 `content_hash`, `external_id`, `resource_version` 기준을 가진 classification-only dedup decision을 생성함
- resource 및 resource version의 sha256 hash format/algorithm integrity check를 생성하고 실패 시 validation error로 처리함
- 중복 후보가 source/object/evidence/output 삭제로 이어지지 않도록 모든 decision을 `mutation_allowed=false`로 고정함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 Resource Dedup/Hash Ledger를 통합함
- `/api/resource-dedup-hash-ledgers`, `/api/resource-hash-groups`, `/api/resource-external-id-groups`, `/api/resource-dedup-decisions`, `/api/resource-duplicate-candidate-links`, `/api/resource-hash-integrity-checks`, `/api/resource-dedup-hash-validations` route를 추가함

완료 기준:

- Resource Dedup/Hash Ledger가 validation error 없이 `complete` 상태가 됨
- hash group과 external id group이 모든 ResourceVersion store record를 누락 없이 커버함
- dedup decision 수가 ResourceVersion 수와 skipped duplicate candidate 수의 합과 일치함
- 모든 resource-version decision이 content hash, external id, resource version 기준을 포함함
- 모든 dedup decision이 classification-only이며 destructive mutation을 허용하지 않음
- resource와 resource version hash integrity check가 모두 통과함
- Review Dashboard summary와 stage status에서 hash group, external id group, decision, integrity check, validation count가 노출됨
- Review API smoke가 dedup ledger, hash group, external id group, decision, candidate link, integrity check, validation route를 모두 조회함
- Golden fixture 수가 54개로 증가하고 resource dedup/hash ledger가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run resource:dedup-hash -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 153: Resource Quarantine Model

목표: Resource Expansion/Ingest와 Resource Dedup/Hash Ledger 위에 민감자료, extraction 오류, 암호화 또는 materialization 필요 자료, 대용량 자료, matter/type 불명확 자료, duplicate/hash hold 자료를 자동 보류하는 deterministic quarantine overlay를 추가한다.

구현 내용:

- `src/resource-quarantine-model.mjs`, `scripts/resource-quarantine-model.mjs`, `schemas/resource-quarantine-model.schema.json`, `docs/resource-quarantine-model.md`를 추가함
- `npm run resource:quarantine -- --check` 명령을 추가해 quarantine rule, held item, review queue, validation report, summary markdown을 생성함
- `sensitive_data`, `extraction_error`, `encrypted_or_materialization_required`, `oversized_file`, `ambiguous_matter_or_type`, `duplicate_or_hash_hold` 6개 필수 보류 category를 rule catalog로 고정함
- Resource Expansion의 P2 이상 classification, failed/quarantined/skipped duplicate, missing matter 또는 unclassified domain, Resource Dedup/Hash의 human-review-required decision을 quarantine item으로 투영함
- 모든 quarantine item이 retrieval, external transfer, output delivery, auto release를 허용하지 않고 `manual_release_receipt` 기반 human review queue에 묶임
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 Resource Quarantine Model을 통합함
- `/api/resource-quarantine-models`, `/api/resource-quarantine-rules`, `/api/resource-quarantine-items`, `/api/resource-quarantine-review-queue`, `/api/resource-quarantine-validations` route를 추가함

완료 기준:

- Resource Quarantine Model이 validation error 없이 `complete` 상태가 됨
- 6개 필수 quarantine category가 모두 rule catalog에 선언됨
- 민감자료, expansion failed/quarantined item, ambiguous matter/type item, duplicate/hash human-review-required decision이 보류 item으로 누락 없이 투영됨
- 모든 quarantine item이 retrieval/external transfer/output delivery/auto release를 차단하고 human review를 요구함
- review queue item 수가 quarantine item 수와 일치하고 모두 `pending_human_review` 상태임
- Review Dashboard summary와 stage status에서 rule, held item, category별 hold, review queue, validation count가 노출됨
- Review API smoke가 quarantine model, rule, held item, review queue, validation route를 모두 조회함
- Golden fixture 수가 55개로 증가하고 resource quarantine model이 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run resource:quarantine -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 154: Evidence Viewer Data API

목표: Source Span Store, Evidence Item Store, Lineage Graph Builder를 evidence viewer가 바로 조회할 수 있는 read-only API 데이터 계약으로 묶는다.

구현 내용:

- `src/evidence-viewer-data-api.mjs`, `scripts/evidence-viewer-data-api.mjs`, `schemas/evidence-viewer-data-api.schema.json`, `docs/evidence-viewer-data-api.md`를 추가함
- `npm run evidence:viewer-data -- --check` 명령을 추가해 viewer card, source span panel, lineage path panel, validation report, summary markdown을 생성함
- 모든 EvidenceItem을 하나의 viewer card로 투영하고, 각 card에 primary source span, source locator, lineage path sequence, review queue summary를 함께 노출함
- 모든 SourceSpan을 source span panel로 투영해 evidence id와 lineage path id를 역방향으로 조회할 수 있게 함
- 모든 LineagePath를 lineage path panel로 투영해 node sequence와 edge sequence를 viewer에서 바로 그릴 수 있게 함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 Evidence Viewer Data API를 통합함
- `/api/evidence-viewer-data`, `/api/evidence-viewer-cards`, `/api/evidence-viewer-source-spans`, `/api/evidence-viewer-lineage-paths`, `/api/evidence-viewer-data-validations` route를 추가함

완료 기준:

- Evidence Viewer Data API가 validation error 없이 `complete` 상태가 됨
- viewer card 수가 Evidence Item Store의 evidence item 수와 일치함
- 모든 viewer card가 source span과 lineage path를 하나 이상 가진다
- source span panel 수가 Source Span Store의 source span 수와 일치하고 모두 evidence item에 bound됨
- lineage path panel 수가 Lineage Graph Builder의 lineage path 수와 일치하고 모두 node/edge sequence를 가진다
- viewer data는 read-only이며 output delivery를 허용하지 않음
- Review Dashboard summary와 stage status에서 card, source span panel, lineage path panel, validation count가 노출됨
- Review API smoke가 evidence viewer data, card, source span panel, lineage path panel, validation route를 모두 조회함
- Golden fixture 수가 56개로 증가하고 evidence viewer data API가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run evidence:viewer-data -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 155: Evidence Export Bundle

목표: 산출물 검토자가 source, citation, coverage, lineage, exhibit 정보를 한 번에 확인할 수 있도록 내부 검토용 read-only evidence export bundle을 생성한다.

구현 내용:

- `src/evidence-export-bundle.mjs`, `scripts/evidence-export-bundle.mjs`, `schemas/evidence-export-bundle.schema.json`, `docs/evidence-export-bundle.md`를 추가함
- `npm run evidence:export-bundle -- --check` 명령을 추가해 export bundle, source package, citation package, coverage package, validation report, summary markdown을 생성함
- Evidence Viewer Data API, Citation Object Store, Evidence Coverage Score, Exhibit Map을 입력으로 삼아 coverage score마다 하나의 export bundle을 생성함
- 각 bundle은 source locator/preview, citation/output paragraph, coverage dimensions, lineage sequence, exhibit reference를 함께 포함함
- 모든 bundle을 `internal_review_only`, `held_for_attorney_review` 상태로 유지하고 output delivery, external transfer, client-facing delivery를 차단함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 Evidence Export Bundle을 통합함
- `/api/evidence-export-bundles`, `/api/evidence-export-bundle-records`, `/api/evidence-export-source-packages`, `/api/evidence-export-citation-packages`, `/api/evidence-export-coverage-packages`, `/api/evidence-export-bundle-validations` route를 추가함

완료 기준:

- Evidence Export Bundle이 validation error 없이 `complete` 상태가 됨
- export bundle 수가 coverage score, citation, exhibit record 수와 일치함
- 모든 bundle이 source, citation, coverage, lineage, exhibit package를 bound 상태로 가진다
- 모든 source package가 source locator와 preview를 포함함
- 모든 citation package가 source-bound 상태임
- 모든 coverage package가 coverage dimension을 포함함
- 모든 bundle이 matter, classification, policy snapshot을 보존함
- 모든 bundle이 attorney review 전에는 output delivery, external transfer, client-facing ready 상태가 아님
- Review Dashboard summary와 stage status에서 bundle, package, bound, review/delivery block, validation count가 노출됨
- Review API smoke가 evidence export bundle, record, source/citation/coverage package, validation route를 모두 조회함
- Golden fixture 수가 57개로 증가하고 evidence export bundle이 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run evidence:export-bundle -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 156: Evidence Regression Tests

목표: Evidence Plane의 extractor, lineage, coverage 결과를 별도 회귀 test suite로 고정해 기능 추가 후에도 증거 추출과 근거 추적이 깨지지 않도록 한다.

구현 내용:

- `src/evidence-regression-tests.mjs`, `scripts/evidence-regression-tests.mjs`, `schemas/evidence-regression-tests.schema.json`, `docs/evidence-regression-tests.md`를 추가함
- `npm run evidence:regression-tests -- --check` 명령을 추가해 regression suite, test case, regression hash, validation report, summary markdown을 생성함
- Evidence Golden Fixtures와 Extractor Adapter Contract를 기준으로 extractor golden case가 locked/store-matched/local deterministic 상태인지 검증함
- Lineage Graph Builder를 기준으로 source span -> evidence -> fact -> issue -> output paragraph 경로와 citation binding이 유지되는지 검증함
- Evidence Coverage Score와 Evidence Export Bundle을 기준으로 claim/legal basis coverage와 export bundle backing이 유지되는지 검증함
- 모든 regression test case에 sha256 regression hash를 남기고, 외부 서비스 사용과 client-facing output 상태를 차단함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 Evidence Regression Tests를 통합함
- `/api/evidence-regression-tests`, `/api/evidence-regression-suites`, `/api/evidence-regression-test-cases`, `/api/evidence-regression-hashes`, `/api/evidence-regression-validations` route를 추가함

완료 기준:

- Evidence Regression Tests가 validation error 없이 `complete` 상태가 됨
- extractor, lineage, coverage 3개 suite가 모두 `passed` 상태가 됨
- regression test case 수가 golden extractor case, lineage path, coverage score 수의 합과 일치함
- 모든 regression test case가 `passed` 상태이고 sha256 regression hash를 가진다
- coverage regression case가 Evidence Export Bundle backing을 가진다
- lineage/coverage regression case가 matter, classification, policy snapshot을 보존함
- 모든 regression test case가 local deterministic이며 external service와 client-facing output을 사용하지 않음
- Review Dashboard summary와 stage status에서 suite/test/hash/pass/fail/guard count가 노출됨
- Review API smoke가 regression suite, case, hash, validation route를 모두 조회함
- Golden fixture 수가 58개로 증가하고 evidence regression tests가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run evidence:regression-tests -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 157: Resource/Evidence Dashboard Summary

목표: Resource ingest, store, quarantine, evidence, viewer, coverage, export, regression 상태를 하나의 read-only 운영 dashboard summary로 묶어 Evidence Plane의 현재 상태를 matter/classification 단위로 확인할 수 있게 한다.

구현 내용:

- `src/resource-evidence-dashboard-summary.mjs`, `scripts/resource-evidence-dashboard-summary.mjs`, `schemas/resource-evidence-dashboard-summary.schema.json`, `docs/resource-evidence-dashboard-summary.md`를 추가함
- `npm run resource:evidence-dashboard -- --check` 명령을 추가해 dashboard summary, panel rows, matter rollups, classification rollups, validation report, summary markdown을 생성함
- Resource Ingest, Resource Store Interface, Resource Quarantine Model, Evidence Item Store, Evidence Viewer Data API, Evidence Coverage Score, Evidence Export Bundle, Evidence Regression Tests를 입력으로 삼아 8개 dashboard panel을 구성함
- Matter별, classification별로 resource, quarantine, evidence, coverage, export, pending review, retrieval block, delivery block, client-facing readiness를 rollup함
- Dashboard summary는 내부 운영 projection이며 output delivery, external transfer, client-facing legal output readiness를 직접 허용하지 않음
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 Resource/Evidence Dashboard Summary를 통합함
- `/api/resource-evidence-dashboard-summaries`, `/api/resource-evidence-panel-rows`, `/api/resource-evidence-matter-rollups`, `/api/resource-evidence-classification-rollups`, `/api/resource-evidence-dashboard-validations` route를 추가함

완료 기준:

- Resource/Evidence Dashboard Summary가 validation error 없이 `complete` 상태가 됨
- ingest, store, quarantine, evidence, viewer, coverage, export, regression 8개 panel이 모두 `ready` 상태가 됨
- matter rollup과 classification rollup이 하나 이상 생성됨
- promoted resource 수가 Resource Store record 수와 일치함
- evidence item 수가 coverage score 수와 일치하고 coverage score 수가 export bundle 수와 일치함
- quarantine item은 retrieval과 output delivery가 모두 차단됨
- coverage/export/regression 어디에서도 client-facing ready 상태가 생성되지 않음
- regression source가 external service를 사용하지 않음
- Review Dashboard summary와 stage status에서 panel, rollup, count, review/block guard, validation count가 노출됨
- Review API smoke가 dashboard summary, panel row, matter rollup, classification rollup, validation route를 모두 조회함
- Golden fixture 수가 59개로 증가하고 resource evidence dashboard summary가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run resource:evidence-dashboard -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 158: Evidence Plane Freeze

목표: P133-P157 Resource/Data/Evidence/Lineage Plane 산출물을 freeze report로 고정하고, 대표 law-firm resource가 resource -> source span -> evidence -> citation -> output -> event/run ledger -> custody path를 끝까지 통과하는지 증명한다.

구현 내용:

- `src/evidence-plane-freeze.mjs`, `scripts/evidence-plane-freeze.mjs`, `schemas/evidence-plane-freeze.schema.json`, `docs/evidence-plane-freeze.md`를 추가함
- `npm run resource:evidence-plane-freeze -- --check` 명령을 추가해 freeze report, source status, checkpoint, representative trace, freeze note, validation report, summary markdown을 생성함
- P133-P157 artifact와 Law Firm LDD Slice, Output/Delivery Contract Freeze, Event/Audit/Run Ledger Contract Freeze를 입력으로 삼아 freeze source status를 검증함
- 대표 confidential resource `resource.expansion.2d75da5656c0`가 source span, evidence item, LDD citation, evidence export bundle, output artifact, event record, run ledger, chain-of-custody event에 연결되는 representative trace를 생성함
- representative trace는 matter/classification/policy snapshot preservation, attorney review requirement, output delivery block, external transfer block, client-facing ready 0을 함께 검증함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 Evidence Plane Freeze를 통합함
- `/api/evidence-plane-freezes`, `/api/evidence-plane-freeze-sources`, `/api/evidence-plane-freeze-checkpoints`, `/api/evidence-plane-representative-traces`, `/api/evidence-plane-freeze-validations` route를 추가함

완료 기준:

- Evidence Plane Freeze가 validation error 없이 `frozen_with_pending_human_actions` 상태가 됨
- 모든 freeze source가 readable, expected status, validation clean, content hash locked 상태를 만족함
- representative trace가 하나 이상 있고 모든 trace가 `complete` 상태임
- 각 representative trace가 evidence, output artifact, event ledger, run ledger, custody event에 bound됨
- law-firm output은 attorney review required, blocked pending approval, external transfer blocked, client-facing ready 0으로 유지됨
- matter, classification, policy snapshot이 resource/evidence/output/export path에서 보존됨
- Review Dashboard summary와 stage status에서 freeze source, checkpoint, representative trace, output/audit/custody guard count가 노출됨
- Review API smoke가 evidence plane freeze, source, checkpoint, representative trace, validation route를 모두 조회함
- Golden fixture 수가 60개로 증가하고 evidence plane freeze가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run resource:evidence-plane-freeze -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 159: CloudEvents-style Event Envelope

목표: P107 EventRecord v2/AuditEvent v2 계약을 그대로 보존하면서, adapter와 future event bus가 공통으로 읽을 수 있는 CloudEvents-style envelope projection을 추가한다.

구현 내용:

- `src/event-envelope-ledger.mjs`, `scripts/event-envelope-ledger.mjs`, `schemas/event-envelope-ledger.schema.json`, `docs/event-envelope-ledger.md`를 추가함
- `npm run events:envelopes -- --check` 명령을 추가해 EventRecord v2와 AuditEvent v2를 `id`, `specversion`, `type`, `source`, `time`, `dataschema`, `datacontenttype`, `data` 필수 필드가 있는 envelope로 projection함
- 각 envelope에 `schemaversion`, `sourceschemaversion`, `correlationid`, `tenantid`, `matterid`, `workflowrunid`, `runledgerid`, `policysnapshotid`, `actortype`, `actorid`, `sourcekind`, `sourceid` extension field를 보존함
- envelope별 source binding을 생성해 `envelope_id`가 원 EventRecord/AuditEvent id로 round-trip되는지 검증함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 Event Envelope Ledger를 통합함
- `/api/event-envelope-ledgers`, `/api/event-envelopes`, `/api/event-envelope-source-bindings`, `/api/event-envelope-validations` route를 추가함

완료 기준:

- Event Envelope Ledger가 validation error 없이 `complete` 상태가 됨
- envelope 수가 EventRecord v2 수와 AuditEvent v2 수의 합과 일치함
- 모든 envelope가 CloudEvents-style required field, `specversion=1.0`, `dataschema`, `schemaversion`, JSON `data`를 가짐
- 모든 source binding이 `linked`, `round_trip_preserved`, `complete` required field 상태임
- protected action execution flag가 새 실행 없이 envelope projection에 보존되고 count로 노출됨
- Review Dashboard summary와 stage status에서 envelope, source binding, required field, schema, protected action audit count가 노출됨
- Review API smoke가 envelope ledger, envelope, source binding, validation route를 모두 조회함
- Golden fixture 수가 61개로 증가하고 event envelope ledger가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run events:envelopes -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 160: Event Type Registry

목표: Phase 159 event envelope ledger의 `type` 값을 resource, workflow, agent, gate, approval, output 중심의 운영 event family catalog로 고정한다.

구현 내용:

- `src/event-type-registry.mjs`, `scripts/event-type-registry.mjs`, `schemas/event-type-registry.schema.json`, `docs/event-type-registry.md`를 추가함
- `npm run events:types -- --check` 명령을 추가해 모든 event envelope를 event type record와 event type binding으로 catalog화함
- required event family `resource`, `workflow`, `agent`, `gate`, `approval`, `output`의 coverage를 별도 family record로 검증함
- 각 binding이 source envelope id, source kind, source schema version, dataschema, actor/tenant/matter/policy snapshot field를 보존함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 Event Type Registry를 통합함
- `/api/event-type-registries`, `/api/event-types`, `/api/event-families`, `/api/event-type-bindings`, `/api/event-type-registry-validations` route를 추가함

완료 기준:

- Event Type Registry가 validation error 없이 `complete` 상태가 됨
- event type binding 수가 source event envelope 수와 일치하고 모든 binding이 `bound`, `classified` 상태임
- required family 6개가 모두 `covered` 상태이고 missing required family가 0임
- 모든 event type record가 `registered` 상태이며 schema version과 dataschema binding이 보존됨
- Review Dashboard summary와 stage status에서 event type, family, binding, required coverage, schema/dataschema, validation count가 노출됨
- Review API smoke가 registry, type, family, binding, validation route를 모두 조회함
- Golden fixture 수가 62개로 증가하고 event type registry가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run events:types -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 161: Append-only Event Store

목표: Phase 159 event envelope와 Phase 160 event type registry를 수정 불가능한 append-only store projection으로 고정하고, 정정은 기존 event 수정이 아니라 새 correction event append로만 처리하게 한다.

구현 내용:

- `src/append-only-event-store.mjs`, `scripts/append-only-event-store.mjs`, `schemas/append-only-event-store.schema.json`, `docs/append-only-event-store.md`를 추가함
- `npm run events:store -- --check` 명령을 추가해 모든 event envelope를 stored event로 projection함
- stored event마다 global sequence, stream sequence, event hash, previous chain hash, chain hash, immutable status, mutation status를 기록함
- tenant/matter 기준 event stream을 생성하고 stream별 sequence continuity를 검증함
- correction policy를 별도 객체로 두어 in-place mutation을 금지하고 correction은 `event.correction.recorded` append event로만 허용함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 Append-only Event Store를 통합함
- `/api/append-only-event-stores`, `/api/stored-events`, `/api/event-streams`, `/api/event-correction-policies`, `/api/event-store-validations` route를 추가함

완료 기준:

- Append-only Event Store가 validation error 없이 `complete` 상태가 됨
- stored event 수가 source event envelope 수와 일치함
- 모든 stored event가 `appended`, `locked`, `not_mutated`, `bound`, `chained` 상태임
- global sequence와 stream sequence가 gap 없이 이어지고 duplicate event id가 0임
- correction policy가 `in_place_mutation_forbidden`, `in_place_mutation_allowed=false`로 검증됨
- Review Dashboard summary와 stage status에서 stored event, stream, hash chain, immutable, correction, mutation count가 노출됨
- Review API smoke가 event store, stored event, stream, correction policy, validation route를 모두 조회함
- Golden fixture 수가 63개로 증가하고 append-only event store가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run events:store -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 162: Event Correlation Ledger

목표: Phase 161 append-only event store 위에 correlation/causation projection을 올려, run-bound event가 matter/workflow/run/event trace로 재현되고 audit-only 외부 control event가 별도 trace로 드러나도록 한다.

구현 내용:

- `src/event-correlation-ledger.mjs`, `scripts/event-correlation-ledger.mjs`, `schemas/event-correlation-ledger.schema.json`, `docs/event-correlation-ledger.md`를 추가함
- `npm run events:correlation -- --check` 명령을 추가해 stored event를 correlation trace, causation edge, trace/run binding으로 projection함
- correlation trace마다 tenant, matter, workflow run, run ledger, event envelope, event type/family, first/last event time을 기록함
- causation edge는 `causation_id`를 기존 stored event envelope에 연결하고 missing cause를 validation failure로 처리함
- trace/run binding은 correlation trace를 `RunLedger v2`에 다시 연결하고 unknown run을 validation failure로 처리함
- run ledger가 없는 audit-only control event는 누락으로 숨기지 않고 `external_control` trace로 분류함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 Event Correlation Ledger를 통합함
- `/api/event-correlation-ledgers`, `/api/correlation-traces`, `/api/causation-edges`, `/api/trace-run-bindings`, `/api/event-correlation-validations` route를 추가함

완료 기준:

- Event Correlation Ledger가 validation error 없이 `complete` 상태가 됨
- 모든 stored event가 정확히 하나의 correlation trace에 포함됨
- 모든 run-bound trace가 matter/workflow/run/event id를 가지며, run ledger 없는 audit-only trace는 `external_control`로 명시됨
- 모든 causation edge가 existing stored event cause에 연결됨
- 모든 trace/run binding이 known RunLedger v2에 연결됨
- Review Dashboard summary와 stage status에서 trace, external control trace, causation edge, trace/run binding, missing id, validation count가 노출됨
- Review API smoke가 event correlation ledger, trace, causation edge, trace/run binding, validation route를 모두 조회함
- Golden fixture 수가 64개로 증가하고 event correlation ledger가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run events:correlation -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 163: Workflow Run Ledger

목표: Phase 162 Event Correlation Ledger의 run-bound trace를 workflow run ledger로 승격해, workflow state transition이 append-only event와 workflow ledger 양쪽에서 재현되도록 한다.

구현 내용:

- `src/workflow-run-ledger.mjs`, `scripts/workflow-run-ledger.mjs`, `schemas/workflow-run-ledger.schema.json`, `docs/workflow-run-ledger.md`를 추가함
- `npm run events:workflow-runs -- --check` 명령을 추가해 run-bound correlation trace를 workflow run record, workflow state transition, workflow event binding으로 projection함
- Event Correlation Ledger, Event/Audit/Run contract freeze, Capability/Workflow contract freeze, Append-only Event Store를 source contract로 묶고 source status를 validation gate로 검증함
- workflow state transition은 stored event의 event type으로만 생성하고, transition이 없는 event도 `event_only` binding으로 workflow run에 보존함
- run ledger가 있는 trace는 전부 `event_backed` workflow run record로 남기고, capability workflow contract가 아직 없는 vertical slice run은 `missing_workflow_contract`로 명시함
- terminal workflow state가 RunLedger status와 일치하지 않으면 validation failure로 처리함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 Workflow Run Ledger를 통합함
- `/api/workflow-run-ledgers`, `/api/workflow-run-records`, `/api/workflow-state-transitions`, `/api/workflow-event-bindings`, `/api/workflow-run-ledger-validations` route를 추가함

완료 기준:

- Workflow Run Ledger가 validation error 없이 `complete` 상태가 됨
- Event Correlation Ledger의 모든 run-bound trace가 event-backed workflow run record로 projection됨
- 모든 run-bound stored event가 workflow event binding으로 연결됨
- 모든 workflow state transition이 append-only stored event와 linked workflow event binding을 가짐
- terminal transition 수가 workflow run record 수와 일치하고 terminal state가 RunLedger status와 정렬됨
- Review Dashboard summary와 stage status에서 workflow run record, transition, event binding, terminal alignment, validation count가 노출됨
- Review API smoke가 workflow run ledger, run record, state transition, event binding, validation route를 모두 조회함
- Golden fixture 수가 65개로 증가하고 workflow run ledger가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run events:workflow-runs -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 164: Agent Run Ledger

목표: Runtime/AgentRun contract freeze의 AgentRun을 workflow run ledger와 append-only event store에 결합해, runtime input/output/artifact/log 참조를 agent run ledger로 보존한다.

구현 내용:

- `src/agent-run-ledger.mjs`, `scripts/agent-run-ledger.mjs`, `schemas/agent-run-ledger.schema.json`, `docs/agent-run-ledger.md`를 추가함
- `npm run events:agent-runs -- --check` 명령을 추가해 AgentRun record, IO reference, artifact reference, log reference, event binding을 projection함
- Runtime/AgentRun contract freeze, Workflow Run Ledger, Append-only Event Store, Event Correlation Ledger를 source contract로 묶고 source status를 validation gate로 검증함
- AgentRun별 `input_ref`, `output_ref`, `output_hash`, `logs_ref`, runtime output/log/verification id, artifact id, workflow/run ledger binding status를 보존함
- stored event가 `agent_run_id`를 직접 들고 있지 않은 경우에도 workflow-level `agent_run.started` / `agent_run.completed` event를 runtime contract의 deterministic AgentRun 순서로 pairing해 event binding으로 남김
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 Agent Run Ledger를 통합함
- `/api/agent-run-ledgers`, `/api/agent-run-records`, `/api/agent-run-io-references`, `/api/agent-run-artifact-references`, `/api/agent-run-log-references`, `/api/agent-run-event-bindings`, `/api/agent-run-ledger-validations` route를 추가함

완료 기준:

- Agent Run Ledger가 validation error 없이 `complete` 상태가 됨
- 모든 runtime AgentRun이 agent run record로 projection되고 workflow run ledger record에 연결됨
- 모든 AgentRun이 complete IO reference와 captured log reference를 가짐
- 모든 runtime artifact contract row가 artifact reference로 projection되고 required artifact gap이 없음
- workflow-level agent state event가 AgentRun event binding으로 연결됨
- Review Dashboard summary와 stage status에서 AgentRun record, IO/log/artifact/event reference, validation count가 노출됨
- Review API smoke가 agent run ledger, record, IO, artifact, log, event binding, validation route를 모두 조회함
- Golden fixture 수가 66개로 증가하고 agent run ledger가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run events:agent-runs -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 165: Tool Invocation Ledger

목표: Agent Run Ledger와 Tool/Runtime Policy Enforcement를 결합해, 각 runtime 내부 tool 사용 가능성, permission decision, protected action blocker, AgentRun event context를 tool invocation ledger로 추적한다.

구현 내용:

- `npm run events:tool-invocations -- --check` 명령을 추가해 AgentRun별 runtime tool policy를 `tool_invocation_record`, `tool_invocation_permission_decision`, `tool_invocation_agent_binding`, `tool_invocation_event_binding`으로 projection함
- Agent Run Ledger, Tool/Runtime Policy Enforcement, Append-only Event Store, Event Correlation Ledger, Runtime/AgentRun Contract Freeze를 source contract로 묶고 source status를 validation gate로 검증함
- 각 invocation row가 `agent_run_id`, `workflow_run_id`, `runtime_id`, `tool_id`, `tool_permission_gate_id`, `agent_run_tool_gate_id`, `permission_decision`, `permission_status`, `invocation_state`, `execution_allowed`를 보존함
- forbidden runtime tool은 숨기지 않고 `blocked` invocation으로 남겨 protected action audit가 가능하게 함
- 현재 event model에는 direct `tool_invocation.*` event가 없으므로 각 invocation을 AgentRun completed/started event context에 `context_bound`로 연결함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 Tool Invocation Ledger를 통합함
- `/api/tool-invocation-ledgers`, `/api/tool-invocation-records`, `/api/tool-invocation-permission-decisions`, `/api/tool-invocation-agent-bindings`, `/api/tool-invocation-event-bindings`, `/api/tool-invocation-ledger-validations` route를 추가함

완료 기준:

- Tool Invocation Ledger가 validation error 없이 `complete` 상태가 됨
- 모든 AgentRun이 runtime별 tool permission gate와 결합되어 tool invocation record를 생성함
- 모든 tool invocation이 permission decision, AgentRun tool gate, AgentRun event context에 연결됨
- forbidden tool invocation은 모두 blocked 상태이며 protected action audit에 남음
- Review Dashboard summary와 stage status에서 invocation, permission decision, agent binding, event binding, blocked/protected count가 노출됨
- Review API smoke가 tool invocation ledger, record, permission decision, agent binding, event binding, validation route를 모두 조회함
- Golden fixture 수가 67개로 증가하고 tool invocation ledger가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run events:tool-invocations -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 166: Audit Event Ledger

목표: Event/Audit/Run 계약의 `AuditEvent v2`와 Identity/Policy 계층의 Access Audit Projection을 별도 audit plane ledger로 정규화해, 보안/접근/승인 감사 기록이 observability log와 섞이지 않도록 한다.

구현 내용:

- `npm run events:audit-ledger -- --check` 명령을 추가해 `AuditEvent v2`와 access audit record를 `audit_trail_record`, `audit_separation_binding`, `audit_source_rollup`으로 projection함
- Event/Audit/Run Contract Freeze, Access Audit Projection, Append-only Event Store, Error/Cost/Observability Contract Freeze, Control Plane Audit Trail을 source contract로 묶고 source status를 validation gate로 검증함
- `AuditEvent v2` row는 append-only event store binding을 유지하고, access audit row는 direct `access.audit.*` event 도입 전까지 `source_projection_only`로 분리함
- 각 audit row가 `source_kind`, `source_record_id`, `audit_domain`, `audit_type`, `actor_id`, `subject_id`, `policy_snapshot_id`, `separation_status`를 보존함
- observability event record id와 trace projection id를 audit plane row의 본문 로그로 취급하지 않고, separation binding에서 `excluded_from_observability_log` 상태로 검증함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 Audit Event Ledger를 통합함
- `/api/audit-event-ledgers`, `/api/audit-trail-records`, `/api/audit-separation-bindings`, `/api/audit-source-rollups`, `/api/audit-event-ledger-validations` route를 추가함

완료 기준:

- Audit Event Ledger가 validation error 없이 `complete` 상태가 됨
- audit record 수가 `AuditEvent v2` source row와 Access Audit source row 합계와 일치함
- 모든 audit record가 observability log에서 분리되어 `separate_from_observability` 상태가 됨
- 모든 `AuditEvent v2` row가 append-only stored event에 bind되고, 모든 access audit row가 source projection으로 보존됨
- approval, access, security audit domain이 모두 조회 가능함
- Review Dashboard summary와 stage status에서 audit record, separation binding, source rollup, security/access/approval count가 노출됨
- Review API smoke가 audit event ledger, trail record, separation binding, source rollup, validation route를 모두 조회함
- Golden fixture 수가 68개로 증가하고 audit event ledger가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run events:audit-ledger -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 167: Policy Snapshot Event Binding

목표: event, run, gate 실행 시점에 적용된 policy snapshot이 source row에 존재하고, P123 Policy Snapshot Binding Ledger의 resolved snapshot과 append-only event store에 일관되게 남는지 별도 event-policy binding ledger로 고정한다.

구현 내용:

- `npm run events:policy-snapshots -- --check` 명령을 추가해 EventRecord v2, AuditEvent v2, RunLedger v2, EventRunBinding v2, GateResult v2를 `event_run_gate_policy_binding`으로 projection함
- Policy Snapshot Ledger, Policy Snapshot Binding Ledger, Event/Audit/Run Contract Freeze, Gate/Approval Contract Freeze, Append-only Event Store를 source contract로 묶고 source status를 validation gate로 검증함
- 각 event/run/gate row가 `source_policy_snapshot_id`, `execution_time`, `resolved_policy_snapshot_id`, `binding_source`, `binding_status`, `policy_snapshot_known`을 갖는지 확인함
- append-only stored event가 존재하는 event/gate/event-run row는 stored event의 `policy_snapshot_id`가 원 source event snapshot과 일치하는지 검증함
- unresolved placeholder snapshot은 P123 binding ledger에서 known snapshot으로 fallback-resolved된 경우에만 허용함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 Policy Snapshot Event Binding을 통합함
- `/api/policy-snapshot-event-bindings`, `/api/event-run-gate-policy-bindings`, `/api/event-policy-snapshot-bindings`, `/api/run-policy-snapshot-bindings`, `/api/gate-policy-snapshot-bindings`, `/api/policy-snapshot-event-binding-validations` route를 추가함

완료 기준:

- Policy Snapshot Event Binding이 validation error 없이 `complete` 상태가 됨
- event/run/gate/event-run-binding source row 수와 projection row 수가 일치함
- 모든 source row가 `policy_snapshot_id`와 execution time을 보유함
- 모든 source row가 P123 binding ledger를 통해 known policy snapshot에 bind됨
- append-only stored event가 있는 row는 stored event snapshot이 source event snapshot과 일치함
- gate row의 event id가 있는 경우 event record와 연결됨
- Review Dashboard summary와 stage status에서 event/run/gate binding, source snapshot, resolved snapshot, stored event match count가 노출됨
- Review API smoke가 policy snapshot event binding, event/run/gate row, validation route를 모두 조회함
- Golden fixture 수가 69개로 증가하고 policy snapshot event binding이 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run events:policy-snapshots -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 168: Cost Record Projection

목표: provider, runtime, storage, API 비용 신호를 동일한 run-level cost record 계약으로 projection해 모든 비용성 지표가 workflow run과 run ledger에 귀속되도록 한다.

구현 내용:

- `npm run cost:records -- --check` 명령을 추가해 Observability raw cost records, Token Usage, Cost Attribution, Tool Invocation, Output Artifact Catalog를 `projected_cost_record`로 정규화함
- provider/token, runtime seconds, storage/output artifact, API/tool invocation 비용 신호를 `provider`, `runtime`, `storage`, `api` category로 분리함
- 각 projected cost record가 `workflow_run_id`, `run_ledger_id`, `correlation_id`, `tenant_id`, `matter_id`, `capability_id`, `domain_pack`, `cost_category`, metering quantity/unit, USD projection, `cost_hash`를 갖도록 고정함
- 실제 요율이 없는 runtime/storage/API meter는 `projected_usd=0`인 unpriced operational cost record로 보존해 나중에 pricing table을 붙여도 lineage가 깨지지 않게 함
- run별 `run_cost_rollup`과 category별 `cost_category_rollup`을 생성해 provider/runtime/storage/API 비용 신호가 workflow run 단위로 조회되도록 함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 Cost Record Projection을 통합함
- `/api/cost-record-projections`, `/api/projected-cost-records`, `/api/run-cost-rollups`, `/api/cost-category-rollups`, `/api/cost-record-projection-validations` route를 추가함

완료 기준:

- Cost Record Projection이 validation error 없이 `complete` 상태가 됨
- raw observability cost record 수와 runtime projection 수가 일치함
- token usage record 수와 provider projection 수가 일치함
- provider/runtime/storage/API category가 모두 1개 이상 projection됨
- 모든 workflow run이 run cost rollup을 갖고 missing run attribution이 0임
- projected estimated USD가 Cost Attribution Ledger의 estimated token USD와 일치함
- Review Dashboard summary와 stage status에서 run rollup, category count, token/runtime/API/storage totals가 노출됨
- Review API smoke가 projection, record, run rollup, category rollup, validation route를 모두 조회함
- Golden fixture 수가 70개로 증가하고 cost record projection이 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run cost:records -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 169: Token Usage Projection

목표: token usage ledger의 input/output/cache token을 동일한 projection 계약으로 정규화하고 capability, runtime, capability/runtime 조합별로 집계해 비용 projection과 조회 표면에 연결한다.

구현 내용:

- `npm run token:projection -- --check` 명령을 추가해 Token Usage Ledger와 Cost Record Projection의 provider cost record를 읽고 `projected_token_usage_record`로 정규화함
- source에 cache token이 없더라도 모든 projected record에 `cache_token_count=0`을 명시해 input/output/cache/total token 집계 계약을 고정함
- 각 projected token usage record가 `token_usage_id`, `workflow_run_id`, `agent_run_id`, `runtime_id`, `capability_id`, `domain_pack`, `tenant_id`, `matter_id`, classification, tracking status, provider cost binding, `token_usage_hash`를 갖도록 고정함
- P168 Cost Record Projection의 provider cost record와 `source_record_id -> token_usage_id` 기준으로 binding해 token 집계와 provider 비용 projection이 같은 record lineage를 공유하도록 함
- capability, runtime, capability/runtime, domain pack, matter, tracking status별 token rollup을 생성해 input/output/cache/total token과 provider projected USD를 조회 가능하게 함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 Token Usage Projection을 통합함
- `/api/token-usage-projections`, `/api/projected-token-usage-records`, `/api/capability-token-rollups`, `/api/runtime-token-rollups`, `/api/capability-runtime-token-rollups`, `/api/token-usage-projection-validations` route를 추가함

완료 기준:

- Token Usage Projection이 validation error 없이 `complete` 상태가 됨
- projected token usage record 수가 source token usage record 수와 일치함
- provider cost record 수와 provider-bound projected token usage record 수가 token usage record 수와 일치하고 missing provider binding이 0임
- 모든 projected record가 explicit `cache_token_count`와 `token_usage_hash`를 가짐
- input/output/total token 합계가 Token Usage Ledger summary와 일치하고 cache token은 별도 필드로 보존됨
- capability, runtime, capability/runtime rollup이 모두 생성되고 capability/runtime rollup 합계가 total token과 일치함
- Review Dashboard summary와 stage status에서 projected count, provider binding, capability/runtime rollup, input/output/cache/total token, provider projected USD가 노출됨
- Review API smoke가 projection, projected record, capability rollup, runtime rollup, capability/runtime rollup, validation route를 모두 조회함
- Golden fixture 수가 71개로 증가하고 token usage projection이 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run token:projection -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 170: Observability Trace Projection

목표: P162 correlation trace를 관측성 trace projection으로 승격하고 workflow, agent, gate, output component가 같은 trace id 아래에서 조회되도록 고정합니다.

구현 내용:

- `npm run observability:traces -- --check` 명령을 추가해 Event Correlation Ledger, Workflow Run Ledger, Agent Run Ledger, Gate/Approval Contract Freeze, Output Catalog를 읽고 `observability_trace_record`와 component별 trace binding을 생성함
- 각 trace record가 `observability_trace_id`, `correlation_trace_id`, `trace_status`, `trace_component_status`, workflow/agent/gate/output binding count, hash를 갖도록 고정함
- workflow run, agent run, gate result, output artifact 각각을 `observability_trace_binding`으로 정규화하고 `correlation_trace_id`와 `observability_trace_id`에 binding함
- external-control audit trace는 workflow에 강제 귀속하지 않고 별도 `external_control` trace로 보존함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 Observability Trace Projection을 통합함
- `/api/observability-trace-projections`, `/api/observability-trace-records`, `/api/workflow-trace-bindings`, `/api/agent-trace-bindings`, `/api/gate-trace-bindings`, `/api/output-trace-bindings`, `/api/observability-trace-projection-validations` route를 추가함

완료 기준:

- Observability Trace Projection이 validation error 없이 `complete` 상태가 됨
- projected trace record 수가 Event Correlation Ledger의 correlation trace 수와 일치함
- 모든 workflow run, agent run, gate result, output artifact가 trace binding row를 갖고 unknown binding이 0임
- 모든 linked run trace가 workflow binding을 갖고, external-control trace는 별도 trace status로 보존됨
- 최소 1개 이상의 trace가 workflow, agent, gate, output component를 모두 연결한 `complete` component trace가 됨
- 모든 trace record와 trace binding row가 hash를 가짐
- Review Dashboard summary와 stage status에서 trace count, linked/external-control/complete count, component binding count, unknown binding count가 노출됨
- Review API smoke가 projection, trace record, workflow/agent/gate/output binding, validation route를 모두 조회함
- Golden fixture 수가 72개로 증가하고 observability trace projection이 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run observability:traces -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 171: Error Retry Ledger

목표: ErrorRecord v2와 observability trace projection을 실행 운영용 error/retry ledger로 승격하고 failure, retry, timeout, resume state를 서로 다른 record family로 분리합니다.

구현 내용:

- `npm run observability:errors -- --check` 명령을 추가해 Error/Cost/Observability Contract Freeze, Observability Trace Projection, Workflow Run Ledger, Tool Invocation Ledger를 읽고 `projected_error_record`, `retry_record`, `timeout_record`, `resume_state_record`를 생성함
- ErrorRecord v2의 failure 상태를 `projected_error_record`로 정규화하고 `observability_trace_id`, `correlation_trace_id`, `run_ledger_id`, `policy_snapshot_id`, blocked tool count와 함께 hash를 부여함
- retry state는 `retry_record`로 분리하고, auto retry를 예약하지 않는다는 invariant를 validation gate로 고정함
- timeout state는 `timeout_record`로 분리해 현재 timeout이 없는 상태도 `not_timeout` classification row로 명시함
- resume state는 `resume_state_record`로 분리해 blocking error가 사람 승인 또는 operator resolution 없이 진행되지 않도록 owner, precondition, next action을 기록함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 Error/Retry Ledger를 통합함
- `/api/error-retry-ledgers`, `/api/projected-error-records`, `/api/retry-records`, `/api/timeout-records`, `/api/resume-state-records`, `/api/error-retry-ledger-validations` route를 추가함

완료 기준:

- Error/Retry Ledger가 validation error 없이 `complete` 상태가 됨
- projected error record 수가 source ErrorRecord v2 수와 일치함
- 모든 projected error가 retry, timeout, resume-state record를 각각 1개씩 가짐
- 모든 projected error가 observability trace에 binding되고 missing trace binding이 0임
- auto retry scheduled count가 0으로 유지됨
- retryable/non-retryable error가 source ErrorRecord v2와 일치하고, blocking error는 blocked resume-state row로 분리됨
- 모든 projected error, retry, timeout, resume-state record가 hash를 가짐
- Review Dashboard summary와 stage status에서 error/retry/timeout/resume count, auto retry count, trace binding count가 노출됨
- Review API smoke가 ledger, projected error, retry, timeout, resume-state, validation route를 모두 조회함
- Golden fixture 수가 73개로 증가하고 error retry ledger가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run observability:errors -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 172: Event Replay Harness

목표: append-only event store를 실행 없이 재생해 event stream, workflow run summary, dashboard projection 핵심 지표가 같은 값으로 재구성되는지 검증합니다.

구현 내용:

- `npm run events:replay -- --check` 명령을 추가해 Append-only Event Store, Event Correlation Ledger, Workflow Run Ledger, Review Dashboard를 읽고 deterministic replay artifact를 생성함
- `replayed_event_stream`을 생성해 stream sequence, event count, hash presence, event envelope/stored event id를 재구성하고 source stream과 비교함
- `replayed_run_summary`를 생성해 run ledger별 event count와 terminal state를 Workflow Run Ledger record와 비교함
- `dashboard_replay_projection`을 생성해 append-only event store, event correlation ledger, workflow run ledger의 dashboard-facing metric을 다시 계산하고 source/dashboard 값과 비교함
- global append-only hash chain의 sequence, previous chain hash, event hash, chain hash invariant를 validation gate로 고정함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 Event Replay Harness를 통합함
- `/api/event-replay-harnesses`, `/api/replayed-event-streams`, `/api/replayed-run-summaries`, `/api/dashboard-replay-projections`, `/api/dashboard-replay-metrics`, `/api/event-replay-validations` route를 추가함

완료 기준:

- Event Replay Harness가 validation error 없이 `complete` 상태가 됨
- replayed event count가 append-only stored event count와 일치함
- replayed event stream count와 source event stream count가 일치하고 모든 stream sequence gap이 0임
- global hash-chain mismatch count가 0임
- replayed run summary count가 Workflow Run Ledger record count와 일치함
- 모든 replayed run summary의 event count와 terminal state가 source Workflow Run Ledger와 일치함
- dashboard replay projection metric이 10개 이상이며 source/dashboard mismatch가 0임
- 모든 replayed stream, replayed run summary, dashboard replay projection이 hash를 가짐
- Review Dashboard summary와 stage status에서 replayed event, stream, run summary, dashboard metric drift, validation count가 노출됨
- Review API smoke가 harness, stream, run summary, dashboard projection, metric, validation route를 모두 조회함
- Golden fixture 수가 74개로 증가하고 event replay harness가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run events:replay -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 173: Retention/Archive Ledger

목표: audit/event/output plane의 보존 정책, archive candidate, legal hold binding을 deterministic ledger로 고정하고 삭제는 명시적 records review 전까지 허용하지 않습니다.

구현 내용:

- `npm run events:retention -- --check` 명령을 추가해 Append-only Event Store, Audit Event Ledger, Output Artifact Catalog를 읽고 Retention/Archive Ledger를 생성함
- event plane은 append-only event stream 단위 candidate로 보존하며 stream count, event count, chain hash를 archive candidate에 연결함
- audit plane은 separated audit source rollup 단위 candidate로 보존하며 audit trail record hash와 source rollup을 연결함
- output plane은 output artifact 단위 candidate로 보존하며 approval/delivery 상태와 artifact content hash를 함께 기록함
- `retention_policy_record`, `archive_candidate_record`, `legal_hold_binding`을 schema와 hash로 고정하고 모든 candidate가 known retention policy와 active legal hold binding에 연결되도록 검증함
- deletion allowed candidate count를 0으로 고정하고, 추후 삭제/폐기 정책은 별도 records review 및 audit이 필요한 작업으로 남김
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 Retention/Archive Ledger를 통합함
- `/api/retention-archive-ledgers`, `/api/retention-policy-records`, `/api/archive-candidate-records`, `/api/legal-hold-bindings`, `/api/retention-archive-validations` route를 추가함

완료 기준:

- Retention/Archive Ledger가 validation error 없이 `complete` 상태가 됨
- event/audit/output retention policy가 각각 1개 이상 존재하고 source count가 append-only stored event, audit trail record, output artifact count와 일치함
- event stream, audit rollup, output artifact archive candidate가 모두 생성됨
- 모든 archive candidate가 known retention policy에 binding됨
- deletion allowed candidate count가 0이고 모든 deletion status가 `not_allowed`임
- legal hold required candidate마다 active legal hold binding이 존재함
- 모든 retention policy, archive candidate, legal hold binding이 sha256 hash를 가짐
- Review Dashboard summary와 stage status에서 retention policy, archive candidate, legal hold, deletion blocker, validation count가 노출됨
- Review API smoke가 ledger, policy, candidate, legal hold, validation route를 모두 조회함
- Golden fixture 수가 75개로 증가하고 retention archive ledger가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run events:retention -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 174: Ledger API/Dashboard

목표: run, audit, cost, error, event ledger를 하나의 읽기 전용 API/dashboard index로 묶어 운영자가 ledger plane 상태와 Review API route를 빠르게 확인할 수 있게 합니다.

구현 내용:

- `npm run ledgers:api-dashboard -- --check` 명령을 추가해 Workflow Run Ledger, Audit Event Ledger, Cost Record Projection, Token Usage Projection, Error/Retry Ledger, Append-only Event Store, Event Replay Harness를 읽고 Ledger API/Dashboard artifact를 생성함
- run/audit/cost/error/event domain별 dashboard panel을 만들고 source ledger, 주요 count, blocker, validation error, human review note를 함께 기록함
- 각 panel이 사용하는 Review API `GET` route를 `ledger_api_route_record`로 고정하고 route 선언 여부와 safe query example을 검증함
- panel metric row와 cross-ledger health link row를 생성해 run-event, run-cost, run-error, event-audit, event-replay 연결 상태를 확인함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 Ledger API/Dashboard를 통합함
- `/api/ledger-api-dashboards`, `/api/ledger-dashboard-panels`, `/api/ledger-api-route-records`, `/api/ledger-panel-metrics`, `/api/ledger-cross-links`, `/api/ledger-api-dashboard-validations` route를 추가함

완료 기준:

- Ledger API/Dashboard가 validation error 없이 `complete` 상태가 됨
- run, audit, cost, error, event 5개 domain panel이 모두 `passed` 상태임
- 모든 panel route가 Review API에 선언되어 있고 누락 route count가 0임
- panel metric이 20개 이상이고 cross-ledger link가 5개 이상임
- 모든 cross-ledger link가 `linked` 상태이며 attention link count가 0임
- Review Dashboard summary와 stage status에서 panel, route, metric, cross-link, validation count가 노출됨
- Review API smoke가 ledger dashboard, panel, route, metric, cross-link, validation route를 모두 조회함
- Golden fixture 수가 76개로 증가하고 ledger api dashboard가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run ledgers:api-dashboard -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 175: Ledger Golden Fixtures

목표: Event/Run/Audit/Observability track의 replay, projection, cost, audit 대표 case를 잠긴 golden fixture suite로 묶어 ledger plane 회귀 기준선을 고정합니다.

구현 내용:

- `npm run ledgers:golden-fixtures -- --check` 명령을 추가해 Event Replay Harness, Cost Record Projection, Token Usage Projection, Audit Event Ledger, Ledger API/Dashboard를 읽고 Ledger Golden Fixtures artifact를 생성함
- replay, projection, cost, audit 4개 group의 대표 fixture case를 만들고 각 case에 source artifact, expected/observed metric assertion, human review note, protected action guard를 기록함
- case별 deterministic regression hash와 fixture matrix를 생성해 source status, assertion status, lock status를 함께 검증함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 Ledger Golden Fixtures를 통합함
- `/api/ledger-golden-fixtures`, `/api/ledger-golden-cases`, `/api/ledger-fixture-matrix`, `/api/ledger-regression-hashes`, `/api/ledger-golden-validations` route를 추가함

완료 기준:

- Ledger Golden Fixtures가 validation error 없이 `complete` 상태가 됨
- replay, projection, cost, audit fixture group이 각각 1개 이상 존재하고 총 4개 group이 모두 검증됨
- 모든 ledger golden case가 `locked` 상태이고 mismatch case count가 0임
- metric assertion이 16개 이상이고 모든 assertion이 `passed` 상태임
- case별 regression hash가 모두 `locked` 상태이고 protected action case count가 0임
- 모든 case가 human review required note를 포함해 법무 운영 산출물의 사람 검토 경계를 보존함
- Review Dashboard summary와 stage status에서 case, group, assertion, regression hash, validation count가 노출됨
- Review API smoke가 fixture artifact, case, matrix, hash, validation route를 모두 조회함
- Golden fixture 수가 77개로 증가하고 ledger golden fixtures가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run ledgers:golden-fixtures -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 176: Observability Freeze

목표: Event/Run/Audit/Observability track을 freeze report로 닫고 trace, cost, audit, run ledger가 control-plane loop에 통합되어 있는지 deterministic gate로 검증합니다.

구현 내용:

- `npm run observability:freeze -- --check` 명령을 추가해 P159-P175 event/run/audit/cost/trace/replay/retention/API/golden fixture artifacts와 control-plane loop source/artifact를 읽고 Observability Freeze artifact를 생성함
- source status, checkpoint, representative trace, control-plane loop binding, validation report를 별도 JSON으로 기록함
- workflow/agent/tool run, audit separation, cost/token, trace projection, error/retry, replay/retention, ledger API/golden fixture 대표 trace에 metric assertion과 human review guardrail을 함께 기록함
- Review Dashboard, Review API, API smoke, Control Plane Loop, Goal Checkpoint, Contract Golden Fixtures, Contract Validation Suite, test suite에 Observability Freeze를 통합함
- `/api/observability-freezes`, `/api/observability-freeze-sources`, `/api/observability-freeze-checkpoints`, `/api/observability-freeze-traces`, `/api/observability-freeze-loop-bindings`, `/api/observability-freeze-validations` route를 추가함

완료 기준:

- Observability Freeze가 validation error 없이 `complete` 상태가 됨
- P159-P175 source artifact 18개가 모두 readable, complete/passed, validation-clean 상태임
- P159-P175 control-plane loop step 17개가 default loop source에 선언되어 있고 현재 loop artifact가 `passed` 상태임
- 대표 trace 7개가 모두 `complete`이고 metric assertion 30개 이상이 모두 `passed` 상태임
- cost/token, audit, run, trace, replay, retention, ledger API/golden fixture count가 dashboard summary와 stage status에 노출됨
- 모든 대표 trace가 human review required이며 client-facing ready, external transfer, protected action 실행은 0으로 고정됨
- Review API smoke가 freeze artifact, source, checkpoint, trace, loop binding, validation route를 모두 조회함
- Golden fixture 수가 78개로 증가하고 observability freeze가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run observability:freeze -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 177 - Capability Manifest v2 Catalog

Phase 177은 Phase 103의 Capability/Workflow Contract Freeze에서 생성한 `capability-manifest.v2` record를 후속 workflow runner, context builder, gate engine이 직접 소비할 수 있는 운영 catalog로 승격했다. 목적은 capability별 input/output, required fields, gate/runtime, policy, version 선언을 한곳에서 검증하고, 법률/클라이언트-facing 출력은 여전히 human/attorney review 아래에 두는 것이다.

구현 내용:

- `src/capability-manifest-v2.mjs`와 `scripts/capability-manifest-v2.mjs`를 추가해 `artifacts/capability-manifest-v2/latest/capability-manifest-v2.json` 산출물을 생성함
- `capability-manifests.json`, `capability-field-matrix.json`, `capability-gate-runtime-matrix.json`, `capability-policy-index.json`, `capability-version-policy-index.json`, `validation-report.json`, `summary.md`를 함께 출력함
- `schemas/capability-manifest-v2-catalog.schema.json`으로 catalog, field matrix, gate/runtime matrix, policy/version index의 최소 계약을 고정함
- Review Dashboard에 `capability_manifest_v2` source/stage/summary metric을 추가하고 input/output, missing field, gate/runtime, policy, version, guardrail count를 노출함
- Review API에 `/api/capability-manifest-v2-catalogs`, `/api/capability-manifest-v2-records`, `/api/capability-manifest-field-matrix`, `/api/capability-manifest-gate-runtime-matrix`, `/api/capability-manifest-policy-index`, `/api/capability-manifest-version-policy-index`, `/api/capability-manifest-v2-validations` route를 추가함
- Control Plane Loop에 `capability_manifest_v2` step을 추가하고 Goal Checkpoint에 `capability_manifest_v2_gate` acceptance profile을 추가함
- Contract Golden Fixtures와 Contract Validation Suite에 capability manifest v2 catalog를 포함함

완료 기준:

- Capability Manifest v2 catalog가 validation error 없이 `complete` 상태가 됨
- 등록된 capability 4개가 모두 registry link, input/output contract, required field, gate/runtime, policy, version 검증을 통과함
- unknown runtime, blocked runtime binding, missing required field, client-facing ready output, protected action execution이 모두 0임
- Review API smoke가 catalog, manifest record, field matrix, gate/runtime matrix, policy index, version index, validation route를 모두 조회함
- Golden fixture 수가 79개로 증가하고 capability manifest v2 catalog가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run capabilities:manifest-v2 -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 178 - Pack Manifest Compatibility

Phase 178은 `domain-pack-manifest.v1` pack들이 Hermes core version floor와 pack dependency를 명시적으로 선언하고, 후속 workflow/gate engine이 pack 조합을 안전하게 소비할 수 있도록 compatibility checker를 독립 산출물로 승격했다. 목적은 `common`, `law-firm`, `personal-dev`, `creative-document` pack이 현재 core version과 dependency graph에 맞는지 검증하고, law-firm pack은 client/legal-facing output을 계속 human review 기본값 아래에 두는 것이다.

구현 내용:

- `src/pack-manifest-compatibility.mjs`와 `scripts/pack-manifest-compatibility.mjs`를 추가해 `artifacts/pack-manifest-compatibility/latest/pack-manifest-compatibility.json` 산출물을 생성함
- `pack-compatibility-records.json`, `pack-dependency-edges.json`, `pack-compatibility-matrix.json`, `validation-report.json`, `summary.md`를 함께 출력함
- `schemas/pack-manifest-compatibility.schema.json`으로 pack별 core compatibility, dependency edge, compatibility matrix의 최소 계약을 고정함
- Review Dashboard에 `pack_manifest_compatibility` source/stage/summary metric을 추가하고 core version, compatible pack, dependency edge, missing/mismatch blocker count를 노출함
- Review API에 `/api/pack-manifest-compatibility`, `/api/pack-compatibility-records`, `/api/pack-dependency-edges`, `/api/pack-compatibility-matrix`, `/api/pack-manifest-compatibility-validations` route를 추가함
- Control Plane Loop에 `pack_manifest_compatibility` step을 추가하고 Goal Checkpoint에 `pack_manifest_compatibility_gate` acceptance profile을 추가함
- Contract Golden Fixtures와 Contract Validation Suite에 pack manifest compatibility artifact와 `packs:compatibility` script를 포함함

완료 기준:

- Pack manifest compatibility가 validation error 없이 `complete` 상태가 됨
- 등록된 pack 4개가 모두 `core_compatibility.min_core_version`을 선언하고 현재 core `0.1.0`과 compatible 상태가 됨
- non-common pack 3개가 `common@0.1.0` dependency edge를 선언하고 모든 dependency edge가 `satisfied` 상태가 됨
- missing dependency, dependency version mismatch, common dependency gap이 모두 0임
- law-firm pack의 기본 output status가 `pending_review`로 유지됨
- Review API smoke가 compatibility artifact, pack record, dependency edge, matrix, validation route를 모두 조회함
- Golden fixture 수가 80개로 증가하고 pack manifest compatibility artifact가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run packs:compatibility -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 179 - Workflow DSL State Model

Phase 179는 workflow contract와 event-backed workflow run ledger 사이에 공통 DSL state model을 추가했다. 목적은 후속 runner/gate/context engine이 workflow 상태를 `started`, `waiting`, `gated`, `approved`, `failed`, `completed` 여섯 상태로 안정적으로 해석하고, law-firm/client-facing output이 승인 전에는 항상 human-review waiting 상태로 남는다는 운영 규칙을 projection으로 검증하는 것이다.

구현 내용:

- `src/workflow-dsl-state-model.mjs`와 `scripts/workflow-dsl-state-model.mjs`를 추가해 `artifacts/workflow-dsl-state-model/latest/workflow-dsl-state-model.json` 산출물을 생성함
- `workflow-dsl-states.json`, `workflow-dsl-transition-rules.json`, `workflow-state-blueprints.json`, `workflow-run-state-projections.json`, `validation-report.json`, `summary.md`를 함께 출력함
- `schemas/workflow-dsl-state-model.schema.json`으로 6-state DSL, transition rule, workflow blueprint, run projection의 최소 계약을 고정함
- Review Dashboard에 `workflow_dsl_state_model` source/stage/summary metric을 추가하고 state count, transition rule, blueprint/run projection, waiting/human-review count를 노출함
- Review API에 `/api/workflow-dsl-state-models`, `/api/workflow-dsl-states`, `/api/workflow-dsl-transition-rules`, `/api/workflow-state-blueprints`, `/api/workflow-run-state-projections`, `/api/workflow-dsl-state-validations` route를 추가함
- Control Plane Loop에 `workflow_dsl_state_model` step을 추가하고 Goal Checkpoint에 `workflow_dsl_state_model_gate` acceptance profile을 추가함
- Contract Golden Fixtures와 Contract Validation Suite에 workflow DSL state model artifact와 `workflows:state-model` script를 포함함

완료 기준:

- Workflow DSL state model이 validation error 없이 `complete` 상태가 됨
- `started`, `waiting`, `gated`, `approved`, `failed`, `completed` 6개 상태가 고정되고 core transition rule이 선언됨
- Capability/Workflow Contract Freeze의 workflow 3개가 모두 workflow state blueprint로 projection됨
- Workflow Run Ledger의 run record 4개가 모두 known DSL state로 projection되고 unknown source state가 0임
- blocked workflow run은 `waiting` 상태로 projection되고 law-firm workflow run은 human review waiting count에 포함됨
- Review API smoke가 state model, state definitions, transition rules, blueprints, run projections, validation route를 모두 조회함
- Golden fixture 수가 81개로 증가하고 workflow DSL state model artifact가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run workflows:state-model -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 180 - Workflow State Machine Runner

Phase 180은 Phase 179의 DSL state projection 위에 deterministic workflow state machine runner를 추가했다. 목적은 각 workflow run projection마다 transition guard를 만들고, guard 판단마다 audit event candidate와 runner plan을 함께 생성하되, law-firm human-review 상태에서는 protected action과 자동 transition을 실행하지 않는 것이다.

구현 내용:

- `src/workflow-state-machine-runner.mjs`와 `scripts/workflow-state-machine-runner.mjs`를 추가해 `artifacts/workflow-state-machine-runner/latest/workflow-state-machine-runner.json` 산출물을 생성함
- `transition-guards.json`, `runner-audit-events.json`, `workflow-runner-plans.json`, `validation-report.json`, `summary.md`를 함께 출력함
- `schemas/workflow-state-machine-runner.schema.json`으로 runner contract, transition guard, audit event candidate, runner plan의 최소 계약을 고정함
- Review Dashboard에 `workflow_state_machine_runner` source/stage/summary metric을 추가하고 guard/audit/plan count, human-review hold, protected-action 실행 0건을 노출함
- Review API에 `/api/workflow-state-machine-runners`, `/api/workflow-transition-guards`, `/api/workflow-runner-audit-events`, `/api/workflow-runner-plans`, `/api/workflow-runner-validations` route를 추가함
- Control Plane Loop에 `workflow_state_machine_runner` step을 추가하고 Goal Checkpoint에 `workflow_state_machine_runner_gate` acceptance profile을 추가함
- Contract Golden Fixtures와 Contract Validation Suite에 workflow state machine runner artifact와 `workflows:runner` script를 포함함

완료 기준:

- Workflow state machine runner가 validation error 없이 `complete` 상태가 됨
- Workflow DSL state model의 run projection마다 transition guard가 정확히 1개 생성됨
- 모든 transition guard가 audit event candidate와 runner plan에 binding됨
- 현재 blocked/waiting law-firm workflow run은 `waiting -> approved` 후보로만 표현되고 human review 전에는 hold 상태로 남음
- protected action executed count와 auto transition count가 0으로 유지됨
- Review API smoke가 runner artifact, transition guard, audit event candidate, runner plan, validation route를 모두 조회함
- Golden fixture 수가 82개로 증가하고 workflow state machine runner artifact가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run workflows:runner -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 181 - Workflow Queue Retry Backoff Contract

Phase 181은 Phase 180의 workflow runner plan과 Phase 171의 Error/Retry Ledger를 결합해 workflow queue, retry classification, backoff policy를 분리된 계약으로 고정했다. 목적은 retry 가능한 오류와 retry 불가 오류를 명확히 나누고, retryable 오류에만 backoff policy row를 만들되 자동 retry scheduling이나 auto dequeue는 실행하지 않는 것이다.

구현 내용:

- `src/workflow-queue-retry-backoff-contract.mjs`와 `scripts/workflow-queue-retry-backoff-contract.mjs`를 추가해 `artifacts/workflow-queue-retry-backoff/latest/workflow-queue-retry-backoff-contract.json` 산출물을 생성함
- `workflow-queue-records.json`, `retry-classification-records.json`, `backoff-policy-records.json`, `validation-report.json`, `summary.md`를 함께 출력함
- `schemas/workflow-queue-retry-backoff-contract.schema.json`으로 queue record, retry classification, backoff policy의 최소 계약을 고정함
- Review Dashboard에 `workflow_queue_retry_backoff_contract` source/stage/summary metric을 추가하고 held queue, retryable/non-retryable split, unscheduled backoff, auto 실행 0건을 노출함
- Review API에 `/api/workflow-queue-retry-backoff-contracts`, `/api/workflow-queue-records`, `/api/workflow-retry-classifications`, `/api/workflow-backoff-policies`, `/api/workflow-queue-validations` route를 추가함
- Control Plane Loop에 `workflow_queue_retry_backoff_contract` step을 추가하고 Goal Checkpoint에 `workflow_queue_retry_backoff_gate` acceptance profile을 추가함
- Contract Golden Fixtures와 Contract Validation Suite에 workflow queue/retry/backoff artifact와 `workflows:queue-retry` script를 포함함

완료 기준:

- Workflow queue/retry/backoff contract가 validation error 없이 `complete` 상태가 됨
- Workflow state machine runner plan마다 queue record가 정확히 1개 생성됨
- Error/Retry Ledger의 retry record마다 retry classification row가 정확히 1개 생성됨
- retryable classification에만 backoff policy가 생성되고 non-retryable classification의 backoff policy count는 0으로 유지됨
- 모든 backoff policy는 `not_scheduled` 상태이고 human gate 전에는 retry schedule이 생성되지 않음
- law-firm human-review workflow queue record는 held 상태로 남고 auto dequeue, auto retry, protected action execution count가 모두 0임
- Review API smoke가 queue contract, queue record, retry classification, backoff policy, validation route를 모두 조회함
- Golden fixture 수가 83개로 증가하고 workflow queue/retry/backoff artifact가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run workflows:queue-retry -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 182 - Workflow Idempotency Key Manager

Phase 182는 Phase 181의 held workflow queue record마다 deterministic idempotency key를 부여하고, 동일 요청이 다시 들어올 때 새 run을 만들지 않고 기존 run으로 해소하거나 skipped duplicate로 기록하는 idempotency ledger를 추가했다. 목적은 retry/resume 계층으로 넘어가기 전에 workflow 실행 중복을 same-run 또는 skip 결정으로 고정하고, law-firm human-review queue가 자동 enqueue/protected action으로 새지 않게 하는 것이다.

구현 내용:

- `src/workflow-idempotency-ledger.mjs`와 `scripts/workflow-idempotency-ledger.mjs`를 추가해 `artifacts/workflow-idempotency/latest/workflow-idempotency-ledger.json` 산출물을 생성함
- `idempotency-key-records.json`, `idempotency-decision-records.json`, `duplicate-probe-records.json`, `validation-report.json`, `summary.md`를 함께 출력함
- `schemas/workflow-idempotency-ledger.schema.json`으로 idempotency contract, key record, decision record, duplicate probe record의 최소 계약을 고정함
- Review Dashboard에 `workflow_idempotency_ledger` source/stage/summary metric을 추가하고 key/decision/probe count, collision count, duplicate skip, 새 run 생성 0건을 노출함
- Review API에 `/api/workflow-idempotency-ledgers`, `/api/workflow-idempotency-keys`, `/api/workflow-idempotency-decisions`, `/api/workflow-duplicate-probes`, `/api/workflow-idempotency-validations` route를 추가함
- Control Plane Loop에 `workflow_idempotency_ledger` step을 추가하고 Goal Checkpoint에 `workflow_idempotency_gate` acceptance profile을 추가함
- Contract Golden Fixtures와 Contract Validation Suite에 workflow idempotency ledger artifact와 `workflows:idempotency` script를 포함함

완료 기준:

- Workflow idempotency ledger가 validation error 없이 `complete` 상태가 됨
- Workflow queue record마다 idempotency key가 정확히 1개 생성되고 unique key count가 key count와 일치함
- key count가 Phase 181 queue record count, Phase 180 runner plan count, Workflow Run Ledger run record count와 모두 일치함
- primary request는 기존 run으로 same-run 해소되고 duplicate probe는 skipped duplicate로 기록되며 새 workflow run 생성 count가 0으로 유지됨
- law-firm queue key는 held 상태를 보존하고 law-firm duplicate probe는 모두 skipped duplicate로 처리됨
- auto enqueue, protected action execution, cross-workflow key collision count가 모두 0임
- Review API smoke가 idempotency ledger, key, decision, duplicate probe, validation route를 모두 조회함
- Golden fixture 수가 84개로 증가하고 workflow idempotency ledger artifact가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run workflows:idempotency -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 183 - Workflow Resume/Cancel Semantics

Phase 183은 Phase 182의 deterministic idempotency key 위에 장기 작업을 안전하게 중단/재개하기 위한 resume/cancel control contract를 추가했다. 목적은 held workflow queue가 중복 run이나 자동 실행으로 새지 않도록 유지하면서, 재개는 deterministic cursor와 human/operator gate 뒤에 두고 취소는 append-only safe request로만 기록하는 것이다.

구현 내용:

- `src/workflow-resume-cancel-contract.mjs`와 `scripts/workflow-resume-cancel-contract.mjs`를 추가해 `artifacts/workflow-resume-cancel/latest/workflow-resume-cancel-contract.json` 산출물을 생성함
- `resume-cursor-records.json`, `cancel-request-records.json`, `resume-cancel-decision-records.json`, `validation-report.json`, `summary.md`를 함께 출력함
- `schemas/workflow-resume-cancel-contract.schema.json`으로 resume cursor, cancel request, resume/cancel decision record의 최소 계약을 고정함
- Review Dashboard에 `workflow_resume_cancel_contract` source/stage/summary metric을 추가하고 resume cursor, cancel request, held resume, safe cancel, 자동 resume/cancel 0건을 노출함
- Review API에 `/api/workflow-resume-cancel-contracts`, `/api/workflow-resume-cursors`, `/api/workflow-cancel-requests`, `/api/workflow-resume-cancel-decisions`, `/api/workflow-resume-cancel-validations` route를 추가함
- Control Plane Loop에 `workflow_resume_cancel_contract` step을 추가하고 Goal Checkpoint에 `workflow_resume_cancel_gate` acceptance profile을 추가함
- Contract Golden Fixtures와 Contract Validation Suite에 workflow resume/cancel contract artifact와 `workflows:resume-cancel` script를 포함함

완료 기준:

- Workflow resume/cancel contract가 validation error 없이 `complete` 상태가 됨
- Phase 182 idempotency key마다 resume cursor와 safe cancel request가 각각 1개씩 생성됨
- resume cursor count가 idempotency key count, Phase 181 queue record count, Phase 180 runner plan count, Workflow Run Ledger run record count와 모두 일치함
- 모든 resume은 canonical workflow run을 재사용하고 새 run 생성 없이 held workflow를 human/operator gate 뒤에 둠
- 모든 cancel은 destructive mutation 없이 append-only cancel request로 기록되고 cancel event append requirement를 보존함
- law-firm resume cursor는 attorney/designated reviewer gate 뒤에 held로 남고 law-firm cancel request도 safe request 상태로만 노출됨
- auto resume, auto cancel, destructive cancel mutation, protected action execution, new run creation count가 모두 0임
- Review API smoke가 resume/cancel contract, resume cursor, cancel request, decision, validation route를 모두 조회함
- Golden fixture 수가 85개로 증가하고 workflow resume/cancel contract artifact가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run workflows:resume-cancel -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 184 - Workflow Context Builder Contract

Phase 184는 Phase 183의 held resume cursor를 사람이 검토할 수 있는 Context Packet v2로 승격하는 deterministic context builder contract를 추가했다. 목적은 workflow 재개 전 필요한 context를 접근 가능 resource, 제외된 cross-matter resource, token budget, citation hint로 분리하고, 실제 retrieval 실행이나 외부 전송 없이 review-only 상태로 보존하는 것이다.

구현 내용:

- `src/workflow-context-builder-contract.mjs`와 `scripts/workflow-context-builder-contract.mjs`를 추가해 `artifacts/workflow-context-builder/latest/workflow-context-builder-contract.json` 산출물을 생성함
- `context-packet-v2-records.json`, `context-resource-selection-records.json`, `context-token-budget-records.json`, `context-citation-hint-records.json`, `validation-report.json`, `summary.md`를 함께 출력함
- `schemas/workflow-context-builder-contract.schema.json`으로 Context Packet v2, resource selection, token budget, citation hint의 최소 계약을 고정함
- Review Dashboard에 `workflow_context_builder_contract` source/stage/summary metric을 추가하고 accessible/excluded resource, token budget, citation hint, prompt-injection handling, human review count를 노출함
- Review API에 `/api/workflow-context-builder-contracts`, `/api/context-packet-v2-records`, `/api/context-resource-selections`, `/api/context-token-budgets`, `/api/context-citation-hints`, `/api/workflow-context-builder-validations` route를 추가함
- Control Plane Loop에 `workflow_context_builder_contract` step을 추가하고 Goal Checkpoint에 `workflow_context_builder_gate` acceptance profile을 추가함
- Contract Golden Fixtures와 Contract Validation Suite에 workflow context builder contract artifact와 `workflows:context-builder` script를 포함함

완료 기준:

- Workflow context builder contract가 validation error 없이 `complete` 상태가 됨
- Phase 183 resume cursor마다 Context Packet v2 record가 정확히 1개 생성됨
- 각 Context Packet v2 record가 source context packet/item, accessible resource, excluded resource, token budget, citation hint를 모두 참조함
- 모든 token budget이 enforced + within budget 상태이며 overflow policy를 보존함
- citation hint가 각 packet마다 준비되고 source span 또는 resource id 요구를 명시함
- law-firm context packet은 human review required 상태로 유지됨
- retrieval execution, client-facing output, external transfer, protected action execution count가 모두 0임
- Review API smoke가 context builder contract, packet v2, resource selection, token budget, citation hint, validation route를 모두 조회함
- Golden fixture 수가 86개로 증가하고 workflow context builder contract artifact가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run workflows:context-builder -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 185 - Workflow Retrieval Compiler

Phase 185는 Phase 184의 Context Packet v2를 실제 query adapter 실행 전 단계의 held retrieval request와 ranked candidate로 컴파일하는 deterministic retrieval compiler를 추가했다. 목적은 matter wall, classification floor, relevance ranking, source span 우선순위를 한 번 더 명시적으로 적용하고, query execution/external transfer/protected action은 계속 0으로 고정한 채 사람이 검토 가능한 retrieval plan만 만드는 것이다.

구현 내용:

- `src/workflow-retrieval-compiler.mjs`와 `scripts/workflow-retrieval-compiler.mjs`를 추가해 `artifacts/workflow-retrieval-compiler/latest/workflow-retrieval-compiler.json` 산출물을 생성함
- `retrieval-request-records.json`, `retrieval-candidate-records.json`, `source-span-priority-records.json`, `retrieval-guard-records.json`, `validation-report.json`, `summary.md`를 함께 출력함
- `schemas/workflow-retrieval-compiler.schema.json`으로 retrieval request, candidate, source span priority, guard record의 최소 계약을 고정함
- Review Dashboard에 `workflow_retrieval_compiler` source/stage/summary metric을 추가하고 request, candidate, selected candidate, source span priority, guard, human review count를 노출함
- Review API에 `/api/workflow-retrieval-compilers`, `/api/retrieval-request-records`, `/api/retrieval-candidate-records`, `/api/source-span-priority-records`, `/api/retrieval-guard-records`, `/api/workflow-retrieval-validations` route를 추가함
- Control Plane Loop에 `workflow_retrieval_compiler` step을 추가하고 Goal Checkpoint에 `workflow_retrieval_compiler_gate` acceptance profile을 추가함
- Contract Golden Fixtures와 Contract Validation Suite에 workflow retrieval compiler artifact와 `workflows:retrieval-compiler` script를 포함함

완료 기준:

- Workflow retrieval compiler가 validation error 없이 `complete` 상태가 됨
- Phase 184 Context Packet v2마다 retrieval request가 정확히 1개 생성됨
- 각 request가 matter wall, classification filter, relevance ranking, source span priority를 모두 적용함
- 모든 accessible resource가 retrieval candidate를 하나 이상 만들고, source span이 없는 resource는 metadata-only fallback candidate로 보존됨
- source span priority record 수가 retrieval candidate 수와 일치하고 retrieval guard가 request마다 1개 생성됨
- cross-matter candidate, blocked classification candidate, query execution, external transfer, protected action execution count가 모두 0임
- law-firm retrieval request는 human review required 상태로 유지됨
- Review API smoke가 retrieval compiler, request, candidate, priority, guard, validation route를 모두 조회함
- Golden fixture 수가 87개로 증가하고 workflow retrieval compiler artifact가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run workflows:retrieval-compiler -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 186 - Workflow Prompt Injection Boundary

Phase 186은 Phase 185의 retrieval candidate를 runtime prompt나 tool instruction으로 바로 넘기지 않고, 모두 `untrusted evidence content` wrapper로 감싸는 prompt injection boundary를 추가했다. 목적은 외부 문서, source span preview, metadata-only fallback 안에 명령처럼 보이는 문장이 있더라도 이를 증거 본문 신호로만 기록하고 system/developer/tool/policy instruction으로 승격하지 못하게 하는 것이다.

구현 내용:

- `src/workflow-prompt-injection-boundary.mjs`와 `scripts/workflow-prompt-injection-boundary.mjs`를 추가해 `artifacts/workflow-prompt-injection-boundary/latest/workflow-prompt-injection-boundary.json` 산출물을 생성함
- `untrusted-content-wrappers.json`, `instruction-signal-records.json`, `prompt-boundary-guard-records.json`, `validation-report.json`, `summary.md`를 함께 출력함
- `schemas/workflow-prompt-injection-boundary.schema.json`으로 untrusted content wrapper, instruction signal, prompt boundary guard의 최소 계약을 고정함
- Review Dashboard에 `workflow_prompt_injection_boundary` source/stage/summary metric을 추가하고 wrapper, instruction signal, neutralization, guard, promotion blocker count를 노출함
- Review API에 `/api/workflow-prompt-injection-boundaries`, `/api/untrusted-content-wrappers`, `/api/instruction-signal-records`, `/api/prompt-boundary-guard-records`, `/api/prompt-injection-boundary-validations` route를 추가함
- Control Plane Loop에 `workflow_prompt_injection_boundary` step을 추가하고 Goal Checkpoint에 `workflow_prompt_injection_boundary_gate` acceptance profile을 추가함
- Contract Golden Fixtures와 Contract Validation Suite에 workflow prompt injection boundary artifact와 `workflows:prompt-injection-boundary` script를 포함함

완료 기준:

- Workflow prompt injection boundary가 validation error 없이 `complete` 상태가 됨
- 모든 retrieval candidate마다 untrusted content wrapper와 instruction signal record가 정확히 1개 생성됨
- 모든 wrapper가 content role을 `evidence_content`로 고정하고 prompt/tool/policy/client/external/protected action promotion을 차단함
- instruction-like text는 deterministic signal로 기록되지만 `evidence_content_only`로 neutralized 되며 prompt/tool instruction으로 승격되지 않음
- retrieval request마다 prompt boundary guard가 1개 생성되고 wrapper/content-role/instruction-promotion/tool-policy guard가 모두 통과함
- client-facing output, external transfer, protected action execution count가 모두 0임
- Review API smoke가 boundary, wrapper, instruction signal, guard, validation route를 모두 조회함
- Golden fixture 수가 88개로 증가하고 workflow prompt injection boundary artifact가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run workflows:prompt-injection-boundary -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 187 - Workflow Pre-run Gate Framework

Phase 187은 Phase 186의 prompt-boundary-guarded workflow run 위에 pre-run gate runner를 추가했다. 목적은 workflow 실행 전에 access, model, tool, budget, conflict gate를 모두 deterministic record로 판단하고, 법률/클라이언트 관련 판단은 human review hold로 묶되 실제 실행, 외부 전송, protected action은 계속 0으로 유지하는 것이다.

구현 내용:

- `src/workflow-pre-run-gate-framework.mjs`와 `scripts/workflow-pre-run-gate-framework.mjs`를 추가해 `artifacts/workflow-pre-run-gates/latest/workflow-pre-run-gate-framework.json` 산출물을 생성함
- `pre-run-gate-records.json`, `pre-run-gate-decisions.json`, `pre-run-gate-guards.json`, `validation-report.json`, `summary.md`를 함께 출력함
- `schemas/workflow-pre-run-gate-framework.schema.json`으로 pre-run gate record, decision, guard의 최소 계약을 고정함
- Matter Access Policy, Model Policy Enforcement, Tool/Runtime Policy, Cost Budget Ledger, Conflict Check Interface를 source contract로 묶어 workflow별 5-gate set을 생성함
- Review Dashboard에 `workflow_pre_run_gate_framework` source/stage/summary metric을 추가하고 gate type, review hold, no-execution blocker count를 노출함
- Review API에 `/api/workflow-pre-run-gate-frameworks`, `/api/pre-run-gate-records`, `/api/pre-run-gate-decisions`, `/api/pre-run-gate-guards`, `/api/pre-run-gate-validations` route를 추가함
- Control Plane Loop에 `workflow_pre_run_gate_framework` step을 추가하고 Goal Checkpoint에 `workflow_pre_run_gate_framework_gate` acceptance profile을 추가함
- Contract Golden Fixtures와 Contract Validation Suite에 workflow pre-run gate framework artifact와 `workflows:pre-run-gates` script를 포함함

완료 기준:

- Workflow pre-run gate framework가 validation error 없이 `complete` 상태가 됨
- 모든 prompt boundary guard마다 access, model, tool, budget, conflict gate가 각각 1개씩 생성됨
- workflow run별 pre-run decision과 guard가 1개씩 생성되고 required gate set 누락이 0건임
- client-confidential/law-firm 또는 tool/conflict review가 필요한 실행은 `hold_for_human_review` decision으로 보존됨
- execution allowed, external transfer allowed, protected action execution count가 모두 0임
- Review API smoke가 pre-run framework, gate, decision, guard, validation route를 모두 조회함
- Golden fixture 수가 89개로 증가하고 workflow pre-run gate framework artifact가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run workflows:pre-run-gates -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 188 - Workflow In-run Gate Framework

Phase 188은 Phase 187의 pre-run hold 위에 실행 중 gate runner를 추가했다. 목적은 tool invocation ledger의 각 런타임 호출에 dangerous command, sensitive access, timeout gate를 묶고, 위험/민감 호출은 deterministic block record로 남기되 실제 실행, continued execution, 외부 전송, protected action은 계속 0으로 유지하는 것이다.

구현 내용:

- `src/workflow-in-run-gate-framework.mjs`와 `scripts/workflow-in-run-gate-framework.mjs`를 추가해 `artifacts/workflow-in-run-gates/latest/workflow-in-run-gate-framework.json` 산출물을 생성함
- `in-run-gate-records.json`, `in-run-block-records.json`, `in-run-guard-records.json`, `validation-report.json`, `summary.md`를 함께 출력함
- `schemas/workflow-in-run-gate-framework.schema.json`으로 in-run gate record, block record, guard의 최소 계약을 고정함
- Workflow Pre-run Gate Framework, Tool Invocation Ledger, Agent Run Ledger, Workflow State Machine Runner를 source contract로 묶어 tool invocation별 3-gate set을 생성함
- Review Dashboard에 `workflow_in_run_gate_framework` source/stage/summary metric을 추가하고 dangerous/sensitive/timeout gate, block record, no-execution metric을 노출함
- Review API에 `/api/workflow-in-run-gate-frameworks`, `/api/in-run-gate-records`, `/api/in-run-block-records`, `/api/in-run-guard-records`, `/api/in-run-gate-validations` route를 추가함
- Control Plane Loop에 `workflow_in_run_gate_framework` step을 추가하고 Goal Checkpoint에 `workflow_in_run_gate_framework_gate` acceptance profile을 추가함
- Contract Golden Fixtures와 Contract Validation Suite에 workflow in-run gate framework artifact와 `workflows:in-run-gates` script를 포함함

완료 기준:

- Workflow in-run gate framework가 validation error 없이 `complete` 상태가 됨
- 39개 tool invocation마다 dangerous command, sensitive access, timeout gate가 각각 1개씩 생성되어 총 117개 in-run gate record가 생성됨
- dangerous target 24건과 sensitive target 39건이 block record 63건으로 전환되고 dangerous/sensitive allowed count가 0임
- 모든 timeout gate가 agent run lifecycle timeout policy에 묶여 pass되고 timeout block/missing count가 0임
- pre-run guard 4개 모두에 in-run guard가 생성되고 1개 no-invocation workflow도 guard presence check를 통과함
- execution allowed, execution performed, continued execution allowed, external transfer allowed, protected action execution count가 모두 0임
- Review API smoke가 in-run framework, gate, block, guard, validation route를 모두 조회함
- Golden fixture 수가 90개로 증가하고 workflow in-run gate framework artifact가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run workflows:in-run-gates -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 189 - Workflow Post-run Gate Framework

Phase 189는 Phase 188의 in-run gate artifact 위에 실행 후 gate runner를 추가했다. 목적은 agent run 산출물이 client-facing release나 delivery로 넘어가기 전에 evidence, citation, test, approval, delivery gate를 deterministic record로 판단하고, regression test는 통과시키되 법률/클라이언트-facing 판단은 human review hold로 보존하는 것이다.

구현 내용:

- `src/workflow-post-run-gate-framework.mjs`와 `scripts/workflow-post-run-gate-framework.mjs`를 추가해 `artifacts/workflow-post-run-gates/latest/workflow-post-run-gate-framework.json` 산출물을 생성함
- `post-run-gate-records.json`, `post-run-gate-decisions.json`, `post-run-gate-guards.json`, `validation-report.json`, `summary.md`를 함께 출력함
- `schemas/workflow-post-run-gate-framework.schema.json`으로 post-run gate record, decision record, guard의 최소 계약을 고정함
- Workflow In-run Gate Framework, Agent Run Ledger, Evidence Coverage, Citation Object Store, Evidence Regression Tests, Approval Authority, Output Destination Policy, Protected Delivery Queue를 source contract로 묶어 agent run별 5-gate set을 생성함
- Review Dashboard에 `workflow_post_run_gate_framework` source/stage/summary metric을 추가하고 post-run evidence/citation/test/approval/delivery gate, human review hold, no-delivery/no-final-action metric을 노출함
- Review API에 `/api/workflow-post-run-gate-frameworks`, `/api/post-run-gate-records`, `/api/post-run-gate-decisions`, `/api/post-run-gate-guards`, `/api/post-run-gate-validations` route를 추가함
- Control Plane Loop에 `workflow_post_run_gate_framework` step을 추가하고 Goal Checkpoint에 `workflow_post_run_gate_framework_gate` acceptance profile을 추가함
- Contract Golden Fixtures와 Contract Validation Suite에 workflow post-run gate framework artifact와 `workflows:post-run-gates` script를 포함함

완료 기준:

- Workflow post-run gate framework가 validation error 없이 `complete` 상태가 됨
- 6개 agent run마다 evidence, citation, test, approval, delivery gate가 각각 1개씩 생성되어 총 30개 post-run gate record가 생성됨
- Evidence/citation/approval/delivery gate는 human review hold로 보존되고 test gate 6개는 regression suite complete + failed case 0 조건으로 통과함
- agent run별 post-run decision과 guard가 1개씩 생성되고 required post-run gate set 누락이 0건임
- client-facing ready, delivery ready, final action executed, execution performed, external transfer, protected action count가 모두 0임
- Review API smoke가 post-run framework, gate, decision, guard, validation route를 모두 조회함
- Golden fixture 수가 91개로 증가하고 workflow post-run gate framework artifact가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run workflows:post-run-gates -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 190 - Gate Result Aggregator

Phase 190은 Phase 187/188/189의 pre-run, in-run, post-run gate와 Phase 105 GateResult v2 계약을 workflow 단위 상태로 합치는 gate result aggregator를 추가했다. 목적은 개별 gate의 `passed`, `blocked`, `review_required`, `pending` 상태를 `pass`, `warn`, `manual`, `fail`로 정규화하고, workflow별 최종 gate status를 만들되 실행, client delivery, protected action, final action을 승인하지 않는 것이다.

구현 내용:

- `src/gate-result-aggregator.mjs`와 `scripts/gate-result-aggregator.mjs`를 추가해 `artifacts/gate-result-aggregator/latest/gate-result-aggregator.json` 산출물을 생성함
- `gate-aggregate-records.json`, `workflow-gate-statuses.json`, `validation-report.json`, `summary.md`를 함께 출력함
- `schemas/gate-result-aggregator.schema.json`으로 gate aggregate record와 workflow gate status record의 최소 계약을 고정함
- Workflow Pre-run Gate Framework, Workflow In-run Gate Framework, Workflow Post-run Gate Framework, Gate/Approval Contract Freeze, Workflow Run Ledger, Agent Run Ledger를 source contract로 묶음
- in-run unsafe block은 실행 차단 경고(`warn`)로, human approval/pending/review gate는 `manual`로, 통과 gate는 `pass`로 정규화함
- Review Dashboard에 `gate_result_aggregator` source/stage/summary metric을 추가하고 aggregate count, workflow status, pass/warn/manual/fail, no-execution/no-delivery/no-final-action metric을 노출함
- Review API에 `/api/gate-result-aggregators`, `/api/gate-aggregate-records`, `/api/workflow-gate-statuses`, `/api/gate-result-aggregate-validations` route를 추가함
- Control Plane Loop에 `gate_result_aggregator` step을 추가하고 Goal Checkpoint에 `gate_result_aggregator_gate` acceptance profile을 추가함
- Contract Golden Fixtures와 Contract Validation Suite에 gate result aggregator artifact와 `workflows:gate-results` script를 포함함

완료 기준:

- Gate result aggregator가 validation error 없이 `complete` 상태가 됨
- pre-run gate 20개, in-run gate 117개, in-run block 63개, post-run gate 30개, GateResult v2 14개를 합쳐 총 244개 aggregate record가 생성됨
- 4개 workflow run ledger record가 모두 workflow gate status로 projection되고 현재 safe demo에서는 모두 `manual_review_required`로 유지됨
- pass/warn/manual gate가 모두 존재하고 failed gate 및 blocked workflow gate status는 0건임
- execution allowed/performed, external transfer, protected action, client-facing ready, delivery ready, final action executed가 모두 0건임
- Review API smoke가 aggregator, aggregate record, workflow status, validation route를 모두 조회함
- Golden fixture 수가 92개로 증가하고 gate result aggregator artifact가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run workflows:gate-results -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 191 - Capability Registry API

목표: Capability Manifest v2, Pack Manifest Compatibility, Domain Pack Registry, Gate Result Aggregator를 묶어 Desktop Companion이 읽을 수 있는 pack/capability/version/gate API card와 read-only route group을 생성한다.

구현:

- `src/capability-registry-api.mjs`와 `scripts/capability-registry-api.mjs`를 추가해 `npm run capabilities:registry-api` slice를 등록
- `schemas/capability-registry-api.schema.json`로 Capability Registry API artifact, card, route group, validation summary를 검증
- pack API card, capability API card, capability version card, gate requirement card를 생성
- Desktop Companion route group을 Overview, Domain Packs, Capabilities, Workflow Gates, Runs, Approvals, Policy/Observability, Diagnostics로 선언
- 모든 Desktop route를 `GET` only, read-only, mutation/protected mutation/secret/installer/gateway control 0건으로 고정
- Review Dashboard stage와 summary metric, Review API route, API smoke, control-plane loop/checkpoint, golden fixture, contract validation suite에 연결
- `docs/desktop-companion-integration.md`에 Hermes Desktop을 runtime/source of truth가 아닌 operator companion surface로 반영

완료 기준:

- Capability Registry API가 validation error 없이 `complete` 상태가 됨
- 4개 pack card, 4개 capability card, 4개 version card, 28개 gate requirement card가 source artifact와 일치
- Desktop Companion route group 8개와 read-only route 31개가 생성되고 mutation/protected mutation/secret/installer/gateway route가 모두 0건임
- Review API가 `/api/capability-registry-apis`, `/api/capability-registry-packs`, `/api/capability-registry-capabilities`, `/api/capability-registry-versions`, `/api/capability-registry-gates`, `/api/desktop-companion-route-groups`, `/api/capability-registry-api-validations`를 제공
- Golden fixture 수가 93개로 증가하고 capability registry API artifact가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run capabilities:registry-api -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 192 - Workflow Run Dashboard

목표: Workflow Run Ledger, DSL state, runner, queue/retry, idempotency, resume/cancel, Gate Result Aggregator, output 상태를 묶어 Desktop Companion이 읽을 수 있는 workflow run panel과 상태 card를 생성한다.

구현:

- `src/workflow-run-dashboard.mjs`와 `scripts/workflow-run-dashboard.mjs`를 추가해 `npm run workflows:run-dashboard` slice를 등록
- `schemas/workflow-run-dashboard.schema.json`로 Workflow Run Dashboard artifact, panel/card/route/summary 계약을 검증
- workflow run별 dashboard panel과 state, queue, gate, output card를 생성
- queue/retry/backoff, idempotency, resume/cancel, workflow gate status, output/delivery 상태를 한 panel에서 read-only로 조회 가능하게 구성
- Desktop Companion용 route record를 모두 `GET` only, read-only, mutation/protected mutation/secret/installer/gateway control 0건으로 고정
- Review Dashboard stage와 summary metric, Review API route, API smoke, control-plane loop/checkpoint, golden fixture, contract validation suite에 연결

완료 기준:

- Workflow Run Dashboard가 validation error 없이 `complete` 상태가 됨
- 4개 workflow run record가 각각 dashboard panel, state card, queue card, gate card, output card로 projection됨
- 4개 panel이 모두 human review/held queue/waiting state를 표시하고 auto dequeue/retry/resume/cancel, protected action executed, final action executed가 모두 0건임
- Review API가 `/api/workflow-run-dashboards`, `/api/workflow-run-dashboard-panels`, `/api/workflow-run-state-cards`, `/api/workflow-run-queue-cards`, `/api/workflow-run-gate-cards`, `/api/workflow-run-output-cards`, `/api/workflow-run-dashboard-validations`를 제공
- Golden fixture 수가 94개로 증가하고 workflow run dashboard artifact가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run workflows:run-dashboard -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 193 - Workflow Golden Cases

목표: law-firm, personal-dev, creative-document 대표 workflow를 fixture suite로 고정하고 DSL state machine, runner, queue/retry, idempotency, resume/cancel, gate, dashboard panel binding이 함께 통과하는지 검증한다.

구현:

- `src/workflow-golden-cases.mjs`와 `scripts/workflow-golden-cases.mjs`를 추가해 `npm run workflows:golden-cases` slice를 등록
- `schemas/workflow-golden-cases.schema.json`로 suite, golden case, state-machine step, regression manifest, summary 계약을 검증
- 각 domain pack에서 대표 workflow를 1개씩 선택해 expected state path와 observed/guarded state path를 비교
- runner plan, transition guard, queue record, idempotency key, resume/cancel record, gate status, capability manifest, workflow run dashboard panel binding을 case별로 고정
- `approved` 단계는 human review hold, `completed` 단계는 post-human-release terminal step으로 다루며 auto transition, protected action, delivery, final action 실행은 모두 0건으로 유지
- Review Dashboard stage와 summary metric, Review API route, API smoke, control-plane loop/checkpoint, golden fixture, contract validation suite에 연결

완료 기준:

- Workflow Golden Cases가 validation error 없이 `complete` 상태가 됨
- law-firm, personal-dev, creative-document 대표 case 3개가 모두 locked 상태와 `state_machine_pass_status=passed`를 가짐
- state-machine step 15개가 모두 passed 상태이며 mutation/protected/final action 실행이 모두 0건임
- Review API가 `/api/workflow-golden-case-suites`, `/api/workflow-golden-cases`, `/api/workflow-golden-case-steps`, `/api/workflow-golden-case-validations`를 제공
- Golden fixture 수가 95개로 증가하고 workflow golden cases artifact가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run workflows:golden-cases -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 194 - Workflow/Gate Freeze

목표: P177-P193 capability, workflow, context, gate, dashboard, golden case 산출물을 capability->workflow->gate->audit vertical slice로 고정하고 Desktop Companion이 읽을 수 있는 read-only 운영 경계를 freeze한다.

구현:

- `src/workflow-gate-freeze.mjs`와 `scripts/workflow-gate-freeze.mjs`를 추가해 `npm run workflows:gate-freeze` slice를 등록
- `schemas/workflow-gate-freeze.schema.json`로 freeze source, checkpoint, vertical slice, loop binding, summary 계약을 검증
- capability manifest, pack compatibility, workflow DSL/runner/queue/idempotency/resume/context/retrieval/prompt boundary, pre/in/post gate, gate result, capability registry API, workflow dashboard, workflow golden cases, workflow run ledger, audit event ledger를 freeze source로 묶음
- law-firm, personal-dev, creative-document 대표 workflow 3개를 capability, workflow run, dashboard panel, gate aggregate, event binding, audit ledger 상태에 연결한 vertical slice로 고정
- Desktop Companion readiness를 `read_only_ready`로 고정하되 mutation, protected action, final action, installer/gateway/secrets 실행은 0건으로 유지
- Review Dashboard stage와 summary metric, Review API route, API smoke, control-plane loop/checkpoint, golden fixture, contract validation suite에 연결

완료 기준:

- Workflow/Gate Freeze가 validation error 없이 `complete` 상태가 됨
- 19개 freeze source가 모두 passed 상태이고 P177-P193 control-plane loop binding이 모두 passed 상태임
- 대표 domain pack 3개 vertical slice가 capability/workflow/gate/audit/Desktop binding을 모두 통과함
- mutation/protected action/final action 실행이 모두 0건이고 Desktop Companion readiness가 `read_only_ready`임
- Review API가 `/api/workflow-gate-freezes`, `/api/workflow-gate-freeze-sources`, `/api/workflow-gate-freeze-checkpoints`, `/api/workflow-gate-vertical-slices`, `/api/workflow-gate-loop-bindings`, `/api/workflow-gate-freeze-validations`를 제공
- Golden fixture 수가 96개로 증가하고 workflow gate freeze artifact가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run workflows:gate-freeze -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 195 - Runtime Adapter Interface v2

목표: Phase 104 Runtime/AgentRun v2 contract freeze를 P195-P212 runtime adapter 작업의 실행 전 인터페이스로 승격하고, Hermes Desktop은 runtime/source of truth가 아니라 read-only operator surface라는 경계를 고정한다.

구현:

- `src/runtime-adapter-interface-v2.mjs`와 `scripts/runtime-adapter-interface-v2.mjs`를 추가해 `npm run contracts:runtime-interface` slice를 등록
- `schemas/runtime-adapter-interface-v2.schema.json`으로 runtime adapter interface, required field group, operator surface policy, validation summary 계약을 검증
- Runtime/AgentRun contract freeze의 9개 runtime adapter를 input, output, artifact, log, risk, verification field group에 매핑하고 모든 interface를 `locked` 상태로 고정
- Desktop/operator surface policy를 runtime별로 생성해 `read_only_runtime_status`, `mutation_allowed=false`, `protected_mutation_request_allowed=false`, `protected_mutation_execution_allowed=false`, `secret_material_exposed=false`, `installer_or_gateway_control=false`, `runtime_source_of_truth=false`를 확정
- Review Dashboard stage/summary, Review API route, API smoke, control-plane loop/checkpoint, golden fixture, contract validation suite에 연결

완료 기준:

- Runtime Adapter Interface v2가 validation error 없이 `complete` 상태가 됨
- runtime 9개 interface가 모두 input/output/artifact/log/risk/verification contract를 lock하고 runtime execution contract에 binding됨
- operator surface policy 9개가 모두 read-only이며 mutation/protected mutation request/protected execution/secret/installer/gateway/source-of-truth count가 0임
- Review API가 `/api/runtime-adapter-interface-v2`, `/api/runtime-adapter-interfaces`, `/api/runtime-adapter-interface-fields`, `/api/runtime-operator-surface-policies`, `/api/runtime-adapter-interface-validations`를 제공
- Golden fixture 수가 97개로 증가하고 runtime adapter interface artifact가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run contracts:runtime-interface -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 196 - Hermes Runtime Adapter

목표: Hermes runtime을 harness runtime/source-of-truth가 아니라 bounded runtime adapter로 고정하고, Hermes 호출 결과가 AgentRun ledger 필드로 수집되는 계약을 만든다. Hermes Desktop은 계속 read-only Desktop Companion/operator surface로 남긴다.

구현:

- `src/hermes-runtime-adapter.mjs`와 `scripts/hermes-runtime-adapter.mjs`를 추가해 `npm run runtime:hermes-adapter` slice를 등록
- `schemas/hermes-runtime-adapter.schema.json`으로 Hermes runtime adapter contract, invocation result contract, AgentRun ledger binding, Desktop boundary를 검증
- Runtime Adapter Interface v2의 Hermes interface와 Runtime/AgentRun freeze의 Hermes execution contract, `binding.hermes.cli.default`, AgentRun ledger sink를 하나의 locked adapter artifact로 연결
- Hermes invocation result contract가 `runtime_invocation_id`, `agent_run_id`, `workflow_run_id`, output/log/artifact/verification 필드를 AgentRun ledger reference model로 수집하도록 고정
- Desktop boundary를 `read_only_runtime_status`, `runtime_source_of_truth=false`, `desktop_source_of_truth=false`, protected mutation request/execution false, secret/installer/gateway/SSH/cron/skill-install false로 검증
- Review Dashboard stage/summary, Review API routes, API smoke, control-plane loop/checkpoint, golden fixture, contract validation suite에 연결

완료 기준:

- Hermes Runtime Adapter가 validation error 없이 `complete` 상태가 됨
- Hermes interface, runtime execution contract, command binding, AgentRun ledger sink가 모두 bound/locked 상태가 됨
- invocation result collection status가 `ready`이고 uncollected invocation count가 0임
- execute mode는 human gate와 policy snapshot 없이는 허용되지 않으며 external runtime call without gate가 false임
- Review API가 `/api/hermes-runtime-adapter`, `/api/hermes-invocation-result-contracts`, `/api/hermes-agent-run-ledger-bindings`, `/api/hermes-runtime-desktop-boundary`, `/api/hermes-runtime-adapter-validations`를 제공
- Golden fixture 수가 98개로 증가하고 hermes runtime adapter artifact가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run runtime:hermes-adapter -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 197 - Claude Code Adapter Contract

목표: Claude Code runtime lane을 직접 신뢰하거나 직접 적용하는 실행자가 아니라 untrusted diff/pr draft 산출물을 내는 adapter contract로 고정한다. 모든 patch는 AgentRun ledger와 diff/protected-file/test/human gate를 거쳐야 한다.

구현:

- `src/claude-code-adapter-contract.mjs`와 `scripts/claude-code-adapter-contract.mjs`를 추가해 `npm run runtime:claude-code-adapter` slice를 등록
- `schemas/claude-code-adapter-contract.schema.json`으로 Claude Code adapter contract, diff gate contract, AgentRun ledger binding, Desktop boundary를 검증
- Runtime Adapter Interface v2의 Claude Code interface, Runtime/AgentRun freeze의 Claude Code execution contract, `binding.claude_code.cli.default`, AgentRun ledger sink를 하나의 locked artifact로 연결
- Claude Code output을 `diff_or_pr_draft_only`, `patch_trust=untrusted_until_reviewed`, `output_trust=untrusted_until_verified`로 고정하고 direct apply/merge/protected path write를 모두 false로 설정
- Diff gate policy가 protected file gate, diff review gate, test gate, human approval gate를 요구하도록 lock
- Desktop boundary를 `read_only_runtime_status`, `runtime_source_of_truth=false`, protected mutation request/execution false, secret/installer/gateway/SSH/cron/skill-install false로 검증
- Review Dashboard stage/summary, Review API routes, API smoke, control-plane loop/checkpoint, golden fixture, contract validation suite에 연결

완료 기준:

- Claude Code Adapter Contract가 validation error 없이 `complete` 상태가 됨
- Claude Code interface, runtime execution contract, command binding, AgentRun ledger sink가 모두 bound/locked 상태가 됨
- diff gate binding status가 `ready`이고 direct apply/merge/protected path write가 false임
- protected file, diff review, test, human review gate가 모두 required로 고정됨
- Review API가 `/api/claude-code-adapter-contract`, `/api/claude-code-diff-gate-contracts`, `/api/claude-code-agent-run-ledger-bindings`, `/api/claude-code-desktop-boundary`, `/api/claude-code-adapter-validations`를 제공
- Golden fixture 수가 99개로 증가하고 claude code adapter contract artifact가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run runtime:claude-code-adapter -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 198 - Codex Adapter Contract

목표: Codex runtime lane을 직접 신뢰하거나 직접 적용하는 실행자가 아니라 untrusted patch/pr draft 산출물을 내는 adapter contract로 고정한다. 모든 patch는 AgentRun ledger와 protected-file/diff-review/test/human gate를 거쳐야 하며, Hermes Desktop은 Codex 실행 source of truth가 아니라 읽기 전용 operator surface로만 남긴다.

구현:

- `src/codex-adapter-contract.mjs`와 `scripts/codex-adapter-contract.mjs`를 추가해 `npm run runtime:codex-adapter` slice를 등록
- `schemas/codex-adapter-contract.schema.json`으로 Codex adapter contract, patch gate contract, AgentRun ledger binding, Desktop boundary를 검증
- Runtime Adapter Interface v2의 Codex interface, Runtime/AgentRun freeze의 Codex execution contract, `binding.codex.cli.default`, AgentRun ledger sink를 하나의 locked artifact로 연결
- Codex output을 `patch_or_pr_draft_only`, `patch_trust=untrusted_until_reviewed`, `output_trust=untrusted_until_verified`로 고정하고 direct apply/merge/protected path write를 모두 false로 설정
- Patch gate policy가 protected file gate, diff review gate, test gate, human approval gate를 요구하도록 lock
- Desktop boundary를 `read_only_runtime_status`, `runtime_source_of_truth=false`, protected mutation request/execution false, secret/installer/gateway/SSH/cron/skill-install false로 검증
- Review Dashboard stage/summary, Review API routes, API smoke, control-plane loop/checkpoint, golden fixture, contract validation suite에 연결

완료 기준:

- Codex Adapter Contract가 validation error 없이 `complete` 상태가 됨
- Codex interface, runtime execution contract, command binding, AgentRun ledger sink가 모두 bound/locked 상태가 됨
- patch gate binding status가 `ready`이고 direct apply/merge/protected path write가 false임
- protected file, diff review, test, human review gate가 모두 required로 고정됨
- Review API가 `/api/codex-adapter-contract`, `/api/codex-patch-gate-contracts`, `/api/codex-agent-run-ledger-bindings`, `/api/codex-desktop-boundary`, `/api/codex-adapter-validations`를 제공
- Golden fixture 수가 100개로 증가하고 codex adapter contract artifact가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run runtime:codex-adapter -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Phase 199 - Local Script Adapter

목표: deterministic extractor, classifier, validator, renderer-preparation 스크립트를 local-only runtime adapter contract로 고정한다. Local Script output은 self-report가 아니라 output hash, logs, artifacts, deterministic validation, AgentRun ledger binding을 통해 검증되며, Desktop은 실행자가 아니라 read-only operator surface로만 소비한다.

구현:

- `src/local-script-adapter.mjs`와 `scripts/local-script-adapter.mjs`를 추가해 `npm run runtime:local-script-adapter` slice를 등록
- `schemas/local-script-adapter.schema.json`으로 local script adapter contract, execution contract, AgentRun ledger binding, Desktop boundary를 검증
- Runtime Adapter Interface v2의 Local Script interface, Runtime/AgentRun freeze의 Local Script execution contract, `binding.local_script.node.default`, AgentRun ledger sink를 하나의 locked artifact로 연결
- Local Script execution을 `local_process`, `network_access_allowed=false`, `external_execution_allowed=false`, `workspace_isolation_type=temp_dir`, `prompt_delivery=none`으로 고정
- deterministic execution policy가 direct final delivery, protected path write, secret material, runtime self-report trust를 모두 false로 설정하고 renderer는 preparation-only 단계로 유지
- 현재 Local Script AgentRun 3건을 execution contract로 materialize하고 output hash/log/artifact/verification/deterministic validation capture를 ready 상태로 검증
- Review Dashboard stage/summary, Review API routes, API smoke, control-plane loop/checkpoint, golden fixture, contract validation suite에 연결

완료 기준:

- Local Script Adapter가 validation error 없이 `complete` 상태가 됨
- Local Script interface, runtime execution contract, command binding, AgentRun ledger sink가 모두 bound/locked 상태가 됨
- execution contract 3건이 locked 상태이며 output hash, logs, artifacts, deterministic validation capture가 모두 ready/present/captured임
- network/external execution, direct final delivery, protected path write, secret material, runtime self-report trust가 모두 false임
- Review API가 `/api/local-script-adapter`, `/api/local-script-execution-contracts`, `/api/local-script-agent-run-ledger-bindings`, `/api/local-script-desktop-boundary`, `/api/local-script-adapter-validations`를 제공
- Golden fixture 수가 101개로 증가하고 local script adapter artifact가 regression fixture에 포함됨
- `npm test`, `npm run validate`, `npm run runtime:local-script-adapter -- --check`, `npm run contracts:golden-fixtures -- --check`, `npm run contracts:validate -- --check`, `npm run dashboard:build`, `npm run api:smoke`, `npm run contracts:inventory`, `npm run contracts:dependencies -- --check`, `npm run control-plane:loop`가 통과함

## Planned Final Completion Envelope: P089-P312

이 섹션은 완료된 phase 기록이 아니라 Hermes Harness v1.0 최종 완성까지 끊기지 않고 이어갈 계획 슬롯이다. 실제 구현을 마친 항목만 위와 같은 `## Phase N` heading으로 승격한다. Goal checkpoint와 roadmap parser가 미래 계획을 완료된 phase로 오인하지 않도록, 계획 슬롯은 `P089` 형식을 사용한다.

세부 planned slot 장부는 `docs/final-completion-phase-ledger.md`에 둔다. 이 장부는 P089-P312 각각의 목표, 주요 산출물, 완료 기준을 미리 정의하며, 실제 구현 완료 후에만 이 문서의 `## Phase N` 기록으로 승격한다.

운영 원칙:

- 현재 완료 기준점은 Phase 199이다.
- v1.0 최종 완성 목표는 P312까지로 고정한다.
- 남은 계획 슬롯은 P200-P312, 총 113개다.
- 각 자동 진행 heartbeat는 가장 앞선 미완료 슬롯을 선택해 `검증 -> 보강 -> 구현 -> 검증 -> commit` 순서로 진행한다.
- 새 기능은 반드시 Core 계약, Policy, Event/Run/Audit, Gate, Output, Dashboard/API 노출 중 필요한 계층을 함께 통과해야 한다.
- 완료된 슬롯은 구체적 구현 산출물과 완료 기준을 작성한 뒤 `## Phase N` 형식으로 승격한다.

| Planned slots | Macro track | Completion intent |
| --- | --- | --- |
| P089-P096 | Human Review Cycle Closure | command receipt, held command, protected approval, actor follow-up을 사람이 처리 가능한 완결 루프로 닫고 Human Review Cycle v1을 freeze한다. |
| P097-P112 | Core Contracts, Schema, Migration Spine | Resource, Matter, Evidence, Capability, Workflow, Runtime, Gate, Approval, Output, Audit 계약을 versioned schema와 migration strategy로 고정한다. |
| P113-P132 | Identity, Policy, Matter Boundary | tenant, user, role, client, counterparty, matter, matter team, ethical wall, data classification, model/tool/runtime policy를 1급 계층으로 완성한다. |
| P133-P158 | Resource, Data, Evidence, Lineage Plane | immutable resource store, normalized text, source span, evidence, fact, issue, citation, lineage, coverage score를 end-to-end로 완성한다. |
| P159-P176 | Event, Run Ledger, Audit, Observability | CloudEvents-style event log, workflow run, agent run, audit trail, policy snapshot, cost ledger, trace/metric/log projection을 운영 가능하게 만든다. |
| P177-P194 | Capability, Workflow, Context, Gate Engine | capability manifest, workflow state machine, idempotency, retry/resume, context builder, retrieval compiler, pre/in/post gate contract를 완성한다. |
| P195-P212 | Runtime Adapter, Sandbox, Worktree, Secrets | Hermes, Claude Code, Codex, local script, renderer adapter를 sandbox/worktree/secrets boundary와 artifact capture 아래에서 실행하고 Desktop은 runtime이 아닌 operator surface로 계약화한다. |
| P213-P230 | Personal Dev Domain Pack | repo profile, agent instruction registry, plan reconciliation, parallel worktree lane, diff review, canonical test, PR draft, debt ledger, release/rollback flow를 완성한다. |
| P231-P252 | Law Firm Domain Pack | Matter OS, Evidence OS, LDD, litigation brief, meeting minutes, contract draft, VDR review, provided-material review, legal citation verifier, attorney approval workflow를 완성한다. |
| P253-P266 | Creative and Document Domain Pack | template/style/asset registry, DOCX/PPTX/PDF/HTML renderer, layout validator, citation renderer, design system, web novel/video/PPTX production workflows를 완성한다. |
| P267-P276 | Connector and Ingestion Layer | Outlook email, KakaoTalk import boundary, OneDrive/local folder, GitHub, VDR, Plaud, ERP, future Slack/Teams connector를 adapter 방식으로 확장한다. |
| P277-P286 | Resource Expansion and Extractor Library | 2,713개 이상 파일 backfill, resumable batch cursor, quarantine, duplicate detection, extractor registry, document-type coverage dashboard를 완성한다. |
| P287-P296 | API, Dashboard, Evidence Viewer, Matter Cockpit | API server, review dashboard, Desktop-ready route group, approval queue, evidence viewer, source span inspector, run ledger viewer, matter cockpit, policy violation queue를 usable UI로 연결한다. |
| P297-P304 | Security, Compliance, Performance Hardening | prompt injection boundary, secrets scanning, external model policy, Desktop companion risk, retention, access review, cost cap, performance budget, backup/restore 검증을 마친다. |
| P305-P312 | End-to-End Acceptance, Deployment, v1.0 Freeze | law-firm, personal-dev, creative-document의 대표 workflow를 전체 계층으로 통과시키고 docs/runbooks/deployment/Desktop-readiness/release gate를 완료해 Hermes Harness v1.0을 freeze한다. |

최종 완료 정의:

- P312까지 승격된 모든 phase가 `npm run validate`, `npm test`, 관련 slice command, `npm run control-plane:loop`, API/dashboard smoke를 통과한다.
- 로펌용 산출물은 Matter Boundary, Data Classification, Evidence Lineage, Citation Gate, Human Approval을 통과한다.
- 개인 개발용 산출물은 Runtime Adapter, Worktree Isolation, Diff Review, Canonical Test Gate, PR/rollback 기록을 통과한다.
- 문서/콘텐츠 산출물은 Template/Style/Asset Registry, Renderer, Layout Validation, Output Artifact, Approval/Audit를 통과한다.
- 중요한 실행은 Event Ledger, Run Ledger, Audit Trail, Cost/Observability projection에 남는다.
- Domain Pack은 core 수정 없이 manifest와 contract로 등록 가능하다.
