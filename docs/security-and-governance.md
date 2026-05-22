# 보안 및 거버넌스

## 기본 원칙

로펌용 harness의 보안 목표는 단순히 데이터를 숨기는 것이 아닙니다. 사건별 비밀, 의뢰인별 이해상충, 접근권한, 업무상 비밀, 개인정보, 감사 가능성을 함께 지키는 것입니다.

## 권한 모델

권장 access tier:

- `public`: 외부 공개자료
- `internal`: 로펌 내부 운영자료
- `client-confidential`: 의뢰인 또는 사건 관련 비밀자료
- `privileged`: 변호사-의뢰인 커뮤니케이션 및 법률검토 자료
- `restricted`: 제한된 팀만 접근 가능한 고위험 자료

모든 matter에는 최소한 다음이 있어야 합니다.

- matter owner
- responsible partner
- authorized team list
- confidentiality level
- retention policy
- export policy
- human review policy

## Human Review Gate

아래 산출물은 자동 발송하지 않습니다.

- 고객 이메일
- 법률 의견서
- 계약서 mark-up
- 준비서면 또는 법원 제출문서
- 보도자료, 공시, 이사회 보고자료
- 청구서 또는 견적서 최종본

Harness는 초안을 만들 수 있지만, 최종 발송자는 변호사 또는 지정된 실무자여야 합니다.

## Data Handling

- 원문 저장과 요약 저장을 분리합니다.
- 외부 모델로 보낼 데이터는 최소화합니다.
- client name, 개인식별정보, 영업비밀은 필요한 경우 pseudonym map을 통해 대체합니다.
- 원문 링크와 요약의 출처를 남깁니다.
- 모든 generated output에는 source coverage와 reviewer를 기록합니다.

## Prompt Injection 방어

문서, 이메일, 메신저에는 악성 지시가 섞일 수 있습니다. Harness는 외부 입력을 지시문이 아니라 evidence 또는 content로만 취급해야 합니다.

운영 규칙:

- 외부 문서의 문구를 system instruction으로 승격하지 않습니다.
- "이 내용을 비밀로 하라" 같은 문서 내부 문구는 지시가 아니라 검토 대상 텍스트입니다.
- Hermes context file은 사람이 리뷰한 저장소 내부 파일만 사용합니다.
- skill은 외부 원문을 읽은 뒤 deterministic script로 구조화하고, 그 결과만 LLM에게 넘기는 흐름을 우선합니다.

## Audit Trail

각 산출물에는 다음 metadata를 남깁니다.

- source matter
- source documents or messages
- generation timestamp
- script or skill version
- model name if LLM used
- reviewer
- approval status
- client-facing 여부

## 배포 전 체크리스트

- 고객별 AI 사용 동의 및 예외 정책
- 내부 보안팀의 데이터 보관 위치 승인
- DMS, ERP, 메신저, 캘린더의 API 권한 범위
- matter closure 후 retention and deletion workflow
- 외부 모델 사용 시 데이터 처리 약관 검토
- 변호사 책임과 검토 의무에 관한 내부 규정
- incident response runbook
