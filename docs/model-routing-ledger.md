# Model Routing Ledger

`Model Routing Ledger`는 Context Packet Ledger가 만든 packet을 실제 runtime/model boundary에 보낼 수 있는지 판단한다. 여기서는 외부 provider 호출을 실행하지 않고, policy matrix와 policy snapshot에 근거해 local/external route, 승인 필요 여부, redaction 상태, audit 필요성을 원장으로 남긴다.

```bash
npm run model:routing
```

기본 입력:

- `artifacts/context-packets/latest/context-packet-ledger.json`
- `artifacts/policy-matrix/latest/policy-matrix-catalog.json`
- `artifacts/policy-snapshots/latest/policy-snapshot-ledger.json`
- `examples/core/runtime-adapters.json`

출력:

- `model-routing-ledger.json`
- `routing-decisions.json`
- `summary.md`

## 계약

- `routing_decisions`: context packet별 runtime/model route decision
- `route_status`: `ready`, `approval_required`, `blocked`
- `route_mode`: `local_allowed`, `external_allowed_with_audit`, `external_requires_approval`, `blocked` 등
- `external_transfer`: runtime adapter가 외부 실행 경계를 가지는지
- `redaction_status`: 외부 전송 전 redaction이 적용되었는지
- `required_gates`: policy matrix, snapshot, runtime adapter에서 합쳐진 gate 목록

## 설계 원칙

- Context packet이 `ready`여도 model route가 자동으로 허용되는 것은 아니다.
- 외부 runtime은 classification별 `external_model_policy`를 반드시 따른다.
- P2 이상 자료가 외부로 나가려면 approval 또는 redaction gate가 먼저 보여야 한다.
- Claude Code와 Codex는 P1 이하에서만 `external_allowed_with_audit`로 취급하고, 그 외는 policy가 막는다.
- 모든 route decision은 audit-required로 남긴다.

## Dashboard/API

Dashboard는 `model_routing_ledger` stage를 표시한다. Review API는 다음 route를 제공한다.

- `GET /api/model-routing-ledgers`
- `GET /api/model-routing-decisions`

예:

```bash
node scripts/review-api.mjs --once "/api/model-routing-decisions?runtime_id=codex"
node scripts/review-api.mjs --once "/api/model-routing-decisions?external_transfer=true"
node scripts/review-api.mjs --once "/api/model-routing-decisions?route_status=blocked"
```

## Goal 내 위치

이 단계는 `/goal`의 Model Policy, Runtime Adapter, Gate/Approval 사이를 잇는다. Context Builder가 “무엇을 넣을 수 있는가”를 결정했다면, Model Routing Ledger는 “그 context를 어느 실행 경계로 보낼 수 있는가”를 별도 계약으로 고정한다.
