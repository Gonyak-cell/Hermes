# 04. 목표 아키텍처 + 데이터 계약 초안

> 지위: DRAFT v0.1 / 2026-06-11 / 작성: Fable 5 계획 레인 (`claude-fable-5[1m]`)
> 계획 증거이며 승인이 아니다. 검증 기질 사용 금지. ([00-README.md](00-README.md) 공통 고지 적용)
> 본 문서의 JSON Schema는 **초안**이며, 실제 `schemas/` 반입은 FA.1에서 Codex 레인이 수행한다.

## 1. 컴포넌트 (신규는 굵게)

| 컴포넌트 | 설명 | 트랜치 |
|---|---|---|
| **Factory State Store** | split store. 추적되는 `data/factory/seed/`에는 redacted seed/test fixture와 migration receipt만 두고, local operational ledger는 기본 `data/factory/local/` 또는 `artifacts/factory-state-store/` 아래 gitignore 대상이다. 해시 체인 append-only JSONL 원장 3종: `products.jsonl`, `state-transitions.jsonl`, `receipts-index.jsonl`. node 표준 라이브러리만, 외부 서비스 없음 | FA |
| **제품 레지스트리** | `const` 배열 대체. 전 레코드에 `product_id` 네임스페이스, 도메인 팩 셋, 데이터 분류 | FA |
| **승격 상태 기계 (PS)** | 제품별 라이프사이클 PS0~PS7. 전이 = 영수증 검증 핸들러만이 append하는 데이터 이벤트. v0은 PS0~PS2 핸들러만 존재 | FA, FB |
| **영수증 인테이크 + 검증기** | 파일 드롭(기존 패턴) + F0 preflight(reviewed commit SHA, prompt/output SHA256, resolved model id, receipt file SHA256, scope id, finding count) + 스키마/`payload_sha256`/`prev_entry_hash`/엔진 필드/후보 해시 바인딩 검증 | F0, FA, FD |
| **후보 레인** | 격리 워크트리 내 실 diff 패킷 + 롤백 계획 + 실행된 preflight. apply 없음 | FC |
| **apply 엔진 (닫힘)** | 검증 영수증 + 바인딩 후보 해시 → 워크트리 내 apply + post-apply 검증 + 롤백 검증. 활성화 플래그는 소스 리터럴 false로 도달 불가 | FD |
| 워크벤치 | 기존 `review-api.mjs` 확장: 읽기전용 `/api/factory/*` GET + 통합 HTML 뷰. GET/HEAD 전용 | FB |
| 기존 projection 평면 | 변경 없음. 선별 모듈을 저장소 소스로 재지향(fixture 폴백) → 파생 뷰 전환 | FA.5~ |

## 2. 제품 라이프사이클 상태 기계 (PS)

```
PS0 registered → PS1 control-plan-bound → PS2 read-only-factory → PS3 candidate-generation
→ PS4 receipt-gated-apply → PS5 limited-execution → PS6 release-candidate → PS7 deploy-ready
```

- 전이는 단방향이며 영수증 이벤트로만 발생. 역전이는 소유자 영수증 동반 명시 강등 이벤트로만.
- v0(FA): PS0~PS2 핸들러만. PS3+ 전이는 (a) 핸들러 부재, (b) 권한 플래그 소스 false의 **이중 차단**.
- PS3+ 핸들러는 대응 게이트(G1a/G1b/G2/G3) 개방 커밋과 함께만 추가된다.
- 원장은 *상태*를 기록한다. *권한*은 영원히 소스 리터럴이다. 원장 값이 권한 판단에 쓰이는 코드는 금지.

## 3. 데이터 계약 초안

### 3.1 `product-record.v1` (products.jsonl 행)

```json
{
  "$id": "factory-product-record.v1",
  "type": "object",
  "required": ["record_id", "product_id", "title", "domain_pack_set", "data_classification",
               "created_by_receipt_id", "payload_sha256", "prev_entry_hash", "recorded_at"],
  "additionalProperties": false,
  "properties": {
    "record_id": { "type": "string", "pattern": "^prd-[a-z0-9-]+$" },
    "product_id": { "type": "string", "pattern": "^project\\.[a-z0-9_]+$" },
    "title": { "type": "string", "minLength": 1 },
    "domain_pack_set": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
    "data_classification": { "type": "string", "enum": ["internal", "personal", "client_confidential"] },
    "template_id": { "type": ["string", "null"] },
    "workspace_ref": { "type": ["string", "null"], "description": "PS3 이전에는 null" },
    "created_by_receipt_id": { "type": "string" },
    "payload_sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "prev_entry_hash": { "type": ["string", "null"], "pattern": "^[a-f0-9]{64}$" },
    "recorded_at": { "type": "string", "format": "date-time" }
  }
}
```

### 3.2 `product-state-transition.v1` (state-transitions.jsonl 행)

```json
{
  "$id": "factory-product-state-transition.v1",
  "type": "object",
  "required": ["transition_id", "product_id", "from_state", "to_state",
               "receipt_id", "receipt_sha256", "payload_sha256", "prev_entry_hash", "recorded_at"],
  "additionalProperties": false,
  "properties": {
    "transition_id": { "type": "string", "pattern": "^pst-[a-z0-9-]+$" },
    "product_id": { "type": "string", "pattern": "^project\\.[a-z0-9_]+$" },
    "from_state": { "type": "string", "enum": ["PS0","PS1","PS2","PS3","PS4","PS5","PS6","PS7"] },
    "to_state":   { "type": "string", "enum": ["PS0","PS1","PS2","PS3","PS4","PS5","PS6","PS7"] },
    "direction": { "type": "string", "enum": ["promote", "demote"], "default": "promote" },
    "receipt_id": { "type": "string", "description": "전이를 승인한 영수증. 필수" },
    "receipt_sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "evidence_refs": { "type": "array", "items": { "type": "string" } },
    "payload_sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "prev_entry_hash": { "type": ["string", "null"], "pattern": "^[a-f0-9]{64}$" },
    "recorded_at": { "type": "string", "format": "date-time" }
  }
}
```

### 3.3 `factory-receipt-envelope.v1` (영수증 공통 봉투)

```json
{
  "$id": "factory-receipt-envelope.v1",
  "type": "object",
  "required": ["receipt_id", "receipt_kind", "issuer_role", "engine_resolved_model_id",
               "scope", "payload_sha256", "issued_at"],
  "additionalProperties": false,
  "properties": {
    "receipt_id": { "type": "string", "pattern": "^rcpt-[a-z0-9-]+$" },
    "receipt_kind": { "type": "string",
      "enum": ["human_adjudication", "independent_review", "migration", "waiver", "gate_opening"] },
    "issuer_role": { "type": "string", "enum": ["human_owner", "independent_reviewer", "codex_implementer"] },
    "engine_resolved_model_id": { "type": "string",
      "description": "검토/작성 엔진의 resolved model id 원문. 인간 판정이면 'human'. 라벨 위조 금지" },
    "prompt_sha256": { "type": ["string", "null"], "pattern": "^[a-f0-9]{64}$" },
    "output_sha256": { "type": ["string", "null"], "pattern": "^[a-f0-9]{64}$" },
    "scope": { "type": "object", "required": ["product_id", "subject_ref"],
      "properties": {
        "product_id": { "type": ["string", "null"] },
        "subject_ref": { "type": "string", "description": "대상 phase/후보/판정 ID" },
        "bound_candidate_sha256": { "type": ["string", "null"], "pattern": "^[a-f0-9]{64}$",
          "description": "후보 패킷을 게이트하는 영수증은 필수 (FC부터)" } } },
    "findings": { "type": "array", "items": { "type": "object" } },
    "unresolved_finding_count": { "type": "integer", "minimum": 0 },
    "payload_sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "issued_at": { "type": "string", "format": "date-time" },
    "human_note": { "type": ["string", "null"],
      "description": "보호 출력 게이트에는 필수 (운영 원칙: 모든 보호 출력에 인간 리뷰 노트)" }
  }
}
```

## 4. 영수증 무결성 설계 (단계적)

| 단계 | 메커니즘 | 도입 트랜치 |
|---|---|---|
| 0 | F0 receipt-integrity preflight: 기존 4필드 리뷰 영수증이라도 reviewed commit SHA, prompt SHA256, raw output SHA256, resolved model id, receipt file SHA256, scope id, unresolved finding count를 별도 검증 노트에 바인딩해야 unblock 근거가 됨 | F0 |
| 1 | `payload_sha256` + `prev_entry_hash` 원장 체인 (조작 시 체인 단절 감지) | FA |
| 2 | `bound_candidate_sha256` — 영수증을 특정 후보 패킷 해시에 바인딩 (영수증 재사용/전용 차단) | FC |
| 3 | 소유자 attestation (오프라인 서명 또는 소유자 전용 기록 절차) + replay 방지 nonce | FD |
| 4 | 기존 게이트(`review_engine` 등 필드 4개 검사)를 봉투 검증기로 교체 | FD |

**불변:** 어떤 영수증도 자신이 게이트하는 대상의 해시에 바인딩되지 않으면 무효.
`engine_resolved_model_id`는 항상 원문 — 라벨 위조(예: 비-Opus 출력에 `claude_code_opus_max` 기재)는 즉시 중단 조건.

## 5. 워크벤치 어포던스 계약

| PS 상태 | 허용 어포던스 | 금지 어포던스 |
|---|---|---|
| PS0~PS2 | 조회, 상태/블로커/다음 액션 표시, 후보 매니페스트 미리보기 | 모든 쓰기 버튼/라우트 |
| PS3 | + diff 패킷 뷰어, 후보 해시 표시 | apply/merge/deploy/write 버튼, POST 라우트 |
| PS4+ | (게이트 개방 프로그램에서 별도 계약 갱신) | — |

- 본 프로그램 전 구간: **GET/HEAD 전용**. 신규 라우트마다 POST→405 실행형 픽스처 의무
  (기존 `work-os-read-only-api-ui-smoke` 규율 승계).
- 영수증 입력 경로는 파일 드롭 유지. UI 영수증 입력 폼은 본 프로그램 범위 밖.

## 6. 데이터 격리 설계

1. 전 원장 행에 `product_id` 필수. 스코프 없는 읽기 API 금지.
2. 교차 제품 읽기 시도 → 거부 — **실행형 픽스처로 검증**.
3. `data_classification: client_confidential` (law_firm_os 등) 레코드는 워크벤치 응답에서 메타데이터만 노출, 본문 ref 비노출.
4. `cross_project_data_mixing_allowed=false` 를 저장소 boundary 산출물에 승계.
5. 보존/삭제: client_confidential 레코드의 삭제는 소유자 영수증 동반 tombstone 이벤트로만 (행 물리 삭제 금지 — 체인 보존).

## 7. 저장소 추적 정책

1. `data/factory/seed/`는 커밋 가능한 redacted seed/test fixture 전용이다.
2. local operational ledger는 기본적으로 `data/factory/local/` 또는 `artifacts/factory-state-store/`에 두며 gitignore 대상이다.
3. tracked seed에는 raw confidential material, unredacted human note, secret, external connector payload, raw transcript body를 저장하지 않는다.
4. seed fixture를 갱신하는 migration command는 output hash와 migration receipt를 남겨야 한다.
5. projection은 operational ledger를 우선 읽되, 없으면 seed fixture로 fallback한다. fallback 사용 여부는 API/summary에 표시한다.
