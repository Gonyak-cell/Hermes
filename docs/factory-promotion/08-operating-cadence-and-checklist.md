# 08. 운영 케이던스와 체크리스트

> 지위: DRAFT v0.1 / 2026-06-11 / 작성: Fable 5 계획 레인 (`claude-fable-5[1m]`)
> 계획 증거이며 승인이 아니다. 검증 기질 사용 금지. ([00-README.md](00-README.md) 공통 고지 적용)

## 1. 리뷰 윈도우 프로토콜 (HRM 상한 운영화)

| 규칙 | 값 | 근거 |
|---|---|---|
| 윈도우당 커밋 | ≤ 25 | HRM-03 ([architecture.md:35](../architecture.md)) |
| 윈도우당 로드맵/phase 문서 | ≤ 1 | HRM-03 |
| review depth | ≤ 1 (리뷰의 리뷰 금지, waiver 영수증 예외) | HRM-01 ([architecture.md:37](../architecture.md)) |
| 계획 문서와 구현 | 동시 커밋 금지 — 계획 선행 커밋·선행 리뷰 | HRM-04 취지 + 본 패키지 규율 |
| 윈도우 종료 조건 | 독립 리뷰 영수증 + finding loop 처분 + 소유자 노트 | REVIEW.md 9단계 |
| 초과 시 | `scope_split_required` — 분할 재디스패치, clean candidate 불인정 | HRM-03 |

## 2. 소유자(단독 운영자) 부하 예산

| 주기 | 작업 | 예산 |
|---|---|---|
| 윈도우당 | 트랜치 리뷰 패킷 검토 + 판정 | 1~3시간 |
| 주당 | 대기 영수증 큐 처분 | 30분, 큐 깊이 상한 10건 |
| 스테이지 경계 | 게이트/판정 영수증 | 건당 30분 |
| 일회성 (Stage 1) | 기존 대기 영수증 45건 일괄 처분 | 2시간 |

**규칙:** 대기 큐 > 10건이면 신규 phase 착수 금지 (생산보다 처분 우선).
워크벤치 데이터 신선도: 마지막 재생성 7일 초과 시 stale 배지 표시, 신규 판정 금지.

## 3. 구현 착수 전 체크리스트 (Codex + 소유자)

1. [ ] F0.1~F0.5 완료: 누락 리뷰 영수증 2건의 receipt-integrity preflight 또는 이번 한정 owner no-Opus exception, multi-engine source handoff 해소/조건부 waiver, S0-1~S0-5 판정 영수증 완료
2. [ ] 본 패키지 Codex 레인 검토 노트 존재 (구현 관점 이의 포함)
3. [ ] split store 정책 확정: tracked `data/factory/seed/` vs local operational ledger, raw/confidential/secret 비추적 보장
4. [ ] 10개 네거티브 플래그 전부 소스 리터럴 false 확인, 데이터 구동 권한 플립 경로 없음
5. [ ] 영수증 봉투에 `payload_sha256`/`prev_entry_hash`/`engine_resolved_model_id` 포함 확인
6. [ ] FA 네거티브 픽스처가 실행형임을 확인 (하드코딩 `actual_result` 금지)
7. [ ] 레거시 5개 `--check` 무손상 유지 계획 확인 (FA.5)
8. [ ] 교집합 리뷰 구도 확인: 본 패키지 작성 엔진(Fable 세션)은 FA 구현의 독립 리뷰에서 제외
9. [ ] phase=커밋 1:1, 윈도우 ≤25커밋 계획 확인
10. [ ] 영역 5(커넥터) 제외 확인 — F0.1 영수증 확보로 한정
11. [ ] 파일럿 순서 확정 (hermes_harness → zendd → hr → law_firm; law_firm 선행조건 4항목)
12. [ ] 중단 조건 5항목 ([02-master-promotion-plan.md](02-master-promotion-plan.md) §5) 주지

## 4. 트랜치별 종결 의식 (매 트랜치 반복)

1. 트랜치 freeze 아티팩트 생성 (canonical run 해시 포함)
2. 리뷰 패킷 작성 → 독립 리뷰 디스패치 (`is_claude_review_event=false`인 패킷과
   수행된 리뷰 이벤트의 분리 유지 — HRM-04)
3. 독립 리뷰 영수증 수령 (durable raw JSON + normalized findings)
4. blocking finding → 수정 → finding별 재검증
5. 소유자 판정 노트 → 다음 트랜치 개시

## 5. 보고 체계

- 워크벤치 `/api/factory/stage`가 단일 진실 (스테이지 진행, 게이트 상태, 큐 깊이, 신선도).
- 주간 1회 상태 스냅샷을 상태 원장에 기록 (수동 보고서 작성 금지 — 문서공장 방지).
