# 01. 현재 상태 진단 (전수점검 결과)

> 지위: DRAFT v0.1 / 2026-06-11 / 작성: Fable 5 계획 레인 (`claude-fable-5[1m]`)
> 본 문서는 계획 증거이며 승인이 아니다. 검증 기질로 사용 금지. ([00-README.md](00-README.md) 공통 고지 적용)
>
> 근거: 검사 에이전트 18개(서브시스템 조사 8, 영역별 성숙도 검증 7, 적대적 비평 3),
> 도구 호출 491회, 전 과정 읽기 전용. 5개 `--check` 명령 재실행으로 작업 트리 무변경 확인.

## 1. 저장소 실측 통계 (2026-06-11 기준)

| 항목 | 값 |
|---|---|
| 저장소 연령 | 18일 (최초 커밋 2026-05-23) |
| 커밋 수 | 653 (활동일 17일, 일평균 ~38, 최대 103) |
| src 모듈 | 751개 (.mjs, 플랫 구조, 34MB) |
| scripts | 759개 / npm 스크립트 765개 / 스키마 627개 |
| 테스트 파일 | 260개 (212개가 `write:false` 인메모리 projection 검증) |
| 문서 | 686개 (로드맵 문서 175개, phase ID p1200~p72000) |
| 아티팩트 | 422개 디렉터리, 199MB, **전부 gitignore** (추적 파일 0) |
| 런타임 의존성 | **0개** (devDeps: ajv, ajv-formats만) |
| 브랜치 상태 | `codex/p3840-review-hardening`이 `main`보다 **181커밋 앞**, main 정지 상태(2026-06-04) |
| Phase 인플레이션 | 4일간 149개 트랜치 커밋이 phase ID p8800→p64000 소모 (커밋당 ~370 ID). 로드맵 문서가 자신이 계획하는 코드와 **같은 커밋에서 동시 생성**됨 |

## 2. 7개 영역 성숙도 매트릭스

성숙도 사다리: contract → projection → ui → executable → receipt-gated-execution (단계 붕괴 금지)

| 영역 | Contract | Projection | UI | Executable | Receipt-gated |
|---|---|---|---|---|---|
| 1. 운영자 워크벤치 | 있음 | 있음 | 있음¹ | 부분² | 부분³ |
| 2. 템플릿/인스턴스화 | 있음 (P15041–P15080) | 있음 | 부분 | 부분⁴ | **없음** |
| 3. 영속 레지스트리/저장소 | 있음 | 있음 | 있음 | 부분 | 부분 |
| 4. 리포/워크트리 쓰기 레인 | 있음 | 있음 | 있음 | 부분⁵ | 부분⁶ |
| 5. 커넥터 거버넌스 | 있음 (P15401–P15800 1:1) | 있음 | 부분 | 부분⁷ | 부분 |
| 6. E2E 빌드 워크플로 | 있음 | 있음 | 있음 | 부분⁸ | 부분 |
| 7. 승격 게이트 | 있음 | 있음 | 부분 | **없음** | **없음** |

¹ 691KB 정적 대시보드 + 읽기전용 라이브 API ~1,645 GET 라우트 (`src/review-api.mjs`, 포트 4177) + 읽기전용 서버 9종(포트 4188~4203)
² 실서버가 실제 아티팩트 상태 위에서 구동되나 전부 읽기 전용. 데이터 9일 경과(2026-06-02 생성, overall_status=blocked)
³ 영수증이 게이트하는 것은 아티팩트 상태 전이뿐 (대기 영수증 45건, 적용 0건, 보호 액션 실행 0건)
⁴ `packs:registry`/`packs:validate`가 실제 `packs/` 트리 검증. 단, pack manifest가 참조하는 `templates/law-firm/*.md` 등 스타터 파일은 **디스크에 미존재**
⁵ `src/worktree-manager.mjs`가 실제 `git worktree add` 실행; `personal-dev-slice-runner.mjs`가 격리 워크트리에서 실명령 spawn
⁶ 게이트 기계가 실제로 차단 중 (45 pending / 0 applied) — 차단은 진짜, 실행 레인은 부재
⁷ 로컬 파일시스템 소스 한정 read-only sync (`resource-audit.mjs`). 네트워크 커넥터 없음
⁸ 실제 Claude CLI 리뷰 영수증 캡처됨 (`claude-opus-4-7`, session id, 비용 포함); closeout이 영수증 완결성에 fail-closed

## 3. 핵심 패턴 진단: "projection 평면"

- 모든 모듈이 동일 패턴: 상류 아티팩트 JSON + 하드코딩 fixture 배열 + **자기 로드맵 마크다운에 대한 키워드 존재 검사**(`includesText(roadmapText, term)`, [src/saas-factory-mode.mjs:245](../../src/saas-factory-mode.mjs)) → verdict 행 → `artifacts/<name>/latest` 덮어쓰기.
- 즉 "검증"의 대부분은 기능 검증이 아니라 **자기참조적 문서 린트**.
- 모든 `*_allowed_now` 플래그는 **소스 하드코딩 `false` 리터럴** ([src/saas-factory-mode.mjs:315](../../src/saas-factory-mode.mjs) `buildBoundary()`). 안전 속성인 동시에, 플래그 뒤에 실 메커니즘이 없다는 뜻.
- 751개 중 자기 이전 출력을 읽는 모듈 6개. 영속 가변 상태 0. 레지스트리는 `const` 배열(`SAAS_PROJECT_SPECS` — [src/product-domain-saas-factory.mjs:36](../../src/product-domain-saas-factory.mjs), `PROJECT_SPECS` — [src/work-os-live-control-surface.mjs:56](../../src/work-os-live-control-surface.mjs)). 신규 제품 온보딩 = .mjs 소스 수정.
- 네거티브 픽스처는 선언형: `actual_result`가 `expected_block`과 같다고 하드코딩, 금지 경로 미실행.

## 4. 영수증 게이트의 기계적 실체 (실코드 확인)

connector 게이트 판정 ([src/connector-external-app-governance.mjs:279-283](../../src/connector-external-app-governance.mjs)):

```text
artifacts/connector-external-app-governance/review/claude-connector-governance-review-receipt.json 에서
  review_engine === "claude_code_opus_max"
  receipt_status === "complete"
  scope_connector_external_app_governance === true
  unresolved_finding_count === 0
```

- 해시·서명·출처 검증 **전무**. 필드 4개가 일치하는 파일이면 무엇이든 게이트가 열림 → **영수증 위조가 입증된 권한 상승 벡터**.
- execution-write-authority-maturity 게이트도 동형 (`claude_execution_write_authority_review_receipt_path`).
- `review_engine`이 `"claude_code_opus_max"` 상수로 고정 → 엔진 정체성 판정([S0-1](09-decision-records/S0-1-engine-identity-decision-draft.md)) 없이는 Opus 외 엔진이 이 영수증을 작성하는 것 자체가 위조.

## 5. 프로세스 차단 요소 (코드 결핍 아님)

| # | 차단 요소 | 증거 |
|---|---|---|
| B1 | Claude 리뷰 영수증 2건 부재 | `artifacts/connector-external-app-governance/review/`, `artifacts/execution-write-authority-maturity/review/` 미존재 |
| B2 | 상류 블로커 | `multi-engine-orchestration` 아티팩트 `ready_for_p15001_handoff:false` → P15001–P16600 체인 전체 blocked |
| B3 | HRM-01/03/04 open | [architecture.md:31-37](../architecture.md) — `blocking_open` 유지. 상한: 리뷰 윈도우 ≤25커밋·로드맵 phase 문서 ≤1(HRM-03), review depth ≤1(HRM-01), 패킷≠수행된 리뷰 이벤트(HRM-04) |
| B4 | 병합 백로그 | main 대비 181커밋 미병합 |
| B5 | 운영자 포화 | 대기 영수증 45건/적용 0, 대기 승인 6건, 대시보드 9일 경과 |

## 6. 자매 문서 충돌

같은 날짜(2026-06-11) 미추적 문서 3건이 상충:

- `claude-saas-factory-controlled-build-plan-request.md`: Hermes = **팩토리**, 통제형 빌드 **지금**
- `hermes-enterprise-saas-specification.md` (1779줄): Hermes = **제품형 SaaS**, 통제형 실행은 Horizon 4
- `hermes-saas-development-pyramid.md` (1496줄): R0~R10 피라미드, 통제형 실행 R10. "TUW" 어휘의 출처

→ [S0-5 판정](09-decision-records/S0-5-identity-and-id-scheme-decision-draft.md) 필요.

## 7. 진짜 결핍 (신규 코드가 필요한 것)

1. 영속 가변 상태 저장소 (제품 레지스트리·상태 원장·영수증 인덱스)
2. 쓰기 레인 실행 끝단 (실 diff 생성 → 영수증 소비 apply → 롤백 실행)
3. 영수증 무결성 (해시 체인·후보 바인딩·attestation)
4. 깔때기 앞단 (실 PRD 인테이크, TUW 분해, 제품별 워크플로 인스턴스화)
5. 통합 승격 상태 기계 (제품별 PS 상태 추적)
6. 실행형 네거티브 픽스처 체계

**결론:** 7개 영역 중 5개는 성숙도 승격 대상이지 신규 기획 대상이 아니다. 신규 코드는 위 6개 결핍에 집중한다.
