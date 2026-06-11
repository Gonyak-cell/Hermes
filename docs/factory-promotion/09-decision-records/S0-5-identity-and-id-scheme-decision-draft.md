# S0-5. 소유자 판정 — 제품 정체성·정본 ID 체계·어휘

> 지위: **OWNER ADJUDICATED** / 2026-06-11 / 초안 작성: Fable 5 (`claude-fable-5[1m]`) / 판정 반영: Codex
> 본 문서는 사용자의 명시 지시("전부 권고안대로")에 따른 human owner 판정 기록이다.

## 1. 문제

같은 날짜(2026-06-11)의 미추적 문서 3건이 제품 정체성과 순서에서 상충:

| 문서 | 정체성 | 통제형 실행 시점 |
|---|---|---|
| `claude-saas-factory-controlled-build-plan-request.md` | Hermes = **SaaS Factory** (control plane) | **지금** (FCORE) |
| `hermes-enterprise-saas-specification.md` | Hermes = 판매형 엔터프라이즈 Work OS SaaS | Horizon 4 |
| `hermes-saas-development-pyramid.md` | 위 사양서의 WBS 피라미드 (R0~R10, TUW) | R10 |

또한 ID 체계 3개가 공존: pNNNN phase 범위 / 피라미드 R0~R10·TUW ID / (본 패키지의) FCORE.

## 2. 제안 판정 (권고안)

### 2.1 정체성

**팩토리-지금, 제품-나중.** Hermes의 현 단계 정체성은 SaaS Factory / Product Operating Platform이다
(저장소 정본: [product-domain-saas-factory.md:11](../../product-domain-saas-factory.md)).
`hermes-enterprise-saas-specification.md`는 **장기 목표 상태 문서**로 지위를 명시하고,
그 Horizon 1~3(멀티테넌시·SSO·빌링 등)은 팩토리가 가동된 후 **팩토리가 만드는 첫 본격 제품**으로 추진한다.
피라미드 15.7의 "R10 선행 인출(pull-forward)" 질문에는 **'예, FCORE가 그 인출이다'**로 답한다 —
단, FCORE의 권한 경계(전 플래그 false, 게이트 개방 별도 판정)를 그대로 유지하는 조건이다.

### 2.2 정본 ID 체계

- 신규 작업: **FCORE** (1 phase = 1 커밋). 새 pNNNN 범위 발행 중단.
- 레거시 pNNNN: source binding 인용 전용 (역사적 참조).
- 기존 package script, artifact directory, schema id는 해당 파일이 실제로 수정되는 트랜치까지 기존 이름을 유지할 수 있다.
  FCORE는 새 작업의 운영 ID이지, 기존 모든 artifact namespace를 한 번에 rename하는 migration이 아니다.
- 어떤 validator도 FCORE 또는 pNNNN 키워드가 특정 roadmap 문서에 존재한다는 사실만으로 pass를 만들 수 없다.
  새 검증은 source binding, schema validation, executable negative fixture, receipt integrity evidence를 우선한다.
- 피라미드 R0~R10·TUW ID: **비구속.** 단 "TUW(Testable Unit of Work)" 어휘는
  FE 트랜치의 분해 단위 명칭으로 차용한다.

### 2.3 정본 어휘 대조표

| 채택 | 비채택(동의어) |
|---|---|
| work packet | Agent Work Contract |
| TUW | (FE 분해 단위) |
| receipt | attestation record (FD 서명 단계 제외) |
| PS0~PS7 | lifecycle stage 기타 표기 |

### 2.4 문서 처분

- 사양서·피라미드 문서는 삭제하지 않고 헤더에 지위 명기(장기 목표/비구속 WBS) 후 커밋.
- 본 패키지([00-README.md](../00-README.md))가 승격 프로그램의 정본 계획 문서가 된다.

### 2.5 저장소 상태 정책

- `data/factory/seed/`는 redacted seed/test fixture와 migration receipt만 추적한다.
- local operational ledger는 gitignore 대상이며 기본 위치는 `data/factory/local/` 또는 `artifacts/factory-state-store/`다.
- tracked seed에 raw confidential material, unredacted human note, secret, external connector payload, raw transcript body를 저장하지 않는다.
- projection은 operational ledger를 우선 읽고 없으면 seed fixture로 fallback하되, fallback 상태를 숨기지 않는다.

## 3. 효력

이 판정은 FCORE 전 기간 유효하며, 변경은 새 판정 영수증으로만 가능하다.

## 4. 소유자 판정 (기입란)

```text
정체성 판정:   [x] 권고안 채택 (팩토리-지금, 제품-나중)   [ ] 기타: ______
ID 체계 판정:  [x] 권고안 채택 (FCORE 정본)              [ ] 기타: ______
어휘 판정:     [x] 권고안 채택                            [ ] 기타: ______
판정자:      jwsuh@amic.kr (human_owner)
판정일:      2026-06-11
영수증 ID:   rcpt-s0-5-identity-id-scheme-20260611
비고:        Hermes는 현재 SaaS 앱 자체가 아니라 SaaS를 만들기 위한 Factory다. 기존 P-range는 source binding으로 유지하고, 신규 실행은 FCORE를 사용한다. split store 정책과 no term-scan-as-pass 원칙을 채택한다.
```
