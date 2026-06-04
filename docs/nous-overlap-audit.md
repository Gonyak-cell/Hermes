# Nous Overlap Audit Phase Ledger

이 ledger는 `P2041-P2120` 구간을 다룹니다. 목적은 새 실행 기능을 여는 것이 아니라, `P1201-P2040`에서 만든 Hermes Harness 표면이 Nous Hermes Agent의 공개 런타임/API/툴/메모리/대시보드 표면과 어디서 겹치는지 먼저 분류하는 것입니다.

## Supersession Note

`platform:nous-overlap-audit` remains valid as historical overlap evidence. Its future-facing adapter-only policy is superseded by `platform:nous-non-adoption-reversal` because the product decision is now `Nous adopted = false`.

## Objective

`P2041` limited execution은 `platform:nous-overlap-audit`가 통과하고 별도 Nous adapter-only spec이 승인될 때까지 suspended 상태입니다. 이 구간에서는 Hermes가 Nous Agent 런타임, MCP gateway, session memory, jobs scheduler, dashboard, tool runner를 재구현하지 않는다는 결정을 데이터 계약으로 남깁니다.

## Phase Slices

| Range | Slice | Goal |
|---|---|---|
| `P2041-P2060` | Source Inventory | Nous 공식 문서 표면을 source row로 고정 |
| `P2061-P2080` | Surface Classification | `P1201-P2040` Harness 표면을 keep/adapter/deprecate/drop으로 분류 |
| `P2081-P2100` | P2041 Suspension Gate | `P2041` limited execution 및 후속 실행 tranche를 BLOCK으로 고정 |
| `P2101-P2120` | Adapter Spec Handoff | 다음 허용 작업을 Nous adapter-only spec 작성으로 제한 |

## Source

- Source command: `platform:kernel-harness-native-cutover-freeze`
- Source phase: `P1961-P2040`
- Required status: `ready_for_platform_kernel_harness_native_cutover_freeze`
- Required suspension: `p2041_suspended_pending_nous_overlap_audit`

## Guard Rules

- `P2041` limited execution is suspended pending Nous overlap audit.
- No direct Nous runtime call is allowed in this audit.
- No API server, dashboard, MCP gateway, memory store, jobs scheduler, or tool runner is reimplemented here.
- Hermes may keep governance contracts: domain policy, claim/evidence/gate, receipt hashes, reviewer notes, and PASS/BLOCK adjudication.
- Any future execution work must be adapter-only: pre-run request packet, external Nous run, event/output hash capture, and post-run Hermes adjudication.

## Completion Criteria

```text
P2040 freeze ready
P2041 suspension declared
official Nous source rows present
P1201-P2040 surfaces classified
future execution phases blocked
unsafe flag count = 0
ready_for_nous_overlap_audit
```

## Validation

Run:

```bash
npm run platform:nous-overlap-audit -- --check
```
