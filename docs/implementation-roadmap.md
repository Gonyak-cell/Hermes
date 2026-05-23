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
