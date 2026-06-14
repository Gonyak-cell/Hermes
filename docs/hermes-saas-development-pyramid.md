# Hermes SaaS 장기개발 피라미드 계층 구조

문서 버전: v0.1
작성일: 2026-06-11
입력자료: `docs/hermes-enterprise-saas-specification.md`
작성 목적: Hermes Enterprise SaaS 사양명세서를 기준으로 향후 Testable Unit of Work를 안정적으로 생성하기 위한 Product Breakdown Structure, Delivery Breakdown Structure, Work Breakdown Structure 상위 골격을 정의한다.

## 0. 개발 운영체계 명칭

Hermes의 장기개발 운영체계 명칭은 다음으로 고정한다.

영문:

> Risk-based, Verification-driven, Loop-based SaaS Development Operating System

한국어:

> 위험도 기반·검증 중심·루프형 SaaS 개발 운영체계

이 운영체계는 단순 작업 분해가 아니라 제품 사양, 위험도, 권한, 검증, 리뷰, 감사 기록, 릴리스 판단을 하나의 장기 실행 구조로 연결한다. 핵심 아키텍처는 `Planner–Executor–Verifier–Governor Architecture`다.

| 역할 | 책임 |
|---|---|
| Planner | Product North Star, Constitution, Pillar, Domain, Module, Capability, Feature, Epic, Story를 구조화한다. |
| Executor | Agent Work Contract 범위 안에서 Technical Task와 Testable Unit of Work를 수행한다. |
| Verifier | Verification Contract와 Verification Case를 기준으로 산출물을 검증한다. |
| Governor | 권한, 보안, 비용, 릴리스, human gate, ledger 기록을 통제한다. |

Hermes의 loop는 다음 다섯 종류로 분류한다.

- Exploration Loop: 불명확한 요구사항과 source scope를 구조화한다.
- Convergence Loop: plan, source, evidence, review finding을 하나의 실행 후보로 수렴시킨다.
- Orchestrated Integration Loop: 여러 Pillar, Domain, Module 간 의존성을 통합한다.
- Learning Loop: 사용자 correction, reviewer finding, validation failure를 Operational Knowledge Base와 Learning Ledger로 승격한다.
- Governance Loop: protected action, release, connector write, enterprise trust claim을 gate와 audit로 통제한다.

## 1. 사양명세서 기반 입력자료 분석

### 1.1 제품명

- 제품명: Hermes
- 제품 카테고리: Project Operations SaaS, Workflow Control Plane, Evidence-backed Work OS, Agent Governance Platform, Domain Pack 기반 운영 자동화 플랫폼
- 장기 제품 지위: local harness에서 enterprise multi-tenant SaaS 및 hybrid/private deployment까지 확장되는 Work OS control plane

### 1.2 제품 목적

Hermes는 프로젝트, 업무, 자료, 의사결정, 리뷰, 승인, 실행 후보, 감사 trail을 stable ID와 evidence로 묶어 사람이 검토 가능한 운영 상태로 유지하는 enterprise-grade Work OS control plane이다.

사양명세서에서 확인되는 목적:

- 여러 프로젝트와 도메인 업무를 하나의 deterministic control plane에서 운영한다.
- task list가 아니라 source, decision, review, gate, receipt가 연결된 workflow graph를 제공한다.
- AI worker와 reviewer의 역할, 권한, evidence class를 분리한다.
- protected action이 human gate와 audit 없이 실행되지 않도록 한다.
- domain pack을 통해 개인 개발, 법률, 문서 제작, connector/resource, product/support/compliance operations를 확장한다.

### 1.3 핵심 사용자

| 사용자 | 사양명세서상 니즈 | 구조화된 개발 관점 |
|---|---|---|
| Founder / Solo Builder | 여러 제품 개발 흐름을 놓치지 않기 | personal-dev, cockpit, daily brief, closeout loop 우선 |
| Engineering Lead | agent-assisted 개발 품질과 근거 관리 | plan, patch, validation, review, release readiness 연결 |
| Product Manager | 요구사항, 고객 피드백, release 상태 연결 | product-ops pack, requirement traceability, roadmap, changelog |
| Legal Operator | matter, evidence, deadline, attorney review 관리 | law-firm pack, matter boundary, legal protected action |
| Creative Producer | 문서/슬라이드/asset production 관리 | creative-document pack, template/style/output artifact 검증 |
| Compliance / Security Owner | AI 사용과 자료 접근 통제 | policy, audit, access review, DLP, prompt-injection guard |
| Executive / Client Sponsor | 운영 상태와 위험 이해 | executive/client-safe brief, trust ledger, blocker projection |

### 1.4 주요 사용 시나리오

- 개발 프로젝트 closeout: goal 설정, phase plan, Agent Work Contract, validation, independent review, finding loop, human adjudication, closeout classification
- 법률 matter daily brief: read-only connector ingestion, matter boundary 확인, evidence 후보 생성, attorney review, client-safe brief
- Creative document production: template/style 선택, source evidence binding, draft artifact, layout/citation validation, approval packet, export bundle
- Connector backfill: consent receipt, source inventory, resource state transition, quarantine, evidence candidate queue
- Enterprise governance: SSO/SCIM, DLP, data residency, compliance evidence export, incident workflow, audit explorer
- Controlled execution: dry-run preview, write action manifest, human approval receipt, rollback binding, post-write validation

### 1.5 핵심 업무흐름

| 업무흐름 | 입력 | 처리 | 출력 |
|---|---|---|---|
| Goal-to-Plan | goal, risk tier, source scope | phase plan, dependency, budget, stop condition 정리 | Agent Work Contract 후보 |
| Plan-to-Execution | Agent Work Contract, allowed sources | Technical Task 수행, artifact 생성 | implementation/result artifact |
| Evidence-to-Claim | resource, source span, claim | evidence classification, confidence, freshness, conflict | evidence item |
| Review-to-Finding | review packet, validation receipt | independent review, finding normalization | finding lifecycle |
| Gate-to-Decision | evidence, review, risk, protected action | human gate, policy gate, completion gate | decision, block reason, next allowed action |
| Connector-to-Evidence | external source, consent | ingestion, extraction, quarantine | evidence candidate |
| Release-to-Governance | release candidate, migration, rollback | production gate, signed provenance, post-deploy validation | release readiness classification |

### 1.6 주요 기능

- Workspace and Tenant OS
- Project and Domain Pack Registry
- Goal, Plan, Agent Work Contract Control Plane
- Workflow Loop Engine
- Evidence OS
- Resource and Connector Governance
- Operational Knowledge Base
- Review, Finding, Human Gate Plane
- Agent Runtime and Tool Governance
- Operator Console and Work OS UI
- Collaboration and Notification Layer
- Reporting, Analytics, and Trust Ledger
- Admin, Security, Compliance, and Billing
- Developer Platform, SDK, and Marketplace
- Deployment, Release, and Production Governance

### 1.7 주요 데이터 객체

명시 객체:

- `tenant_id`
- `workspace_id`
- `project_id`
- `domain_pack_id`
- `workflow_id`
- `workflow_run_id`
- `goal_id`
- `plan_id`
- `work_packet_id`
- `resource_id`
- `resource_version_id`
- `evidence_id`
- `source_span_id`
- `artifact_id`
- `review_id`
- `finding_id`
- `gate_id`
- `receipt_id`
- `audit_event_id`

TUW 생성 시 정규화할 객체명:

- `work_packet_id`는 Agent Work Contract artifact의 식별자로 해석한다.
- context and memory 관련 객체는 Operational Knowledge Base 객체군으로 정규화한다.
- 검증 관련 표현은 Verification Contract와 Verification Case로 정규화한다.

### 1.8 권한·보안 요구사항

명시 요구사항:

- RBAC, ABAC
- SSO, SCIM, MFA
- session policy, IP allowlist, device policy
- service account, API key management
- tenant isolation
- data classification: public, internal, confidential, restricted, privileged, regulated, secret
- field-level redaction, object-level permission
- encryption at rest, encryption in transit, customer-managed key
- audit log export
- access review
- DLP hooks
- incident response
- legal hold, retention, deletion proof

Protected action:

- external message send
- legal/client-facing output release
- production deploy
- external service write
- connector write
- file deletion
- billing action
- user permission change
- secret access
- data export
- retention deletion
- incident close

### 1.9 AI 또는 자동화 요구사항

명시 요구사항:

- Risk-based Model Routing
- model registry
- model route policy
- model compatibility policy
- tool registry
- command allowlist
- sandbox, timeout, budget policy
- token/cost ledger
- secret redaction
- prompt-injection guard
- tool invocation ledger
- runtime adapter interface
- dry-run simulation
- runtime replay
- output destination policy
- generated patch candidate lane
- controlled execution candidate lane

AI 권한 원칙:

- AI는 최종 승인자가 아니다.
- worker가 자기 결과를 final approve할 수 없다.
- reviewer는 source mutation을 수행하지 않는다.
- auth failure는 valid review가 아니다.
- dry-run은 actual write가 아니다.

### 1.10 외부연동 요구사항

명시 connector:

- local folder
- Google Drive
- OneDrive / SharePoint
- Dropbox
- GitHub
- GitLab
- Linear
- Jira
- Slack
- Microsoft Teams
- Outlook Email
- Gmail
- Google Calendar
- Outlook Calendar
- CRM
- ERP
- DMS
- VDR
- S3-compatible object storage
- webhook
- public web connector

연동 정책:

- read-only ingestion 우선
- write connector는 별도 maturity gate 필요
- consent receipt, auth status projection, permission scope inventory 필수
- quarantine, deduplication, unsupported file handling, secret detection, prompt-injection detection 필수

### 1.11 관리자 기능

- tenant, workspace, project, user, team, service account 관리
- role, attribute, domain boundary policy 관리
- connector registry와 auth status 관리
- data region, retention, customer-managed key 설정
- SSO, SCIM, MFA, API key, DLP 설정
- audit log export
- billing plan, usage metering, invoices
- domain pack install, upgrade, deprecation
- compliance evidence export
- incident workflow 관리

### 1.12 명확한 제외범위

사양명세서에서 제외된 범위:

- 변호사, 회계사, 의사, 투자자문가 등 전문직 최종 판단 대체
- 법률 의견, 소송 전략, filing decision, client advice의 최종 승인 대체
- GitHub, Linear, Jira, DMS, CRM, ERP, email, calendar, cloud drive의 원본 system of record 대체
- secret manager, payment processor, production deploy platform의 권한 체계 대체
- 무제한 autonomous agent runtime
- 인간 검토 없는 protected closeout

### 1.13 불명확한 부분

추가 확인 필요:

- 첫 commercial wedge: personal-dev, regulated operations, multi-domain Work OS 중 무엇을 우선할지
- Cloud SaaS 우선인지 local-first/hybrid 성숙 우선인지
- Postgres/event-store를 first-class source로 둘지, local artifact compatibility를 동등하게 유지할지
- domain pack marketplace 공개 시점
- controlled execution을 어느 action class부터 열지
- enterprise trust의 independent review evidence를 어떤 외부 시스템과 연결할지
- legal/law-firm domain pack을 commercial wedge로 사용할지 여부

### 1.14 중복·충돌·용어 불일치

정리 필요:

- `work_packet`과 Agent Work Contract: 사양명세서의 `work_packet_id`는 유지하되 개발 운영체계에서는 Agent Work Contract로 취급한다.
- `memory` 표현과 Operational Knowledge Base: 제품 사양의 Context and Memory Grounding은 향후 Operational Knowledge Base로 정규화한다.
- `validation`, `test`, `review`, `gate`의 경계: validator 결과, independent review, human gate, release gate는 별도 evidence class로 분리해야 한다.
- Evidence OS와 Resource/Connector Governance의 경계: connector는 자료 발견/동기화/격리까지, Evidence OS는 claim-evidence binding부터 책임지는 구조로 고정한다.
- Admin/Security/Compliance/Billing은 하나의 Pillar로 묶여 있으나 TUW 생성 시 identity/policy/compliance/billing을 별도 Domain으로 분리해야 한다.
- Release Governance와 Controlled Execution의 선후관계: write/protected action maturity가 production governance보다 먼저 안정화되어야 한다.

## 2. Product North Star

### 2.1 핵심 문제

현대 SaaS 개발과 지식 업무는 AI, 사람, 외부 시스템, connector, 문서, review, approval이 섞여 있다. 기존 도구는 task, 문서, chat, issue, source code, approval, audit을 각각 따로 관리한다. 그 결과 다음 문제가 발생한다.

- 작업의 현재 상태와 근거가 분리된다.
- AI 결과가 검증 없이 승인처럼 보인다.
- source와 claim의 연결이 끊긴다.
- 리뷰와 gate가 느슨한 기록으로 남는다.
- protected action의 권한이 암묵적으로 확장된다.
- 장기 프로젝트에서 plan, finding, decision, release readiness가 누적되지 않는다.

Hermes의 North Star는 이 분리를 없애고, 모든 프로젝트와 domain workflow를 evidence-backed control plane 위에 올리는 것이다.

### 2.2 핵심 사용자

우선 핵심 사용자는 다음 순서로 본다.

1. Founder / Solo Builder
2. Engineering Lead
3. Product Manager
4. Compliance / Security Owner
5. Legal Operator
6. Creative Producer
7. Executive / Client Sponsor

추가 확인 필요:

- commercial wedge가 personal-dev인지 regulated operations인지에 따라 1차 사용자 순서가 달라질 수 있다.

### 2.3 반복적으로 줄여야 할 업무

- 매번 프로젝트 상태를 다시 설명하는 일
- source와 evidence를 수동으로 찾아 붙이는 일
- review packet을 수동으로 조립하는 일
- finding과 remediation 상태를 수동 추적하는 일
- protected action의 권한 근거를 뒤늦게 찾는 일
- release readiness와 rollback readiness를 매번 새로 점검하는 일
- connector ingestion failure와 quarantine을 사람이 기억하는 일

### 2.4 기존 도구 대비 차별점

| 기존 도구 | 한계 | Hermes 차별점 |
|---|---|---|
| Task manager | task와 source/evidence/review/gate가 분리됨 | workflow graph와 evidence-backed gate 통합 |
| Chat AI | 결과의 근거와 권한이 불명확 | Risk-based Model Routing과 Verification Contract |
| Issue tracker | 개발 외 domain workflow 확장 어려움 | domain pack 기반 확장 |
| DMS | 문서 저장 중심 | source span, evidence, review, protected output 연결 |
| Agent runner | 실행 중심 | authority-aware control plane |
| BI dashboard | 상태 표시 중심 | next allowed action과 gate state 제공 |

### 2.5 장기 제품 수준

Hermes의 장기 제품 수준은 다음이다.

- 개인 개발자에게는 매일 다음 작업을 잃지 않게 하는 운영 코파일럿
- 팀에게는 project, evidence, review, release 상태를 공유하는 Work OS
- regulated enterprise에게는 AI-assisted work를 통제 가능한 business process로 바꾸는 control plane
- 외부 개발자에게는 domain pack과 connector를 만들 수 있는 platform ecosystem

### 2.6 사양명세서상 근거

근거:

- 제품 정의: Hermes는 enterprise-grade Work OS control plane
- 제품 범위: 15개 최상위 모듈
- 데이터 모델: stable ID 중심
- AI 정책: Risk-based Model Routing, protected action candidate gate
- 보안: tenant/workspace/project/domain/resource/action class 권한 축
- 로드맵: Harness Foundation에서 Platform Ecosystem까지

### 2.7 추가 확인 필요

- first commercial wedge
- first production deployment model
- enterprise trust evidence 연결 방식
- domain pack marketplace 공개 시점
- controlled execution first action class

## 3. Product Constitution

### 3.1 Product Constitution

사양명세서 근거:

- Hermes는 Work OS control plane이다.
- domain pack은 제품 정체성이 아니라 확장 모듈이다.
- task list가 아니라 source, decision, review, gate, receipt가 연결된 workflow graph다.
- UI는 marketing surface가 아니라 dense operator console이다.
- local harness와 cloud SaaS는 같은 core contract를 공유한다.

확장 제안:

- 모든 제품 화면과 API는 `project_id`, `domain_pack_id`, `workflow_run_id`, `evidence_id`, `gate_id` 중 하나 이상의 trace anchor를 보여야 한다.
- 모든 주요 제품 문서는 Product Breakdown Structure, Delivery Breakdown Structure, Work Breakdown Structure 중 어느 층을 다루는지 표시해야 한다.

### 3.2 Data Constitution

사양명세서 근거:

- stable ID 기반 객체 모델
- tenant, workspace, project, domain pack, matter/client boundary
- resource versioning, source span, evidence item
- raw source exposure default deny
- redacted projection as default UI payload
- retention, legal hold, deletion proof

확장 제안:

- 모든 evidence item은 source freshness와 permission projection을 함께 가진다.
- 모든 derived artifact는 input source hash와 policy snapshot ref를 가진다.
- data lifecycle은 discovered, ingested, normalized, indexed, evidence_candidate, reviewed, archived, deleted/proofed 상태를 가진다.

### 3.3 Security Constitution

사양명세서 근거:

- SSO, SCIM, MFA, session policy, IP allowlist
- tenant isolation, object-level permission, field-level redaction
- data classification과 protected action class
- DLP, incident response, audit log export

확장 제안:

- privileged/regulatory domain pack은 별도 policy baseline을 가진다.
- connector별 least privilege scope diff를 operator console에서 보여준다.
- protected action preview는 실행 전 영향 범위와 rollback 가능성을 표시한다.

### 3.4 AI Constitution

사양명세서 근거:

- AI는 작업자, 초안 작성자, 추출자, 검토 보조자일 수 있지만 최종 승인자가 아니다.
- Risk-based Model Routing은 task type, risk tier, data sensitivity, budget, reviewer independence, region restriction에 따라 결정된다.
- prompt-injection guard, secret redaction, output destination policy가 필요하다.

확장 제안:

- 모든 AI output은 evidence class, model route, data sensitivity, confidence, verification status를 가진다.
- model upgrade는 compatibility review와 rollback model 없이 production route로 승격하지 않는다.

### 3.5 Agent Constitution

사양명세서 근거:

- engine role은 primary developer, draft generator, extractor, deterministic validator, independent reviewer, evidence observer, operator assistant, local advisory model로 분리된다.
- worker 자기 승인, reviewer source mutation, local advisory final approval, dry-run actual write 계산은 금지된다.

확장 제안:

- Agent Work Contract는 scope, allowed sources, blocked sources, output contract, Verification Contract, budget, stop condition, escalation rule을 필수로 가진다.
- agent run은 Execution Ledger에 route, input refs, output refs, tool invocations, budget usage를 남긴다.

### 3.6 Verification Constitution

사양명세서 근거:

- validation chain, independent review receipt, human gate, release gate가 필요하다.
- completed claim은 evidence 없이 PASS가 될 수 없다.
- Review/Gate Service는 review packet, receipt, finding, human gate, closeout을 관리한다.

확장 제안:

- 모든 Testable Unit of Work는 Verification Contract와 최소 1개 이상의 Verification Case를 가져야 한다.
- Completion Gate는 자동 검증, 수동 검토, audit impact가 분리되어야 한다.

### 3.7 Release Constitution

사양명세서 근거:

- release candidate, checklist, migration readiness, rollback plan, incident runbook, signed provenance, SBOM, post-deploy validation이 필요하다.
- production deploy는 protected action이다.

확장 제안:

- release는 Delivery Breakdown Structure의 Release ID와 연결되어야 한다.
- production readiness는 independent review coverage와 unresolved finding count를 포함해야 한다.

### 3.8 Ledger Constitution

사양명세서 근거:

- audit event, trust debt ledger, token/cost ledger, tool invocation ledger, technical debt ledger, evidence coverage가 필요하다.

정규 Ledger:

- Decision Ledger: goal, plan amendment, gate decision, finding disposition, release decision 기록
- Execution Ledger: workflow run, Agent Work Contract execution, tool invocation, connector sync, verification run 기록
- Learning Ledger: user correction, review finding pattern, validation failure, prompt-injection signal, stale source incident 기록

확장 제안:

- 모든 ledger record는 source ref, actor ref, authority class, timestamp, impact scope를 가져야 한다.

## 4. 전체 피라미드 구조도

### 4.1 표 구조

| Level | 명칭 | Hermes 해석 | 산출물 |
|---|---|---|---|
| L0 | Product North Star | Hermes가 해결하는 최상위 문제와 존재 이유 | North Star statement |
| L1 | Product Constitution | 제품, 데이터, 보안, AI, agent, verification, release, ledger 원칙 | Constitution 문서 |
| L2 | Product Pillar | 장기 SaaS를 구성하는 큰 제품 축 | Pillar registry |
| L3 | Domain | Pillar 내부 업무·기능 영역 | Domain map |
| L4 | Core Object / Policy / State Model | 객체, 권한, 상태, 정책, 이벤트 | model catalog |
| L5 | Module | 기능 묶음 또는 서비스 단위 | module spec |
| L6 | Capability | 시스템이 제공해야 하는 능력 | capability contract |
| L7 | Feature | 사용자 또는 시스템이 체감하는 기능 | feature candidate |
| L8 | Epic | 여러 Story를 묶는 개발 단위 | epic brief |
| L9 | User Story / System Story | 사용자 행위 또는 시스템 요구 | story card |
| L10 | Technical Task | 개발자가 수행하는 기술 작업 | task plan |
| L11 | Testable Unit of Work | 독립 구현·검증 가능한 최소 실행 단위 | TUW spec |
| L12 | Verification Case | 완료 여부를 판단하는 자동·수동 검증 항목 | verification case |
| L13 | Ledger Record | Decision, Execution, Learning Ledger 기록 | ledger row |

### 4.2 텍스트 구조도

```text
L0 Product North Star
  -> L1 Product Constitution
    -> L2 Product Pillars
      -> L3 Domains
        -> L4 Core Object / Policy / State Models
          -> L5 Modules
            -> L6 Capabilities
              -> L7 Features
                -> L8 Epics
                  -> L9 User Stories / System Stories
                    -> L10 Technical Tasks
                      -> L11 Testable Units of Work
                        -> L12 Verification Cases
                          -> L13 Ledger Records
```

### 4.3 제품·전달·작업 분해 구조 구분

| 구조 | 목적 | Hermes 적용 |
|---|---|---|
| Product Breakdown Structure | 제품이 무엇으로 구성되는지 정의 | L0-L7 |
| Delivery Breakdown Structure | 어떤 릴리스 순서로 전달할지 정의 | R0-R10 |
| Work Breakdown Structure | 실제 구현 작업을 어떻게 쪼갤지 정의 | L8-L13 |

## 5. L2 Product Pillar 전체 구조

| Pillar ID | Product Pillar 명칭 | 설명 | 사양명세서상 근거 | 주요 Domain | TUW 우선순위 | 위험도 | 선행 Pillar | 명시 여부 | 추가 확인 |
|---|---|---|---|---|---|---|---|---|---|
| P01 | Workspace and Identity Foundation | tenant, workspace, user, role, policy 기반 | 4.1, 9.1, 7.1-7.3 | Tenant, Workspace, Identity, Policy | 1 | High | 없음 | 명시 | data residency 우선순위 |
| P02 | Core Work Control Plane | goal, plan, Agent Work Contract, workflow run | 4.3, 4.4, 7.4-7.5 | Goal, Plan, Loop, State | 1 | High | P01 | 명시 | cloud/local source of truth |
| P03 | Evidence and Resource OS | resource, source span, evidence, claim binding | 4.5, 4.6, 7.8 | Resource, Evidence, Quarantine | 1 | High | P01, P02 | 명시 | evidence confidence scoring |
| P04 | Review, Gate, Verification Plane | review, finding, human gate, Completion Gate | 4.8, 7.6-7.7, 13.1 | Review, Finding, Gate, Verification | 1 | High | P01-P03 | 명시 | independent review evidence provider |
| P05 | Domain Pack Platform | domain pack registry, SDK, marketplace | 4.2, 4.14, 5.x | Pack Registry, SDK, Marketplace | 2 | Medium | P01-P04 | 명시 | marketplace timing |
| P06 | Connector Governance | read-only ingestion, sync, auth, write maturity | 4.6, 6.2, 12.4 | Connector, Sync, Consent, Write Gate | 2 | High | P01-P04 | 명시 | first connector set |
| P07 | Operational Knowledge Base | grounded recall, fact store, source-cited recall | 4.7, 14.3 | Knowledge, Recall, Conflict | 3 | Medium | P01-P04 | 명시 | raw transcript policy |
| P08 | Agent Runtime Governance | engine/model/tool route, sandbox, budget | 4.9, 8.x | Engine, Model, Tool, Budget | 2 | High | P01-P04 | 명시 | first execution class |
| P09 | Operator Console and Collaboration | cockpit, queue, notification, external portal | 4.10, 4.11, 11.x | UI, Queue, Collaboration | 2 | Medium | P01-P04 | 명시 | first UI density baseline |
| P10 | Reporting, Analytics, Trust Ledger | portfolio, metrics, trust debt, cost | 4.12, 15.x | Analytics, Trust, Cost | 3 | Medium | P01-P04 | 명시 | trust metric display rules |
| P11 | Admin, Security, Compliance, Billing | enterprise admin, compliance, billing | 4.13, 9.x, 13.x | Admin, Security, Compliance, Billing | 2 | High | P01 | 명시 | billing provider |
| P12 | Release and Production Governance | release candidate, provenance, rollback | 4.15, 13.1, 14.5 | Release, Deploy, Incident | 3 | High | P01-P04, P08 | 명시 | deployment model |
| P13 | Enterprise Scale and Reliability | performance, DR, observability, i18n | 10.x | Performance, Reliability, Observability, i18n | 4 | High | P01-P12 | 명시 | SLO tier detail |

## 6. 각 Product Pillar별 상세 계층 구조

### 6.1 P01 Workspace and Identity Foundation

| L3 Domain | L5 Module | L6 Capability | L7 Feature 후보 | 근거 |
|---|---|---|---|---|
| Tenant | Tenant Registry | tenant 생성/상태 관리 | tenant settings | 4.1, 7.1 |
| Workspace | Workspace Registry | workspace 생성/분리 | workspace switcher | 4.1, 7.2 |
| Identity | User and Team Management | user/team/service account 관리 | member admin | 4.1 |
| Policy | RBAC/ABAC Engine | 역할·속성 기반 권한 | role editor, policy preview | 4.1, 9.1 |
| Data Region | Region Policy | data residency 설정 | region selector | 4.1, 4.13 |
| Retention | Retention Policy | workspace/project retention | retention admin | 4.1, 13.3 |

### 6.2 P02 Core Work Control Plane

| L3 Domain | L5 Module | L6 Capability | L7 Feature 후보 | 근거 |
|---|---|---|---|---|
| Goal | Goal Registry | goal 생성/수정/block/close | goal detail | 4.3 |
| Plan | Phase Plan Engine | phase plan과 amendment 기록 | plan editor | 4.3 |
| Agent Work Contract | Contract Builder | scope, source, outputs, stop condition 구성 | contract preview | 4.3 |
| Workflow | Loop Engine | bounded DAG, retry, wait state | workflow graph | 4.4 |
| State | State Projection | blocked, waiting, completed candidate 표시 | next allowed action panel | 4.4 |
| Dependency | Execution Dependency Graph | dependency/block/conflict/verification edge 관리 | dependency map | 4.4, prompt requirement |

### 6.3 P03 Evidence and Resource OS

| L3 Domain | L5 Module | L6 Capability | L7 Feature 후보 | 근거 |
|---|---|---|---|---|
| Resource | Resource Registry | resource/version 관리 | resource detail | 4.5 |
| Source Span | Source Span Store | 원문 위치 추적 | span highlighter | 4.5, 11.4 |
| Evidence | Evidence Item Store | claim-evidence binding | evidence card | 4.5 |
| Quality | Evidence Quality | confidence, freshness, conflict | evidence risk badge | 4.5, 4.12 |
| Quarantine | Quarantine Queue | secret/unsupported/suspicious source 격리 | quarantine review | 4.6, 12.4 |
| Export | Evidence Export Bundle | 감사/공유용 evidence 묶음 | export action | 4.5, 4.13 |

### 6.4 P04 Review, Gate, Verification Plane

| L3 Domain | L5 Module | L6 Capability | L7 Feature 후보 | 근거 |
|---|---|---|---|---|
| Review | Review Packet Builder | review scope와 evidence 조립 | review packet preview | 4.8 |
| Receipt | Review Receipt Capture | raw/normalized receipt 관리 | receipt detail | 4.8, 7.6 |
| Finding | Finding Lifecycle | severity, owner, disposition | finding board | 4.8 |
| Human Gate | Human Gate Inbox | approve/reject/request changes | gate decision UI | 4.8, 11.6 |
| Verification | Verification Contract Registry | TUW/Release 검증 계약 | verification panel | 4.15 |
| Completion | Completion Gate | evidence, review, human gate 결합 | completion gate status | 4.8, 13.1 |

### 6.5 P05 Domain Pack Platform

| L3 Domain | L5 Module | L6 Capability | L7 Feature 후보 | 근거 |
|---|---|---|---|---|
| Pack Registry | Domain Pack Registry | pack 등록/version/lifecycle | pack catalog | 4.2 |
| SDK | Domain Pack SDK | schema/workflow/validator/UI panel 확장 | SDK docs | 4.14 |
| Compatibility | Compatibility Validator | pack dependency와 platform version 검증 | compatibility report | 4.2, 4.14 |
| Marketplace | Marketplace Governance | submission, signing, install receipt | marketplace listing | 4.14 |
| Pack Policy | Pack Permission Manifest | pack 권한과 data boundary | permission review | 4.14 |
| Domain Packs | Core Pack Suite | personal-dev, law-firm, creative-document 등 | pack workspace | 5.x |

### 6.6 P06 Connector Governance

| L3 Domain | L5 Module | L6 Capability | L7 Feature 후보 | 근거 |
|---|---|---|---|---|
| Connector Registry | Connector Catalog | connector type과 capability 관리 | connector health center | 4.6 |
| Auth | Consent and Auth Status | consent receipt, auth expiry | auth status card | 4.6 |
| Sync | Ingestion Pipeline | backfill, incremental sync, retry | sync run detail | 4.6, 12.4 |
| Classification | Resource Classifier | file/source classification | classification queue | 4.6 |
| Safety | Ingestion Guard | secret/prompt-injection/unsupported 처리 | risk flags | 4.6, 8.3 |
| Write Maturity | Connector Write Gate | dry-run, target lock, rollback | write preview | 4.6 |

### 6.7 P07 Operational Knowledge Base

| L3 Domain | L5 Module | L6 Capability | L7 Feature 후보 | 근거 |
|---|---|---|---|---|
| Fact Store | Extracted Fact Store | source-cited fact 저장 | fact detail | 4.7 |
| Recall | Scoped Recall Engine | project/workspace/domain recall | recall bundle | 4.7 |
| Conflict | Conflict Detector | stale/conflicting fact 표시 | conflict alert | 4.7 |
| Correction | User Correction Promotion | correction을 rule 후보로 승격 | correction queue | 4.7 |
| Governance | Knowledge Review Queue | review status와 deletion/export | knowledge review | 4.7 |

### 6.8 P08 Agent Runtime Governance

| L3 Domain | L5 Module | L6 Capability | L7 Feature 후보 | 근거 |
|---|---|---|---|---|
| Engine | Engine Registry | engine role과 authority 분리 | engine admin | 4.9 |
| Model | Risk-based Model Routing | risk/data/budget 기반 route | route decision detail | 8.1 |
| Tool | Tool Registry | tool allowlist와 policy | tool policy matrix | 4.9 |
| Runtime | Runtime Adapter | sandbox, timeout, replay | runtime run detail | 4.9 |
| Budget | Cost Ledger | token/cost budget 관리 | budget center | 4.9, 8.4 |
| Safety | Output Destination Policy | 출력 목적지와 protected action guard | destination warning | 4.9 |

### 6.9 P09 Operator Console and Collaboration

| L3 Domain | L5 Module | L6 Capability | L7 Feature 후보 | 근거 |
|---|---|---|---|---|
| Command Center | Home Dashboard | 오늘의 pending gates/reviews/blockers | home | 11.2 |
| Project Cockpit | Project Cockpit | plan/evidence/review/gate tabs | project cockpit | 11.3 |
| Boards | Work Queue Views | Agent Work Contract, finding, gate queue | work board | 4.10 |
| Collaboration | Comment and Assignment | mention, comments, assignment | decision thread | 4.11 |
| Notification | Notification Service | email/Slack/Teams digest | notification settings | 4.11 |
| External Portal | Reviewer/Client Portal | 제한 공유 packet | external viewer | 4.11 |

### 6.10 P10 Reporting, Analytics, Trust Ledger

| L3 Domain | L5 Module | L6 Capability | L7 Feature 후보 | 근거 |
|---|---|---|---|---|
| Portfolio | Portfolio Reporting | cross-project status | portfolio dashboard | 4.12 |
| Quality | Quality Analytics | validation pass, finding density | quality report | 15.2 |
| Trust | Trust Debt Ledger | source/review/gate debt 표시 | trust ledger | 4.12 |
| Cost | Cost Analytics | model/token/connector usage | cost dashboard | 4.12 |
| Compliance | Compliance Export | compliance evidence export | audit export | 4.12, 4.13 |
| Brief | Executive/Client Brief | human-reviewable status brief | brief builder | 4.12 |

### 6.11 P11 Admin, Security, Compliance, Billing

| L3 Domain | L5 Module | L6 Capability | L7 Feature 후보 | 근거 |
|---|---|---|---|---|
| Admin | Admin Console | tenant/workspace/user 관리 | admin console | 4.13 |
| Security | Security Controls | SSO, SCIM, MFA, IP/device policy | security settings | 4.13 |
| Compliance | Compliance Evidence | SOC2/ISO/GDPR readiness | compliance center | 4.13 |
| Retention | Retention and Legal Hold | legal hold, deletion proof | retention workflow | 13.3 |
| Incident | Incident Workflow | severity, mitigation, closeout review | incident board | 13.2 |
| Billing | Billing and Metering | seats, usage, invoices | billing page | 4.13 |

### 6.12 P12 Release and Production Governance

| L3 Domain | L5 Module | L6 Capability | L7 Feature 후보 | 근거 |
|---|---|---|---|---|
| Release | Release Candidate | included changes, checklist | release cockpit | 4.15, 13.1 |
| Provenance | Signed Provenance | SBOM, dependency audit | provenance panel | 4.15 |
| Migration | Migration Readiness | migration plan and validation | migration checklist | 4.15 |
| Rollback | Rollback Plan | rollback binding | rollback preview | 4.15 |
| Deploy | Deployment Approval | production gate and post-deploy validation | deploy gate | 4.15 |
| Support | Support Readiness | customer impact and support plan | release note/support packet | 4.15 |

### 6.13 P13 Enterprise Scale and Reliability

| L3 Domain | L5 Module | L6 Capability | L7 Feature 후보 | 근거 |
|---|---|---|---|---|
| Performance | Performance Budget | p95 target 관리 | performance report | 10.1 |
| Reliability | Resilience Controls | retry, DLQ, backup, DR | reliability cockpit | 10.2 |
| Observability | Observability Catalog | API, queue, connector, cost metrics | observability dashboard | 10.3 |
| Accessibility | Accessibility System | WCAG, keyboard, contrast | accessibility audit | 10.4 |
| i18n | Internationalization | Korean/English, timezone, locale | locale settings | 10.5 |
| Scale | Enterprise Scale Plan | tenant/project/resource/event scale | capacity plan | 10.1 |

## 7. Core Object / Policy / State Model

### 7.1 Core Object Model

명시 객체:

| 객체 | 계층 | 설명 |
|---|---|---|
| Tenant | P01 | 조직 또는 개인 tenant |
| Workspace | P01 | tenant 내부 작업 공간 |
| Project | P01/P02 | 제품, repo, 업무, 장기 목표 단위 |
| Domain Pack | P05 | 업무 모듈 |
| Workflow Definition | P02 | 반복 가능한 업무 흐름 계약 |
| Workflow Run | P02 | 특정 실행 또는 재계산 instance |
| Goal | P02 | 사람이 지정한 목표 |
| Plan | P02 | phase plan 또는 실행 계획 |
| Agent Work Contract | P02 | bounded 작업 단위와 실행 계약 |
| Resource | P03/P06 | 원본 자료 또는 연결 객체 |
| Resource Version | P03/P06 | 자료 버전 |
| Source Span | P03 | evidence가 가리키는 원문 위치 |
| Evidence Item | P03 | claim을 뒷받침하는 증거 |
| Artifact | P03/P09/P12 | 문서, patch, report, dashboard |
| Review Receipt | P04 | review event와 raw/normalized receipt |
| Finding | P04 | review/validator 문제 항목 |
| Gate Result | P04 | 승인, 차단, readiness, policy gate |
| Receipt | P04/P06/P12 | 사람/외부/시스템 확인 기록 |
| Audit Event | P10/P11 | append-only 감사 event |

추론 가능한 객체:

- Connector Sync Run
- Model Route Decision
- Tool Invocation
- Budget Decision
- Protected Action Request
- Release Candidate
- Incident
- Billing Usage Record
- Domain Pack Install Receipt

추가 확인 필요:

- `matter_id` 같은 domain-specific ID가 공통 Project 하위 subtype으로만 남을지, 별도 root object가 될지
- Agent Work Contract의 저장 위치가 workflow run 하위인지 plan 하위인지

### 7.2 Relationship Model

핵심 관계:

```text
Tenant
  -> Workspace
    -> Project
      -> Domain Pack Installation
      -> Goal
        -> Plan
          -> Agent Work Contract
            -> Workflow Run
              -> Artifact
              -> Evidence Item
              -> Review Receipt
              -> Finding
              -> Gate Result
      -> Resource
        -> Resource Version
          -> Source Span
            -> Evidence Item
      -> Audit Event
```

확장 제안:

- 모든 relationship은 tenant/workspace/project boundary를 검증해야 한다.
- cross-project relationship은 explicit link object와 permission projection을 요구한다.

### 7.3 State Model

명시 상태:

Workflow Run:

- created
- planned
- ready
- running
- waiting_for_source
- waiting_for_human
- waiting_for_review
- blocked
- failed
- completed_candidate
- closed
- archived

Evidence:

- candidate
- needs_review
- approved
- rejected
- stale
- conflicted
- quarantined
- redacted

Finding:

- open
- acknowledged
- needs_remediation
- remediation_candidate
- ready_for_re_review
- verified_fixed
- accepted_risk
- deferred
- false_positive
- closed

Human Gate:

- approve
- reject
- request changes
- approve with risk
- defer
- escalate
- require independent review

추론 가능한 상태:

- Connector Sync: configured, authorized, syncing, degraded, auth_expired, blocked, disabled
- Release Candidate: draft, validation_pending, review_pending, gate_waiting, ready_candidate, blocked, released, rolled_back
- Protected Action: requested, previewed, approval_waiting, approved, denied, executed, post_validation_failed, closed

### 7.4 Permission Model

명시 권한 축:

- tenant
- workspace
- project
- domain pack
- resource
- resource version
- evidence item
- artifact
- workflow run
- action class
- data classification
- user role
- user attribute
- device/session

명시 role:

- owner
- admin
- operator
- contributor
- reviewer
- approver
- auditor
- external_viewer

확장 제안:

- permission decision은 `policy_snapshot_ref`를 남겨야 한다.
- external_viewer는 time-bound, artifact-bound, redaction-bound 권한을 기본으로 한다.

### 7.5 Audit Event Model

명시 필드:

- audit_event_id
- tenant_id
- workspace_id
- project_id
- actor_ref
- event_type
- target_ref
- before_hash
- after_hash
- metadata
- created_at
- request_id
- ip_or_device_ref

확장 제안:

- ledger category: decision, execution, learning
- authority class: read, write_candidate, protected_request, approved_action, denied_action
- evidence impact: none, creates_evidence, mutates_projection, protected_output

### 7.6 Data Lifecycle Model

명시/추론 상태:

```text
discovered
  -> queued
    -> ingested
      -> classified
        -> normalized
          -> indexed
            -> extracted
              -> evidence_candidate
                -> needs_review
                  -> approved | rejected | stale | conflicted
```

분기:

- quarantined
- failed
- skipped_duplicate
- redacted
- archived
- legal_hold
- deletion_requested
- deletion_proofed

### 7.7 AI Policy Model

명시 기준:

- task type
- risk tier
- data sensitivity
- required context length
- budget ceiling
- latency target
- reviewer independence
- model capability
- customer policy
- region restriction

Model Routing 결과:

- allow
- downgrade
- require approval
- require reviewer
- block
- route to private model

### 7.8 External Sharing Model

명시 항목:

- external reviewer portal
- client-safe packet sharing
- audit export
- compliance evidence export
- data export protected action

추가 확인 필요:

- external portal의 identity 방식
- client-safe packet의 redaction rule
- 공유 만료와 revoke 정책

### 7.9 Billing / Subscription Model

명시 과금 축:

- seats
- workspaces
- domain packs
- connector volume
- storage
- model usage
- workflow runs
- evidence indexing
- enterprise security add-ons
- private deployment
- premium reviewer lanes

추가 확인 필요:

- free/pro/team/business/enterprise plan 경계
- overage 처리
- model usage margin policy

### 7.10 Admin / Tenant Model

명시 항목:

- tenant 생성
- workspace 생성
- organization/team/user/service account 관리
- data residency
- customer-managed encryption key
- retention policy
- SSO/SCIM/MFA
- audit export

확장 제안:

- admin action도 protected action subset으로 관리한다.
- tenant bootstrap은 최소 하나의 owner, default workspace, default policy set, billing placeholder를 만든다.

## 8. Delivery Breakdown Structure

| Release ID | 목적 | 포함 Pillar | 포함 Domain | 핵심 기능 | 선행 Release | 위험도 | Release Gate | 제외할 항목 | 추가 확인 |
|---|---|---|---|---|---|---|---|---|---|
| R0 Foundation | local harness와 개발 운영체계 기반 | P01-P04 | core IDs, ledger, verification | schema, docs, validation, static projection | 없음 | High | Core contracts verified | connector write, AI execution | local/cloud 우선순위 |
| R1 Core Object | tenant/workspace/project/domain/workflow 객체 | P01, P02 | Tenant, Workspace, Project, Goal | object model, state model, permission base | R0 | High | object CRUD and audit verified | marketplace, enterprise billing | source of truth |
| R2 Core Workflow | goal-plan-Agent Work Contract-loop | P02, P04 | Goal, Plan, Workflow, Gate | loop state, dependency, Completion Gate | R1 | High | workflow run state verified | controlled execution | DAG persistence |
| R3 Data / Collaboration / Workflow | resource/evidence/review UI와 collaboration | P03, P04, P09 | Evidence, Review, UI, Notification | evidence viewer, review queue, comments, digest | R2 | Medium | evidence and review flows verified | enterprise analytics | collaboration depth |
| R4 Search / Knowledge | Operational Knowledge Base와 search | P03, P07, P10 | Search, Recall, Conflict | source-cited recall, freshness, conflict | R3 | Medium | scoped retrieval verified | raw transcript exposure | vector provider |
| R5 Automation | connector read-only automation과 workflow automation | P06, P02 | Connector, Sync, Backfill | read-only ingestion, quarantine, retry | R3 | High | connector sync verified | write connector | first connector set |
| R6 AI Layer | Risk-based Model Routing과 agent runtime governance | P08, P04 | Model, Tool, Runtime, Budget | model route, tool policy, budget, prompt guard | R2-R5 | High | AI route and safety verified | autonomous execution | allowed models |
| R7 Governance / Admin | admin, security, compliance, billing | P11, P10 | Admin, Security, Compliance, Billing | SSO/SCIM, audit export, billing usage | R1-R6 | High | security baseline verified | private deployment | billing provider |
| R8 Integration | domain pack SDK, marketplace, partner connectors | P05, P06 | SDK, Marketplace, Connector | pack manifest, compatibility, install receipt | R5-R7 | Medium | compatibility verified | open public marketplace | certification process |
| R9 Enterprise Hardening | enterprise scale, reliability, compliance | P11, P13 | Reliability, Observability, Data Residency | DR, observability, DLP, CMK | R7-R8 | High | enterprise readiness gate | broad controlled execution | SLO tiers |
| R10 Scale & Optimization | production scale, controlled execution, ecosystem | P12, P13, P05 | Release, Production, Scale, Ecosystem | release governance, write maturity, scale optimization | R9 | High | production governance gate | unbounded automation | first protected action class |

## 9. Execution Dependency Graph 설계 원칙

### 9.1 Edge Types

| Edge | 의미 | Hermes 예시 |
|---|---|---|
| Dependency Edge | 선행 산출물이 있어야 후행 작업 가능 | Tenant object before Project object |
| Blocking Edge | blocker 해소 전 진행 금지 | unresolved critical finding blocks Completion Gate |
| Parallel Edge | 독립 병렬 진행 가능 | UI shell and audit event schema after core IDs |
| Conflict Edge | 정책/용어/상태 충돌 조정 필요 | connector write before write maturity gate |
| Verification Edge | 검증 결과가 후속 상태를 결정 | Verification Case passes before gate candidate |
| Regression Edge | 기존 동작 보존 검증 필요 | evidence state migration requires regression check |
| Escalation Edge | 위험도 상승 시 higher authority 필요 | protected action requires approver |
| Feedback Edge | review/user correction이 plan으로 되돌아감 | finding creates remediation Agent Work Contract |
| Loop Edge | bounded loop 반복 | re-review after remediation candidate |

### 9.2 먼저 만들어야 할 선행 Node

선행 Node:

- Tenant, Workspace, Project core IDs
- Domain Pack ID and installation boundary
- Goal, Plan, Agent Work Contract object
- Workflow Definition and Workflow Run state
- Audit Event base model
- Permission and data classification model
- Evidence Item and Source Span base model
- Review Receipt, Finding, Gate Result base model
- Verification Contract and Verification Case registry

이유:

- 모든 후속 기능이 stable ID, boundary, audit, verification에 의존한다.
- connector, AI, UI, marketplace, release governance는 core object와 authority model 없이 구현하면 overclaim 또는 data leakage 위험이 커진다.

### 9.3 나중에 만들어야 할 후행 Node

후행 Node:

- connector write maturity
- controlled execution
- production deploy gate
- public marketplace
- private deployment automation
- advanced enterprise analytics
- premium reviewer lanes
- third-party pack certification

이유:

- write/protected action은 evidence, review, permission, audit, rollback, post-validation이 모두 안정화된 뒤 열어야 한다.
- marketplace는 pack sandbox와 permission manifest, compatibility validator가 선행되어야 한다.

## 10. TUW 작성 요청을 위한 분할 방식

### 10.1 Pillar 단위 요청

템플릿:

```text
Hermes SaaS 장기개발 피라미드 문서 기준으로 [Pillar ID / Pillar 명칭]에 대한 Testable Unit of Work를 만들어줘.
범위는 L3 Domain 전체를 포함하되, Release [R번호]에 들어갈 것만 우선 생성해줘.
각 TUW는 Verification Contract, Verification Case, Completion Gate, Ledger Record를 포함해줘.
```

### 10.2 Domain 단위 요청

템플릿:

```text
Hermes SaaS 장기개발 피라미드 문서 기준으로 [Pillar ID]의 [Domain 명칭] Domain에 대한 Testable Unit of Work를 만들어줘.
L5 Module별로 나누고, 선행 Dependency Edge와 Blocking Edge를 표시해줘.
사양명세서 근거와 추가 확인 필요 항목을 분리해줘.
```

### 10.3 Module 단위 요청

템플릿:

```text
Hermes SaaS 장기개발 피라미드 문서 기준으로 [Pillar ID]-[Domain]-[Module] Module에 대한 Testable Unit of Work를 상세히 만들어줘.
Capability, Feature, Epic, Story, Technical Task, Verification Case까지 내려가되, 실제 구현 순서와 Completion Gate를 포함해줘.
```

## 11. TUW ID 체계

형식:

```text
[Pillar Prefix]-[Domain Code]-[Module Code]-TUW-[번호]
```

번호 규칙:

- 0001부터 4자리 증가
- 하나의 Module 안에서 번호는 단조 증가
- release가 달라도 같은 Module이면 번호를 재사용하지 않는다
- blocked 또는 deprecated TUW도 번호는 보존한다

| Pillar | Prefix | 예시 |
---|---|---|
| P01 Workspace and Identity Foundation | WIF | WIF-TEN-REG-TUW-0001 |
| P02 Core Work Control Plane | CWC | CWC-GOL-REG-TUW-0001 |
| P03 Evidence and Resource OS | ERO | ERO-EVD-STR-TUW-0001 |
| P04 Review, Gate, Verification Plane | RGV | RGV-FND-LFC-TUW-0001 |
| P05 Domain Pack Platform | DPP | DPP-PCK-MNF-TUW-0001 |
| P06 Connector Governance | CNG | CNG-SYN-BCK-TUW-0001 |
| P07 Operational Knowledge Base | OKB | OKB-FCT-STR-TUW-0001 |
| P08 Agent Runtime Governance | ARG | ARG-MDL-RTE-TUW-0001 |
| P09 Operator Console and Collaboration | OCC | OCC-PRJ-CPK-TUW-0001 |
| P10 Reporting, Analytics, Trust Ledger | RAT | RAT-TRS-LDG-TUW-0001 |
| P11 Admin, Security, Compliance, Billing | ASB | ASB-SEC-SSO-TUW-0001 |
| P12 Release and Production Governance | RPG | RPG-REL-CND-TUW-0001 |
| P13 Enterprise Scale and Reliability | ESR | ESR-OBS-MET-TUW-0001 |

추천 Domain Code:

- TEN, WRK, PRJ, IDM, POL
- GOL, PLN, AWC, WFL, DEP
- RES, EVD, SRC, QRT, EXP
- REV, RCP, FND, GTE, VER
- PCK, SDK, CMP, MKT
- CON, AUT, SYN, CLS, WRT
- FCT, RCL, CNF, KRV
- ENG, MDL, TOL, RUN, BGT
- HOM, CPK, QUE, NTF, PRT
- RPT, QLT, TRS, CST
- ADM, SEC, COM, BIL, INC
- REL, PRV, MIG, RLB, DPL
- PRF, RLY, OBS, ACC, I18

## 12. TUW 표준 구조

향후 Testable Unit of Work는 다음 필드를 반드시 포함한다.

| 필드 | 설명 |
|---|---|
| Work ID | `[Pillar Prefix]-[Domain Code]-[Module Code]-TUW-[번호]` |
| Pillar | L2 Product Pillar |
| Domain | L3 Domain |
| Module | L5 Module |
| Capability | L6 Capability |
| Feature | L7 Feature |
| Epic | L8 Epic |
| Story | L9 User Story / System Story |
| Objective | 이 TUW의 목적 |
| User/System Value | 사용자 또는 시스템 가치 |
| Specification Source | 사양명세서 section 또는 pyramid section |
| Inputs | source, object, policy, prior TUW |
| Outputs | artifact, schema, API, UI, ledger row |
| Files to Read | 읽어야 할 파일 |
| Files to Modify | 수정할 파일 |
| Files Not to Modify | 건드리면 안 되는 파일 |
| Dependencies | Dependency Edge, Blocking Edge 등 |
| Risk Level | low, medium, high, critical |
| Model Routing | Risk-based Model Routing 요구 |
| Permission Impact | 권한 영향 |
| Audit Impact | audit/ledger 영향 |
| AI Impact | AI, model, tool, prompt 영향 |
| Security Constraints | 보안 제약 |
| Performance Constraints | 성능 제약 |
| Verification Contract | 완료 판정 계약 |
| Verification Cases | 자동/수동 검증 항목 |
| Loop Budget | retry, time, token/cost ceiling |
| Stop Condition | 중단 조건 |
| Escalation Rule | escalation 조건과 대상 |
| Completion Gate | 완료 gate |

## 13. TUW 생성 우선순위 로드맵

### 13.1 1순위: 개발 운영체계와 기반

대상:

- P01 Workspace and Identity Foundation
- P02 Core Work Control Plane
- P04 Verification base

이유:

- 모든 TUW가 stable ID, permission, audit, Verification Contract에 의존한다.

### 13.2 2순위: Core Object와 권한

대상:

- Tenant, Workspace, Project, Domain Pack, Goal, Plan, Agent Work Contract
- RBAC/ABAC, data classification, protected action class
- Audit Event

### 13.3 3순위: 핵심 사용자 workflow

대상:

- project cockpit
- goal-plan-workflow
- evidence viewer
- review queue
- finding loop
- human gate inbox

### 13.4 4순위: 데이터 저장·검색·감사로그

대상:

- Resource, Source Span, Evidence Item
- Operational Knowledge Base
- Search and scoped retrieval
- Decision Ledger, Execution Ledger, Learning Ledger

### 13.5 5순위: AI 또는 자동화 기능

대상:

- Risk-based Model Routing
- tool policy
- prompt-injection guard
- budget ledger
- dry-run simulation

주의:

- AI 기능은 core verification과 permission 없이 먼저 열지 않는다.

### 13.6 6순위: 외부공유·연동

대상:

- read-only connectors
- external reviewer portal
- client-safe packet
- webhook and export API

주의:

- connector write는 후순위다.

### 13.7 7순위: 관리자·분석·엔터프라이즈 기능

대상:

- SSO, SCIM, DLP, CMK
- compliance export
- billing
- trust ledger
- reliability and observability
- private deployment

## 14. 최종 요청 목차

### Part 0. Operating System Baseline

0.1 Product Constitution registry
0.2 TUW schema and ID registry
0.3 Verification Contract template
0.4 Ledger Record template
0.5 Execution Dependency Graph conventions

### Part 1. Workspace and Identity Foundation

1.1 Tenant object and lifecycle
1.2 Workspace object and lifecycle
1.3 Project object and lifecycle
1.4 User/team/service account
1.5 RBAC/ABAC base
1.6 Data classification policy
1.7 Audit Event base

### Part 2. Core Work Control Plane

2.1 Goal registry
2.2 Plan and amendment model
2.3 Agent Work Contract model
2.4 Workflow definition
2.5 Workflow run state machine
2.6 Execution Dependency Graph
2.7 next allowed action projection

### Part 3. Evidence and Resource OS

3.1 Resource registry
3.2 Resource version model
3.3 Source span store
3.4 Evidence item store
3.5 Evidence state model
3.6 Evidence viewer contract
3.7 Quarantine queue
3.8 Evidence export bundle

### Part 4. Review, Finding, Verification, Gate Plane

4.1 Review packet builder
4.2 Review receipt capture
4.3 Finding lifecycle
4.4 Human gate inbox
4.5 Verification Contract registry
4.6 Verification Case runner
4.7 Completion Gate

### Part 5. Operator Console and Collaboration

5.1 Home command center
5.2 Project cockpit
5.3 Work queue boards
5.4 Evidence/review/gate drill-down
5.5 Comments and assignment
5.6 Notifications and digest
5.7 External portal base

### Part 6. Connector Governance

6.1 Connector registry
6.2 Consent receipt and auth status
6.3 Backfill and incremental sync
6.4 Resource classifier
6.5 Secret and prompt-injection guard
6.6 Connector health center
6.7 Connector write maturity candidate

### Part 7. Operational Knowledge Base

7.1 Extracted fact store
7.2 Source-cited recall
7.3 Freshness and stale detection
7.4 Conflict detection
7.5 User correction promotion
7.6 Knowledge review queue

### Part 8. Agent Runtime Governance

8.1 Engine registry
8.2 Risk-based Model Routing
8.3 Tool registry and command allowlist
8.4 Sandbox and timeout policy
8.5 Token/cost ledger
8.6 Runtime replay
8.7 Output destination policy

### Part 9. Domain Pack Platform

9.1 Domain pack manifest
9.2 Pack lifecycle
9.3 Compatibility validator
9.4 Domain pack SDK
9.5 UI panel SDK
9.6 Marketplace submission review
9.7 Pack permission manifest

### Part 10. Core Domain Packs

10.1 personal-dev pack
10.2 law-firm pack
10.3 creative-document pack
10.4 connectors-resource pack
10.5 product-ops pack
10.6 support-ops pack
10.7 compliance-ops pack

### Part 11. Admin, Security, Compliance, Billing

11.1 Admin console
11.2 SSO/SCIM/MFA
11.3 API key and service account
11.4 DLP and redaction
11.5 Retention and legal hold
11.6 Incident workflow
11.7 Billing and usage metering

### Part 12. Reporting, Analytics, Trust Ledger

12.1 Portfolio reporting
12.2 Quality analytics
12.3 Trust debt ledger
12.4 Cost analytics
12.5 Compliance evidence export
12.6 Executive and client-safe brief

### Part 13. Release and Production Governance

13.1 Release candidate
13.2 Release checklist
13.3 Migration readiness
13.4 Rollback plan
13.5 Signed provenance and SBOM
13.6 Deployment approval gate
13.7 Post-deploy validation

### Part 14. Enterprise Scale and Reliability

14.1 Performance targets
14.2 Reliability and DR
14.3 Observability metrics
14.4 Accessibility
14.5 Internationalization
14.6 Enterprise capacity plan

### Part 15. Controlled Execution and Ecosystem Maturity

15.1 Write action manifest
15.2 Dry-run preview
15.3 Receipt-gated apply
15.4 Connector write maturity
15.5 Third-party marketplace certification
15.6 Private deployment packaging

## 15. 사양명세서 보완 필요사항

### 15.1 누락된 것으로 보이는 영역

확장 제안:

- Data migration strategy for local-to-cloud transition
- Customer onboarding success workflow
- Public API rate limit and quota model
- Backup restore self-service UX
- Enterprise procurement/security review packet
- Support operations for Hermes itself
- Product telemetry privacy policy

### 15.2 기능 간 선후관계가 불명확한 영역

추가 확인 필요:

- Operational Knowledge Base를 connector ingestion 전후 어느 시점에 first-class로 열지
- domain pack marketplace와 SDK 중 무엇을 먼저 공개할지
- billing을 Team SaaS 초기에 열지, Business Work OS 단계로 늦출지
- controlled execution이 Release Governance 전인지 후인지

### 15.3 Core Object 정의가 필요한 영역

추가 확인 필요:

- Agent Work Contract의 canonical schema
- Protected Action Request schema
- Model Route Decision schema
- Tool Invocation schema
- Connector Sync Run schema
- Release Candidate schema
- Incident schema
- Billing Usage Record schema

### 15.4 권한·보안 정의가 부족한 영역

추가 확인 필요:

- external_viewer의 세부 권한
- domain pack별 permission manifest enforcement
- customer-managed key failure mode
- DLP false positive handling
- cross-workspace sharing policy
- break-glass admin policy

### 15.5 AI 기능의 접근통제 또는 검증 기준이 부족한 영역

추가 확인 필요:

- AI output confidence와 evidence coverage의 최소 기준
- model vendor별 data retention policy binding
- private model route 선택 기준
- prompt-injection finding severity
- AI-generated artifact의 human review requirement matrix

### 15.6 외부연동 범위가 불명확한 영역

추가 확인 필요:

- 첫 read-only connector set
- connector별 sync frequency
- OAuth consent UX
- connector-specific data classification
- webhook authentication
- VDR/DMS privileged source handling

### 15.7 릴리스 순서상 재검토가 필요한 영역

추가 확인 필요:

- R6 AI Layer가 R5 connector보다 먼저 필요한 first use case가 있는지
- R7 billing을 R1-R3 중 어느 시점에 최소 구현해야 하는지
- R10 controlled execution 일부를 internal-only로 R6/R7에 당겨도 되는지
- private deployment를 R9 이전에 enterprise pilot용으로 제공해야 하는지

### 15.8 TUW 생성 전에 반드시 확정해야 할 질문

1. 첫 상용 대상은 personal-dev, regulated operations, multi-domain Work OS 중 무엇인가?
2. 첫 배포 모델은 Local Harness, Cloud SaaS, Hybrid 중 무엇인가?
3. first-class operational store는 Postgres/event-store인가, local artifact compatibility와 동등한가?
4. 첫 connector 3개는 무엇인가?
5. 첫 domain pack은 personal-dev 하나인가, personal-dev와 connectors-resource 동시인가?
6. Agent Work Contract의 canonical schema는 기존 `work_packet_id` 계열을 유지하는가?
7. human gate의 서명/인증 강도는 어느 수준부터 시작하는가?
8. independent review evidence는 Claude receipt만으로 시작하는가, GitHub/CI evidence도 같은 단계에 포함하는가?
9. billing은 usage metering만 먼저 만들 것인가, 실제 payment까지 포함할 것인가?
10. controlled execution의 첫 protected action class는 무엇인가?
