# Review API

`Review API`는 `review-dashboard.json`을 읽기 전용 HTTP API와 정적 HTML로 노출한다. 아직 decision 적용, merge, 발송 같은 protected action은 실행하지 않는다. 이 단계의 목적은 Dashboard/API 계층의 첫 서버 경계를 만드는 것이다.

## 실행

먼저 dashboard 산출물을 만든다.

```bash
npm run dashboard:build
```

그 다음 API를 띄운다.

```bash
npm run api:serve
```

기본 주소:

- `http://127.0.0.1:4177/`
- `http://127.0.0.1:4177/api/dashboard`

## 주요 Route

- `GET /`: 정적 dashboard HTML
- `GET /health`: dashboard artifact 존재 여부와 overall status
- `GET /api`: route index
- `GET /api/dashboard`: 전체 `review-dashboard.v1`
- `GET /api/summary`: summary만 반환
- `GET /api/stages`: control plane stage 상태
- `GET /api/actions`: action queue
- `GET /api/sources`: dashboard source artifact 목록
- `GET /api/packs`: domain pack registry의 pack 목록
- `GET /api/capabilities`: domain pack capability 계약 목록
- `GET /api/artifacts`: output artifact catalog의 산출물 목록
- `GET /summary.md`: Markdown 요약

`/api/actions`와 `/api/stages`는 `status`, `priority`, `source_stage`, `stage_id`, `source_id`, `available`, `limit` query를 지원한다. `/api/packs`와 `/api/capabilities`는 `pack_id`, `capability_id`, `enabled`, `valid`, `limit` query를 지원한다. `/api/artifacts`는 `artifact_id`, `artifact_type`, `domain_pack`, `delivery_state`, `approval_status`, `status`, `limit` query를 지원한다.

## 검증

```bash
npm run api:smoke
```

smoke test는 임시 포트에서 API를 띄운 뒤 `/health`, `/api`, `/api/dashboard`, `/api/stages`, `/api/actions`, `/`를 확인하고 서버를 닫는다.

## Goal 내 위치

이 단계는 `/goal`의 `dashboard/API` 완성 기준 중 API의 첫 얇은 slice다. 쓰기는 아직 금지하고, 모든 상태는 기존 Event/Audit/Approval 산출물에서 파생된 읽기 전용 view로만 제공한다.
