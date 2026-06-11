# 07. 검증 전략 — 상태형 테스트와 실행형 네거티브 픽스처

> 지위: DRAFT v0.1 / 2026-06-11 / 작성: Fable 5 계획 레인 (`claude-fable-5[1m]`)
> 계획 증거이며 승인이 아니다. 검증 기질 사용 금지. ([00-README.md](00-README.md) 공통 고지 적용)

## 1. 배경: 기존 테스트 체계의 한계

- 260개 테스트 중 212개가 `write:false` 인메모리 projection 형태 검증 — 생성기의 출력 *모양*을 검증하지
  외부 런타임 동작을 검증하지 않는다.
- 네거티브 픽스처가 선언형: `actual_result`를 `expected_block`과 같다고 하드코딩, 금지 경로 미실행.
- 영속 저장소와 쓰기 레인에는 이 패턴이 **구조적으로 부적합**하다.

## 2. 상태형 저장소 테스트 규약 (FA부터 의무)

| 항목 | 규약 |
|---|---|
| 격리 | 테스트마다 실제 임시 디렉터리 setup/teardown (`node:fs/promises` mkdtemp). 공유 상태 금지 |
| append-only 강제 | 기존 행 재작성/삭제 시도 → 거부를 **실행으로 관찰** |
| 체인 무결성 | 중간 행 변조 후 검증기 실행 → 단절 감지 관찰 |
| 복구 | 손상 원장 + 마지막 유효 체크포인트 → 복구 절차 실행 → 유효성 재검증 |
| 동시성 | 동시 append 2건 → 직렬화 보장 (lock 또는 single-writer 확인) |
| no-write 보존 | `--check` 모드 실행 후 데이터 루트 해시 불변 — 기존 `test/check-no-write-policy.test.mjs` 체계로 검증 |

## 3. 실행형 네거티브 픽스처 규약 (전 트랜치 의무)

**정의:** 픽스처는 금지된 경로를 *실제로 실행*하고 거부를 *관찰*해야 한다.
`actual_result` 필드는 실행 결과로만 채워지며 하드코딩 금지.

필수 픽스처 목록 (트랜치별):

| 트랜치 | 실행형 픽스처 |
|---|---|
| FA | 스키마 위반 append→거부 / 해시 불일치 append→거부 / 위조 영수증 전이→거부 / 영수증 replay→거부 / PS3 전이→거부 / 교차 `product_id` 읽기→거부 |
| FB | 신규 GET 라우트 전부에 POST→405 / PS3 전이 append→거부 / 미존재 템플릿 인스턴스화→거부 |
| FC | 후보 패킷 apply 시도→차단 / 워크트리 외부 경로 쓰기→차단 / 보호 경로 diff 포함→preflight 실패 |
| FD | 위조 영수증으로 apply→거부 / 바인딩 해시 불일치 apply→거부 / nonce 재사용→거부 / 롤백 후 상태 불일치→실패 보고 |
| FE | 스코프 없는 인테이크→거부 / 타 제품 요구사항 참조→거부 |

## 4. 검증 명령 인벤토리

### 기존 (전 트랜치에서 무손상 유지 의무)

```bash
npm run platform:product-domain-saas-factory -- --check
npm run platform:product-build-verification-loop -- --check
npm run platform:saas-factory-mode -- --check
npm run platform:connector-external-app-governance -- --check
npm run platform:execution-write-authority-maturity -- --check
npm test
npm run test:canonical
npm run validate
```

### 신규 (도입 트랜치)

```bash
npm run platform:factory-product-registry-store -- --check   # FA.2
npm run factory:stage -- --check                             # FB.1
npm run factory:candidate-lane -- --check                    # FC
npm run factory:receipt-verify -- --check                    # FD
npm run factory:intake -- --check                            # FE
```

신규 명령은 전부 `validate` 체인에 편입하고 `--check`는 no-write를 보장한다.

## 5. 리뷰 패스 규정 (CLAUDE.md 고위험 규정 승계)

FD(쓰기 레인)와 게이트 개방 커밋은 단일 리뷰로 닫을 수 없다. 분리 패스 의무:
full context / security / tests / migration / fix verification / regression risk.
각 패스는 normalized finding(심각도·카테고리·위치·증거·이슈·제안·확신도·수용 리스크·기각 리스크)을 남긴다.

## 6. canonical-test-runner 연동

`src/canonical-test-runner.mjs`(실제 spawn + sha256 출력 해시로 에이전트 자기보고 불신)를
FCORE 신규 명령에도 적용한다. 트랜치 freeze는 canonical run 해시 증거를 포함해야 한다.
