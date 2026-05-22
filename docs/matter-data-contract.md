# Matter Data Contract

이 문서는 로펌용 Hermes harness가 사건을 어떻게 기억해야 하는지 정한 계약입니다. 실제 배포에서는 기존 DMS, ERP, 메신저, 캘린더가 이 계약의 일부 필드만 제공하더라도, harness 내부에서는 이 형태로 정규화합니다.

## 원칙

- 모든 데이터는 `matter_id`를 기준으로 격리합니다.
- 원문 source와 AI 산출물을 분리합니다.
- 외부 발송 가능 여부는 matter-level policy로 결정합니다.
- 업무 후보와 확정 업무를 구분합니다.
- 법률 결론은 항상 reviewer, source, citation 상태를 가집니다.

## 필수 블록

### `matter_profile`

사건의 운영상 경계입니다.

- `jurisdiction`: 대한민국, Delaware, Singapore 등
- `responsible_partner`: 최종 책임 파트너
- `matter_stage`: intake, diligence, signing, closing, pleadings, discovery 등
- `client_ai_consent`: AI 사용 동의 상태
- `conflict_screen`: 이해상충 확인 상태
- `external_output_policy`: 외부 발송 제한 메모

### `confidentiality`

비밀성과 데이터 처리 정책입니다.

- `level`: public, internal, client-confidential, privileged, restricted
- `human_approval_required`: 로펌 harness에서는 기본적으로 true
- `export_allowed`: 외부 시스템 export 가능 여부
- `allowed_systems`: 허용된 시스템
- `prohibited_systems`: 금지된 시스템
- `retention`: 보존 정책

### `source_register`

Hermes가 읽어도 되는 데이터 원천 목록입니다. source는 active/paused/closed 상태를 가집니다.

예시:

- Teams 채널
- Slack 채널
- Outlook folder
- DMS matter folder
- VDR export
- Billing system
- Calendar

### `review_workflow`

산출물 검토 정책입니다.

- `default_reviewer`
- `client_facing_requires_partner_approval`
- `legal_conclusion_requires_citation`
- `review_log`

## 산출물 상태

Harness가 만든 것은 기본적으로 `needs-review`입니다. 다음 상태만 확정 상태로 봅니다.

- `approved`
- `approved-with-edits`
- `rejected`

## 확장 필드

다음은 필요할 때 추가합니다.

- `issues`: 쟁점 register
- `evidence_matrix`: 주장-증거 매핑
- `deal_checklist`: CP/closing checklist
- `chronology`: 분쟁 사실관계
- `knowledge_links`: 선례, 조항, 내부 메모 링크
