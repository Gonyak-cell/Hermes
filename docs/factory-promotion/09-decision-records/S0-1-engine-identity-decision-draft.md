# S0-1. 소유자 판정 — 리뷰 엔진 정체성

> 지위: **OWNER ADJUDICATED** / 2026-06-11 / 초안 작성: Fable 5 (`claude-fable-5[1m]`) / 판정 반영: Codex
> 본 문서는 사용자의 명시 지시("전부 권고안대로")에 따른 human owner 판정 기록이다.

## 1. 문제

- CLAUDE.md와 다수 검증기가 리뷰 엔진을 `claude_code_opus_max` 상수로 고정
  ([src/connector-external-app-governance.mjs:279-283](../../../src/connector-external-app-governance.mjs) 등).
- 현재 사용 가능한 엔진에는 Opus 계열 외 Fable 5가 포함되며, 본 승격 패키지 자체가 Fable 5 산출물.
- **Opus가 아닌 엔진이 `review_engine: "claude_code_opus_max"` 영수증을 작성하면 그 자체가 위조**이며,
  중단 조건(영수증 엔진 필드와 실제 엔진 불일치)에 해당한다.
- F0.1(누락 리뷰 영수증 2건 확보)은 이 판정 없이 진행 불가.

## 2. 선택지

### 선택지 A (권장 — 즉시 차단 해제, 코드 변경 없음)

누락 리뷰 2건(connector-external-app-governance, execution-write-authority-maturity)을
**실제 Claude Code Opus 세션**(현행 최신 Opus, 예: Opus 4.8)으로 수행하고,
영수증에 resolved model id 원문 + prompt/output sha256을 기록한다.
CLAUDE.md와 검증기는 현행 유지.

- 장점: 코드 변경 0, 기존 계약과 완전 정합, 즉시 실행 가능.
- 단점: 향후 엔진 다변화 시마다 같은 문제 재발.

### 선택지 B (중기 — FD에서 병행 권장)

검증기를 `review_engine` 허용목록 + `engine_resolved_model_id` 원문 필수 검증으로 갱신하고
CLAUDE.md를 개정한다. 갱신 자체가 Codex 구현 + 독립 리뷰 + 소유자 판정을 거친다.

- 장점: 다중 엔진 미래 대응, 영수증 봉투 v1([04-target-architecture.md](../04-target-architecture.md) §3.3)과 정합.
- 단점: 코드·계약 변경 필요, F0.1이 그만큼 지연.

### 권고

**지금은 A, FD 트랜치에서 B를 정식 도입.** 두 선택지 모두에서 라벨 위조 금지 불변은 동일하게 적용.

## 3. 부수 규칙 (판정과 무관하게 즉시 유효)

1. 본 패키지를 포함한 Fable 산출물은 `claude_code_opus_max`로 등록 금지.
2. 모든 영수증의 `engine_resolved_model_id`는 실행 엔진의 resolved model id 원문.
3. 계획 작성 엔진(이 패키지의 Fable 세션)은 FCORE 구현의 독립 리뷰어가 될 수 없다.

## 4. 소유자 판정 (기입란)

```text
판정:        [ ] 선택지 A   [ ] 선택지 B   [x] A 후 B   [ ] 기타: ______
판정자:      jwsuh@amic.kr (human_owner)
판정일:      2026-06-11
영수증 ID:   rcpt-s0-1-engine-identity-20260611
비고:        F0.1 누락 리뷰 2건은 기존 validator와 정합되는 실제 Opus 계열 독립 리뷰로 처리한다. Fable 5 산출물은 계획 증거로만 사용하며 claude_code_opus_max receipt로 등록하지 않는다. FD에서 engine_resolved_model_id 기반 다중 엔진 검증기로 전환한다.
```
