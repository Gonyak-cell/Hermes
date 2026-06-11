# S0-3. 소유자 판정 — HRM-01/03/04 발견사항 처분

> 지위: **OWNER ADJUDICATED** / 2026-06-11 / 초안 작성: Fable 5 (`claude-fable-5[1m]`) / 판정 반영: Codex
> 본 문서는 사용자의 명시 지시("전부 권고안대로")에 따른 human owner 판정 기록이다.

## 1. 문제

Claude 리뷰 발견사항 HRM-01/03/04가 `blocking_open`으로 유지 중이며
([architecture.md:31-37](../../architecture.md)), REVIEW.md:25-26은 "미해결 critical/high finding은
소유자가 영수증과 함께 명시 판정하지 않는 한 closeout을 차단"한다고 규정한다.
FCORE라는 새 프로그램을 이 발견사항들이 open인 상태에서 개시할 수 있는지의 판정이 필요하다.

## 2. 발견사항 요약과 제안 처분

| ID | 내용 | 저장소가 이미 구축한 상한 | 제안 처분 |
|---|---|---|---|
| HRM-01 | 리뷰의 리뷰 연쇄 (review-of-review-of-review) | `max_review_depth <= 1`, 파일경로당 review 토큰 ≤2 (P66401–P66800) | 상한을 FCORE **구속 정책으로 채택**. finding 자체는 focused re-review 완료까지 open 유지 |
| HRM-03 | 113커밋 무리뷰 윈도우 | 윈도우 ≤25커밋, 로드맵 phase 문서 ≤1 (P66001–P66400) | 동일 — FCORE 전 윈도우에 강제. 초과 시 `scope_split_required` |
| HRM-04 | 리뷰 요청 패킷을 수행된 리뷰 증거로 오인 | `is_claude_review_event` boundary manifest (P65601–P66000) | 동일 — FCORE 리뷰 패킷에 boundary 필드 의무화 |

## 3. 판정 모드 선택지

### 모드 A — 선해소 (remediate-first)

진행 중인 focused re-review 파이프라인(P69601–P72000)이 HRM 3건을 닫을 때까지 FCORE 개시를 보류.

- 장점: 가장 보수적. 단점: re-review 자체가 S0-1 엔진 판정에 의존 — 교착 위험.

### 모드 B — 상한 채택 병행 (parallel-with-adopted-caps) — 권고

HRM 3건을 open으로 **보존**하되, 각 finding이 요구한 상한을 FCORE의 구속 정책으로 채택하고
(§2 표), focused re-review는 F0.1 영수증 확보 후 병행 진행한다.
근거: HRM 발견의 본질은 "상한 없는 자동 생성"이며, FCORE는 그 상한을 설계에 내장했다.
finding을 닫는 것이 아니라 **finding의 교훈을 강제하는 것**이므로 은폐가 아니다.

### 모드 C — 면제

소유자가 3건을 위험 수용으로 종결. — 권장하지 않음 (시스템 신뢰 기반 훼손).

## 4. 소유자 판정 (기입란)

```text
판정 모드:   [ ] A 선해소   [x] B 병행+상한채택 (권고)   [ ] C 면제
HRM-01 처분: [x] open 유지+상한 채택   [ ] 기타: ______
HRM-03 처분: [x] open 유지+상한 채택   [ ] 기타: ______
HRM-04 처분: [x] open 유지+상한 채택   [ ] 기타: ______
판정자:      jwsuh@amic.kr (human_owner)
판정일:      2026-06-11
영수증 ID:   rcpt-s0-3-hrm-caps-20260611
비고:        finding은 닫지 않고 FCORE 운영 상한으로 강제한다. review depth <= 1, review window <= 25 commits, roadmap phase doc <= 1, request packet과 performed review evidence 분리를 적용한다.
```
