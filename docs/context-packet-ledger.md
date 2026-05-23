# Context Packet Ledger

`Context Packet Ledger`는 각 workflow/agent run에 실제로 전달 가능한 context를 capability manifest, runtime adapter, policy snapshot, matter boundary 기준으로 컴파일한다. 이 단계는 LLM prompt 자체를 만들지는 않고, 어떤 자료가 어떤 mode로 들어갈 수 있는지와 retrieval filter가 완전한지만 검증한다.

```bash
npm run context:packets
```

기본 입력:

- `artifacts/domain-packs/latest/domain-pack-registry.json`
- `examples/core/runtime-adapters.json`
- `artifacts/policy-snapshots/latest/policy-snapshot-ledger.json`
- Law Firm, Personal Dev, Creative Document, First Vertical Slice artifact

출력:

- `context-packet-ledger.json`
- `context-packets.json`
- `context-items.json`
- `retrieval-filters.json`
- `summary.md`

## 계약

- `context_packets`: workflow run과 agent run별 context packet
- `context_items`: packet에 포함된 resource metadata, source span, evidence, fact, issue, output artifact reference
- `retrieval_filters`: tenant, matter, wall, classification 같은 강제 filter
- `validation.errors`: runtime/capability 불일치, classification 차단, missing filter, 빈 context packet

## 설계 원칙

- raw/redacted 가능 여부는 runtime adapter의 `data_access`와 capability의 `data_policy`가 동시에 허용해야 한다.
- 로펌 P2 자료는 redaction-required capability를 통과할 때 redacted packet으로만 표시된다.
- 외부 문서, VDR, 이메일, 메시지는 instruction이 아니라 untrusted data로만 취급한다.
- Claude Code와 Codex packet도 capability가 허용한 runtime인지 검증하고, `resource_metadata` 중심의 최소 context만 둔다.

## Dashboard/API

Dashboard는 `context_packet_ledger` stage를 표시한다. Review API는 다음 route를 제공한다.

- `GET /api/context-packet-ledgers`
- `GET /api/context-packets`
- `GET /api/context-items`
- `GET /api/context-retrieval-filters`

예:

```bash
node scripts/review-api.mjs --once "/api/context-packets?runtime_id=codex"
node scripts/review-api.mjs --once "/api/context-packets?context_mode=redacted"
node scripts/review-api.mjs --once "/api/context-retrieval-filters?filter_status=complete"
```

## Goal 내 위치

이 단계는 `/goal`의 Context Builder / Retrieval Compiler 계층을 artifact로 고정한다. Runtime Adapter가 직접 DB나 파일을 마음대로 읽는 구조가 아니라, Harness가 먼저 matter wall, classification, redaction, allowed context type을 확정한 뒤 실행 주체에 넘기는 구조로 가는 얇은 vertical slice다.
