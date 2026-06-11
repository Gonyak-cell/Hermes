# S0-2. 소유자 판정 — multi-engine-orchestration 상류 블로커 처분

> 지위: **OWNER ADJUDICATED** / 2026-06-11 / 초안 작성: Fable 5 (`claude-fable-5[1m]`) / 판정 반영: Codex
> 본 문서는 사용자의 명시 지시("전부 권고안대로")에 따른 human owner 판정 기록이다.

## 1. 문제

- `artifacts/multi-engine-orchestration/latest/multi-engine-orchestration.json`이
  `ready_for_p15001_handoff: false`를 보고한다 (실측 확인, 2026-06-11).
- `saas-factory-mode`(P15001–P15400)가 이 아티팩트를 source binding으로 소비하므로
  **P15001–P16600 팩토리 체인 전체가 cascade 차단** 상태다.
- 이것은 코드 결핍이 아니라 상류 readiness 상태이며, FCORE는 이 체인의 성숙도 승격을 전제로 한다.

## 2. 선택지

### 선택지 A — 정공 해소

Codex 레인이 multi-engine-orchestration의 미충족 readiness 항목을 진단하고 정당하게 충족시킨다.
(P5401–P5800 multi-engine 계약: engine registry, role authority matrix, routing decision 등의
행 누락/불일치가 원인일 가능성이 높음 — 정확한 미충족 행은 Codex 진단 1커밋으로 특정.)

- 장점: 체인 무결성 유지, 우회 없음.
- 단점: 진단 전 공수 불확정.

### 선택지 B — 소유자 면제 (waiver)

소유자가 해당 블로커를 명시 면제하는 영수증(`receipt_kind: waiver`)을 발행하고,
saas-factory-mode의 source binding 행이 면제 영수증을 인식하도록 1커밋 갱신한다.

- 장점: 빠름.
- 단점: "상류 fixture를 조용히 고쳐 게이트를 여는" 패턴의 선례가 됨 — 권장하지 않음.
  채택 시 면제 사유·만료 조건을 영수증에 명기해야 한다.

### 선택지 C — FCORE corrective-baseline waiver (현 판정)

FCORE를 P11601-P15000 blocked chain을 숨기거나 PASS로 바꾸는 우회가 아니라, 해당 chain을 수습하기 위한
새 corrective baseline으로 인정한다. blocked 상태는 visible 상태로 보존하고, FA는 seed/local store,
receipt preflight, read-only projection 같은 권한 비개방 작업으로만 제한한다.

- 장점: 실제 개선 착수 가능, blocker 은폐 없음, 권한 개방 없음.
- 단점: 기존 P-chain을 strict하게 닫은 것은 아니므로 waiver expiry와 재검토 조건이 필수다.

### 권고

**선택지 A.** 단, Codex 진단 결과 충족 비용이 1 리뷰 윈도우를 초과하면 B로 전환을 재판정.
어느 쪽이든 **상류 아티팩트 JSON을 손으로 고쳐 ready로 만드는 행위는 금지** (중단 조건 2 해당).

Codex v0.1.1 보완 후 현 판정은 선택지 C다. FCORE가 corrective baseline 역할을 하되, source-chain blocker는
숨기지 않고 [../f0-readiness-baseline.md](../f0-readiness-baseline.md)에 기록된 상태로 보존한다.

## 3. 실행 항목 (판정 후)

1. Codex: `npm run platform:multi-engine-orchestration -- --check` 실행, 미충족 행 목록 캡처 (진단 1커밋).
2. 판정에 따라 해소 구현 또는 waiver 영수증 + binding 갱신.
3. `npm run platform:saas-factory-mode -- --check`에서 `source.handoff` 행 pass 확인.

## 4. 소유자 판정 (기입란)

```text
판정:        [ ] 선택지 A   [ ] 선택지 B   [ ] A 시도 후 B   [x] 기타: 선택지 C corrective-baseline waiver
판정자:      jwsuh@amic.kr (human_owner)
판정일:      2026-06-11
영수증 ID:   rcpt-s0-2-corrective-baseline-waiver-20260611
면제 시 만료 조건: FA.6 freeze 전 재검토. FCORE가 blocked P-chain을 숨기거나 ready로 위조하지 않았는지 확인. project creation, repo write, connector write, command execution, deployment, production PASS, enterprise PASS, AI final approval은 계속 false.
```
