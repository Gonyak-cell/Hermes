# 03. FCORE 프로그램 계획 (트랜치 F0, FA~FE)

> 지위: DRAFT v0.1 / 2026-06-11 / 작성: Fable 5 계획 레인 (`claude-fable-5[1m]`)
> 계획 증거이며 승인이 아니다. 검증 기질 사용 금지. ([00-README.md](00-README.md) 공통 고지 적용)

## 0. ID 체계 선언

- **FCORE가 본 프로그램의 정본 ID 체계다.** 1 phase = 리뷰 가능한 커밋 1개. 총 30 phase.
- 새 pNNNN 범위를 발행하지 않는다. 레거시 P-범위는 source binding으로만 인용한다.
- 피라미드 R0~R10 / TUW ID 체계는 본 프로그램에 비구속(어휘 차용만 — S0-5 판정 참조).
- HRM-03 준수: 리뷰 윈도우 ≤25커밋, 윈도우당 로드맵 phase 문서 ≤1.
  **phase 문서는 해당 구현 커밋보다 먼저 커밋·리뷰된다 (동시 커밋 금지).**
- FB~FE의 11필드 풀 스펙은 직전 트랜치 증거 확보 후 작성한다 (문서공장 재발 방지).
  본 문서의 FB~FE는 방향 수준 + 승격 기준만 명시한다.

## 트랜치 F0 — 선행조건 (5 phase, 코드 거의 없음)

FA 구현 착수 전 F0.1~F0.5가 모두 완료되어야 한다. F0.1/F0.2는 소유자 판정만으로 대체할 수 없는
hard blocker이며, 해소 또는 조건부 waiver가 기계적으로 추적되어야 한다.

| Phase | 목표 | 산출물 | 검증 |
|---|---|---|---|
| F0.1 | 누락 리뷰 영수증 2건 확보 + F0 receipt-integrity preflight | `artifacts/connector-external-app-governance/review/claude-connector-governance-review-receipt.json`, `artifacts/execution-write-authority-maturity/review/` 영수증, `docs/factory-promotion/f0-receipt-integrity-preflight.md` 또는 동등한 검증 노트 | 각 영수증이 reviewed commit SHA, prompt SHA256, raw output SHA256, resolved model id, receipt file SHA256, scope id, unresolved finding count를 바인딩한 뒤에만 두 `--check`를 unblock 근거로 인정 |
| F0.2 | `multi-engine-orchestration` `ready_for_p15001_handoff:false` 해소/면제 | 해소 커밋 또는 만료 조건이 있는 소유자 waiver 영수증 | `npm run platform:multi-engine-orchestration -- --check`, `npm run platform:saas-factory-mode -- --check`; source handoff가 pass이거나 waiver가 visible blocker로 남아야 함 |
| F0.3 | HRM-01/03/04 소유자 판정 + FCORE 상한 채택 | 판정 영수증 ([S0-3](09-decision-records/S0-3-hrm-findings-adjudication-draft.md)) | — |
| F0.4 | 병합 거버넌스 결정 | 결정 문서 ([S0-4](09-decision-records/S0-4-merge-governance-decision-draft.md)) | — |
| F0.5 | 정체성·ID 체계 판정 | 판정 문서 ([S0-5](09-decision-records/S0-5-identity-and-id-scheme-decision-draft.md)) | — |

권한 경계: 문서/영수증 외 소스 변이 없음. 전 플래그 false.
핸드오프: F0.1~F0.5 완료 + `platform:saas-factory-mode` source handoff pass 또는 조건부 waiver visible + 10개 권한 플래그 false 확인 → FA 개시 가능.

## 트랜치 FA — 영속 제품 레지스트리 + 영수증 구동 상태 원장 v0 (6 phase, 풀 스펙)

### FA.1 — Phase 문서 + 스키마 (구현 커밋 선행)

- **목표:** `product-record.v1`, `product-state-transition.v1`, `factory-receipt-envelope.v1` 스키마 확정.
  영속 상태 위치 = split store로 결정 기록. 추적되는 `data/factory/seed/`는 seed/test fixture와 migration receipt만 보관하고,
  local operational ledger는 기본 `data/factory/local/` 또는 `artifacts/factory-state-store/` 아래 gitignore 대상이다.
  진실 원천 판정은 "운영 진실은 local ledger, 커밋 가능한 기준선은 redacted seed fixture, projection=파생 뷰"로 둔다.
- **소스 바인딩:** [04-target-architecture.md](04-target-architecture.md) §3 데이터 계약 초안.
- **변경 파일:** `schemas/factory-product-registry-store.schema.json`(신규), `schemas/factory-receipt-envelope.schema.json`(신규), `docs/factory-state-store.md`(신규), `.gitignore`(local operational ledger 제외 규칙).
- **테스트:** 스키마 자체 검증 (`npm run contracts:validate` 체인 편입).
- **검증 명령:** `npm run contracts:validate`.
- **네거티브 픽스처:** 필수 필드 누락 레코드 → 스키마 거부 (실행형).
- **권한 경계:** 플래그 변경 없음.
- **수용 기준:** 소유자 리뷰 노트 + tracked seed와 local operational ledger 분리 검증.
- **핸드오프:** FA.2 개시.

### FA.2 — 저장소 모듈

- **목표:** `src/factory-product-registry-store.mjs` — 검증 동반 append JSONL 원장,
  `payload_sha256` + `prev_entry_hash` 체인, `product_id` 스코프 읽기, `--check` no-write 모드.
- **변경 파일:** `src/factory-product-registry-store.mjs`(신규), `scripts/factory-product-registry-store.mjs`(신규),
  `package.json`(스크립트 `platform:factory-product-registry-store` 추가 + validate 체인 편입),
  `test/factory-product-registry-store.test.mjs`(신규).
- **테스트:** 실제 임시 디렉터리 setup/teardown. append-only 강제(기존 행 재작성 시도→거부),
  체인 손상 감지, 손상 후 복구, 동시 append 직렬화.
- **검증 명령:** `npm run platform:factory-product-registry-store -- --check`, `npm test`.
- **네거티브 픽스처(실행형):** 스키마 위반 append→거부, 해시 불일치 append→거부, `--check` 중 쓰기 시도→0 변경
  (기존 `check-no-write-policy` 테스트로 검증).
- **권한 경계:** 쓰기는 local operational ledger 루트 한정. tracked seed는 명시적 migration command만 갱신한다. 전 플래그 false.
- **수용 기준:** 전 테스트 통과 + no-write 정책 통과.

### FA.3 — 영수증 구동 전이 PS0–PS2

- **목표:** 스키마 유효 + 해시 일치 영수증 파일이 있을 때만 `PS0→PS1→PS2` 이벤트를 append하는 전이 핸들러.
  PS3+ 핸들러는 구조적으로 부재.
- **변경 파일:** `src/factory-product-registry-store.mjs`(전이 핸들러), 테스트 확장.
- **네거티브 픽스처(실행형):** 위조 영수증(잘못된 해시)→거부, 영수증 재사용(replay)→거부, PS3 전이 시도→거부.
- **권한 경계:** 원장은 PS *상태*만 기록. *권한* 기록 금지. 전 플래그 소스 리터럴 false.

### FA.4 — 시드 마이그레이션

- **목표:** 등록 control-plan 프로젝트 4개 + fixture 포트폴리오 5개를 `const` 배열에서 저장소 레코드로
  1회성 이전(영수증 기록). 기존 배열은 폴백 fixture로 보존.
- **소스 바인딩:** `src/product-domain-saas-factory.mjs:36`, `src/multi-project-saas-control-plane.mjs`,
  `src/work-os-live-control-surface.mjs:56-62`.
- **수용 기준:** 이전 레코드 9건의 해시 체인 유효 + 이전 영수증 1건 기록.

### FA.5 — projection 1개 재지향

- **목표:** `multi-project-saas-control-plane`이 저장소를 읽도록 (저장소 부재 시 fixture 폴백).
- **수용 기준:** **레거시 5개 `--check` 명령 전부 상태 불변으로 통과**
  (`platform:product-domain-saas-factory`, `platform:product-build-verification-loop`,
  `platform:saas-factory-mode`, `platform:connector-external-app-governance`,
  `platform:execution-write-authority-maturity`).

### FA.6 — 읽기 전용 API + freeze

- **목표:** review-api에 `/api/factory/products` GET 라우트. POST→405 실행형 픽스처.
  트랜치 freeze 아티팩트 + 리뷰 패킷.
- **핸드오프 조건:** 독립 리뷰 영수증(resolved model id 원문) + 소유자 노트 → FB 개시 가능.

## 트랜치 FB — 제품별 PS 상태 + 인스턴스화 리졸버, 후보 전용 (5 phase, 방향 수준)

- FB.1–FB.2: PS 상태 읽기 모델 + `/api/factory/stage`. 바인딩: P15801–P16200, P16201–P16600.
  실행형 픽스처: PS3 전이 append 시도→거부.
- FB.3–FB.4: 인스턴스화 리졸버 → 후보 매니페스트(JSON만). 스타터 아티팩트 코퍼스 실체화
  (pack manifest가 참조하는 `templates/law-firm/*.md` 등 미존재 파일 생성). 바인딩: P15041–P15080, P15201–P15240.
- FB.5: 워크벤치 v0 통합 읽기전용 뷰.
- **승격 기준:** FA 출구 조건 충족 + FA 리뷰에서 blocking finding 0.

## 트랜치 FC — 실행 가능한 후보 끝단 (5 phase, 방향 수준)

- 격리 워크트리 내 실 diff 패킷 생성 + 롤백 계획 + 실행된 preflight. 후보 해시 원장 기록.
- 바인딩: P12401–P12600, P6601–P7000, `src/worktree-manager.mjs`, `src/personal-dev-slice-runner.mjs`.
- 실행형 픽스처: apply 시도→차단, 워크트리 외부 쓰기→차단. `patch_apply_enabled` 소스 리터럴 false 유지.
- **승격 기준:** FB 출구 + 워크벤치에서 PS 상태 실데이터 표시 확인.

## 트랜치 FD — 영수증 무결성 + apply 엔진(닫힘) (5 phase, 방향 수준)

- 영수증 서명/attestation(콘텐츠 해시→체인→소유자 attestation), 영수증 소비 apply 엔진(도달 불가 상태로 구현),
  롤백 실행기. 바인딩: P12501–P12520, P16081–P16120, CLAUDE.md 해시 요건.
- **경고:** projection 패턴 속도 가정 적용 금지. 별도 보안 리뷰 패스 필수 (full context / security / tests /
  fix verification / regression — CLAUDE.md 고위험 리뷰 규정).
- **승격 기준:** FC 출구 + 후보 패킷 3건 실증.

## 트랜치 FE — 인테이크 + 루프 인스턴스화 (4 phase, 방향 수준)

- 실 PRD 인테이크(첫 대상: `docs/hermes-enterprise-saas-specification.md`), TUW/작업 패킷 분해,
  P9801–P10000 검증 루프 제품별 인스턴스화. 바인딩: P9601–P10200, P12801–P13000.
- **영역 5(커넥터)는 본 프로그램에서 계획하지 않는다** — F0.1 영수증 확보로 한정.
  OAuth/네트워크는 외부 서비스 금지 제약 해제와 함께 별도 프로그램.

## 트랜치 합계: 30 phase (F0:5, FA:6, FB:5, FC:5, FD:5, FE:4)
