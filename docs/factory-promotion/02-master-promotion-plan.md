# 02. 승격 마스터플랜 — Stage 0 ~ Stage 7

> 지위: DRAFT v0.1 / 2026-06-11 / 작성: Fable 5 계획 레인 (`claude-fable-5[1m]`)
> 계획 증거이며 승인이 아니다. 검증 기질 사용 금지. ([00-README.md](00-README.md) 공통 고지 적용)

## 1. 승격 완료 판정 기준 (Definition of Done)

다음 4가지를 **파일럿 제품 1개로 실증**했을 때 "SaaS Factory 승격 완료"로 판정한다:

1. **E2E 실증** — 신규 제품 1개가 `PRD 인테이크 → 요구사항 분해 → 작업 패킷 → 후보 diff 패킷
   → 영수증 검증 apply(워크트리 한정) → 재검증 → 릴리스 후보`를 끊김 없는 영수증 체인과 함께 통과.
2. **무결성 실증** — 위조 영수증·재사용 영수증·범위 초과 쓰기가 실행형 픽스처에서 실제 차단.
3. **운영 실증** — 워크벤치에서 전 제품의 PS 상태/블로커/다음 액션이 영속 저장소 실데이터로 조회.
4. **경계 유지** — `production_pass_enabled`/`enterprise_pass_enabled`는 승격 후에도 false.
   단독 소유자 모드에서는 외부 독립 리뷰·서명 attestation 없이 열 수 없다(저장소 자체 규칙, REVIEW.md).
   승격의 종착지는 "deploy-ready 릴리스 후보를 만드는 팩토리"이지 enterprise trust 주장이 아니다.

## 2. 불변 원칙 (전 스테이지)

1. 권한 플래그는 끝까지 소스 리터럴. 데이터가 권한을 뒤집는 실행기 영구 금지.
2. 교집합 리뷰: 구현자(Codex) ≠ 독립 리뷰어 ≠ 판정자(소유자). 계획 작성 엔진은 자기 계획 구현의 독립 리뷰 불가.
3. HRM 상한: 리뷰 윈도우 ≤25커밋, 로드맵 phase 문서 ≤1, review depth ≤1. 계획 문서는 구현과 분리 커밋·선행 리뷰.
4. 네거티브 픽스처는 실행형 (금지 경로 실제 실행 → 거부 관찰).
5. 영수증: `payload_sha256` + `prev_entry_hash` 체인 + `resolved_model_id` 원문 + 대상 후보 해시 바인딩.
6. 제품 간 격리: `product_id` 네임스페이스, 교차 읽기 거부 픽스처, `cross_project_data_mixing_allowed=false`.

## 3. 스테이지 로드맵

```
Stage 0 거버넌스 정리 ─→ Stage 1 영속 코어 ─→ Stage 2 읽기전용 팩토리 ─→ Stage 3 후보 생성 팩토리
                                                                              │
Stage 7 파일럿 릴리스 후보 ←─ Stage 6 제한 실행+인테이크 ←─ Stage 5 게이트 개방 ←─ Stage 4 무결성+apply(닫힘)
```

### Stage 0 — 거버넌스 정리 (트랜치 F0, ~1주, 코드 거의 없음)

판정 5건: [09-decision-records/](09-decision-records/) S0-1(엔진 정체성), S0-2(상류 블로커),
S0-3(HRM 판정), S0-4(병합 거버넌스), S0-5(정체성·ID 체계).
추가 hard gate: F0.1 누락 리뷰 영수증은 원칙적으로 [f0-receipt-integrity-preflight.md](f0-receipt-integrity-preflight.md)를 통과해야 하고,
F0.2는 `multi-engine-orchestration` source handoff를 해소하거나 만료 조건이 있는 waiver로 visible blocker를 남겨야 한다.
이번 run은 human owner가 [f0-owner-no-opus-exception-receipt.json](f0-owner-no-opus-exception-receipt.json)으로 낮은 신뢰도 예외를 발행했으므로 FA 착수만 허용한다.
**출구 조건:** F0.1~F0.5 전부 완료 또는 owner no-Opus exception visible. 이전에는 어떤 FA 커밋도 금지.

### Stage 1 — 영속 상태 코어 (트랜치 FA, 1~2 리뷰 윈도우)

추적되는 `data/factory/` 루트, 해시 체인 JSONL 원장 3종, `const` 배열 → 저장소 레코드 마이그레이션,
projection 1개 재지향, `/api/factory/products` GET. 상세: [03-fcore-program.md](03-fcore-program.md) §FA.
**출구 조건:** 레거시 5개 `--check` 무손상 통과 + 실행형 위조/재사용/체인손상 거부 픽스처 통과
+ 독립 리뷰 영수증 + 소유자 노트.

### Stage 2 — 읽기전용 팩토리 가동 (트랜치 FB, 1 윈도우)

제품별 PS 상태 읽기 모델(`/api/factory/stage`), 인스턴스화 리졸버(후보 매니페스트만),
스타터 아티팩트 코퍼스 실체화, 워크벤치 v0(읽기전용 통합 뷰, 전 라우트 POST→405 픽스처).
**출구 조건:** 등록 제품 4개의 PS 상태 실데이터 표시, 신선도 정책 가동.

### Stage 3 — 후보 생성 팩토리 (트랜치 FC, 1~2 윈도우)

격리 워크트리에서 실제 unified diff 패킷 + 롤백 계획 + 실행된 preflight. 후보 콘텐츠 해시를 원장에 기록.
실행형 픽스처: apply 시도→차단, 워크트리 외부 쓰기→차단. `patch_apply_enabled=false` 유지.
**여기까지가 "쓰기 0"의 마지막 안전 지대.**
**출구 조건:** 파일럿 대상에서 후보 diff 패킷 3건 이상 생성·리뷰·해시 등록.

### Stage 4 — 영수증 무결성 + apply 엔진(닫힘) (트랜치 FD, 2 윈도우)

승격 전체에서 가장 위험하고 새로운 작업. projection 패턴 속도 가정 적용 금지.
영수증 서명/attestation 체계, 영수증 소비 apply 엔진(활성화 플래그는 소스 리터럴 false로 도달 불가),
롤백 실행기. **출구 조건:** 격리 환경에서 apply→검증→롤백 전 사이클 실증 + 위조 영수증 apply 거부 실증.
본 리포·실제 제품 쓰기 없음.

### Stage 5 — 게이트 개방 (G-시리즈, 게이트당 소유자 판정 1회)

상세: [05-gate-opening-program.md](05-gate-opening-program.md).
G1a(`project_creation`) → G1b(`repo_write`, 워크트리 한정) → G2(`command_execution`, allowlist 샌드박스)
→ G3(`deployment`, 파일럿 스테이징 한정). `connector_write`/`production_pass`/`enterprise_pass` 유보.

### Stage 6 — 제한 실행 + E2E 인테이크 (트랜치 FE + G2, 1~2 윈도우)

실 PRD 인테이크(첫 대상: `hermes-enterprise-saas-specification.md` 자체), TUW/작업 패킷 분해 구현,
P9801–P10000 검증 루프의 제품별 인스턴스화, 샌드박스 명령 실행으로 후보 검증 자동화.

### Stage 7 — 파일럿 릴리스 후보 (2~4주)

파일럿 순서(위험 오름차순): ① `project.hermes_harness`(자기 자신 — 병합 백로그가 첫 통제 쓰기 대상)
→ ② `project.zendd_bridge` → ③ `project.hr_solution_internalization` → ④ `project.law_firm_os`(격리 픽스처 전부 통과 후, 반드시 마지막).
상세: [06-pilot-strategy.md](06-pilot-strategy.md). **출구 조건 = §1 판정 기준 4항목.**

## 4. 일정·부하 추정

| 스테이지 | 리뷰 윈도우 | 소유자 부하(추정) |
|---|---|---|
| Stage 0 | 0~1 | 판정 5건, 3~4시간 |
| Stage 1 (FA) | 1~2 | 윈도우당 1~2시간 |
| Stage 2 (FB) | 1 | 1시간 |
| Stage 3 (FC) | 1~2 | 2시간 (diff 패킷 직접 검토) |
| Stage 4 (FD) | 2 | 3시간 (보안 비중 최대) |
| Stage 5 (G1a/G1b) | 1 | 판정 2건 |
| Stage 6 (FE+G2) | 1~2 | 2시간 |
| Stage 7 파일럿 | 2~3 | 사이클당 1시간 |
| **합계** | **10~14 윈도우 ≈ 8~12주** | |

선행 조건: 새 스테이지 개시 전 대기 큐 소진. 기존 대기 영수증 45건은 Stage 1에서 일괄 처분(적용/폐기 판정).

## 5. 중단 조건 (Stop Conditions)

다음 중 하나라도 발생 시 해당 스테이지 동결 + 소유자 에스컬레이션:

1. 실행형 네거티브 픽스처가 차단해야 할 경로를 통과시킴 (위조가 막히지 않음).
2. 데이터 값만으로 권한 플래그를 뒤집는 경로 발견.
3. 리뷰 윈도우 25커밋 초과 또는 미리뷰 phase 문서 2건 이상 누적.
4. 영수증의 `resolved_model_id`와 실제 실행 엔진 불일치 발견.
5. 교차 제품 데이터 접근이 픽스처 외 경로에서 관찰됨.

## 6. 즉시 다음 액션

1. **Codex 레인:** owner no-Opus exception을 포함한 F0 gate를 현재 repo 상태에서 통과시킨다.
2. **Codex 레인:** FA.1 착수. 단, 신뢰 수준은 `owner_exception_low_trust`로 표시한다.
3. **독립 리뷰어 레인:** Opus 사용 가능 시 deferred F0.1 리뷰 영수증 2건을 보강한다.
4. **Codex 레인:** production/enterprise/final approval/protected/write/deploy 관련 게이트는 deferred 리뷰 영수증 전까지 계속 닫는다.
