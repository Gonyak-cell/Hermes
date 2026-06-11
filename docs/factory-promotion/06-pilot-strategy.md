# 06. 파일럿 제품 전략

> 지위: DRAFT v0.1 / 2026-06-11 / 작성: Fable 5 계획 레인 (`claude-fable-5[1m]`)
> 계획 증거이며 승인이 아니다. 검증 기질 사용 금지. ([00-README.md](00-README.md) 공통 고지 적용)

## 1. 파일럿 순서 (위험도 오름차순)

### 파일럿 1 — `project.hermes_harness` (자기 자신, dogfooding)

- **선정 사유:** 첫 통제 쓰기 대상으로 최적. main 대비 181커밋 병합 백로그는 *이미 존재하는 실제 쓰기
  거버넌스 문제*이며, 실패해도 외부 피해가 없다. 팩토리가 자기 자신의 머지를 영수증 게이트로 처리하면
  [S0-4 병합 거버넌스 판정](09-decision-records/S0-4-merge-governance-decision-draft.md)이 동시에 해소된다.
- **시나리오:** 미병합 트랜치 묶음 → 후보 diff 패킷(FC 레인) → 독립 리뷰 → 소유자 영수증 → 워크트리 apply(G1b)
  → post-apply 검증(`npm test`, `npm run validate`) → main 합류.
- **성공 기준:** 병합 백로그 묶음 ≥3건이 영수증 체인과 함께 main에 합류, 사고 0.

### 파일럿 2 — `project.zendd_bridge`

- **선정 사유:** 외부 리포 첫 사례. `zendd-actual-checkout-preflight.mjs`가 이미 실제 preflight 명령을
  실행한 유일한 외부 대상 — 실행 증거의 출발점이 있다.
- **시나리오:** PS0 등록 → PS2 → 후보 diff 패킷 1건 → G1b apply → 재검증.
- **성공 기준:** 외부 리포에 영수증 게이트 apply 1건 + 롤백 리허설 1건.

### 파일럿 3 — `project.hr_solution_internalization`

- **선정 사유:** **신규 제품 인스턴스화 첫 사례** (G1a 실증 대상). 템플릿 → 후보 매니페스트 → 워크스페이스 생성
  → PRD 인테이크 → 작업 패킷 → 릴리스 후보의 전체 깔때기 실증.
- **성공 기준:** [02-master-promotion-plan.md](02-master-promotion-plan.md) §1 승격 완료 판정 4항목 충족.
  **이 파일럿이 승격 완료 판정의 실증 대상이다.**

### 파일럿 4 — `project.law_firm_os` (반드시 마지막)

- **선정 사유 및 경고:** 고객 기밀(client_confidential) 데이터 도메인. 격리 실패의 피해가 가장 크다.
- **선행 조건 (전부 충족 전 PS3 진입 금지):**
  1. 교차 제품 읽기 거부 실행형 픽스처 전부 통과 (파일럿 1~3 기간 누적 실적 포함)
  2. client_confidential 본문 비노출 규칙 워크벤치 검증
  3. tombstone 삭제 절차 검증
  4. 소유자 명시 판정 영수증 (law-firm 데이터 반입 승인)

## 2. 파일럿 공통 규칙

- 파일럿당 동시 진행 후보 패킷 ≤2건 (운영자 부하 통제).
- 각 파일럿 시작 전: 대기 영수증 큐 0건 확인.
- 사고 발생 시 해당 제품 강등([05-gate-opening-program.md](05-gate-opening-program.md) §5) + 전 파일럿 일시 정지.
