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
