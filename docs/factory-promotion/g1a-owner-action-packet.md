# G1a Owner Action Packet

`factory:g1a-owner-action-packet`는 G1a owner gate-opening chain의 다음
human-owner 작업을 한 표면으로 모으는 read-only action packet이다. 이 패킷은
후보 카드, owner action row, owner work order, promotion closeout waiting
blocker를 함께 보여주지만, owner 대신 후보를 선택하거나 receipt에 서명하거나
source literal을 변경하거나 G1a를 열지 않는다.

```bash
npm run factory:g1a-owner-action-packet
npm run factory:g1a-owner-action-packet -- --check --require-pass
node scripts/review-api.mjs --once /api/factory/g1a-owner-action-packet
```

기본 출력은 `artifacts/factory-g1a-owner-action-packet/latest/`이다.

- `factory-g1a-owner-action-packet.json`
- `owner-candidate-action-cards.json`
- `owner-action-rows.json`
- `owner-work-order.json`
- `boundary.json`
- `validation-items.json`
- `summary.md`

## Current Evidence

아래 hash는 `generated_at: 2026-06-12T06:55:09.906Z`가 포함된 point-in-time
snapshot hash다. artifact를 새로 생성하면 `generated_at` 때문에 hash가
달라질 수 있으며, 이는 곧바로 tampering 증거를 뜻하지 않는다.

Current generated artifact hashes:

| Artifact | SHA-256 |
|---|---|
| `factory-g1a-owner-action-packet.json` | `c80abc1bb2d085ed0bc513fdd4661ef1e1df41da83d2f337cfe099e232908bb0` |
| `owner-candidate-action-cards.json` | `833992e01bf88dc9af9615ec085d23334d5757eebbbe77c5c0a91d4aacdbb410` |
| `owner-action-rows.json` | `295fefc31b680857d667b282c727175e9646fae8d5ffae31a523ac3149e66006` |
| `owner-work-order.json` | `14f1f0c0d7d2359608f7f0d2e4cdbc7d554a61aa98ae088211c526c94ec690f6` |
| `boundary.json` | `5bb05104b4e06e8879c4a6e885adf1e208cf99093b1e6e27e4c8f6f71988041b` |
| `validation-items.json` | `a57bc957c2ffddb244a9b335265ae2b7016ce0ea728645b04d3954956b5b3c21` |
| `summary.md` | `9d477c10ebf84219a6936d01959c2bed40f574690addde0ec6a8d79b2b68517c` |

Current summary:

- Status: `ready_g1a_owner_action_packet`
- Candidate cards: `3`
- Owner action pass/wait/fail: `0/8/0`
- First required owner action: `owner.choose_candidate_hash`
- Owner selection required: `true`
- Owner signature required: `true`
- Validation errors: `0`
- G1a project creation gate open now: `false`
- Factory Promotion goal complete allowed now: `false`

## Owner Action Rows

The default packet intentionally keeps every action row in `wait`.

1. `owner.choose_candidate_hash`
2. `owner.run_prebind_check`
3. `owner.sign_gate_opening_receipt`
4. `codex.validate_signed_receipt`
5. `codex.prepare_source_literal_commit`
6. `codex.apply_source_literal_commit`
7. `codex.capture_first_use_audit`
8. `owner.protected_closeout_adjudication`

If the owner explicitly provides one candidate packet hash, the first two rows
can become `pass` because selection/prebind readiness is established. The packet
still keeps owner signature, source mutation, first-use audit, protected
closeout, production PASS, and enterprise PASS closed.

`owner-work-order.json`의 `signable_owner_receipt_draft_ref`는
`logical_source_ref_not_materialized_by_this_command`이다. 이 action packet은
owner signing handoff를 `write:false`로 읽어 조합하므로 nested draft 파일의
생성을 보장하지 않는다. 실제 signable draft를 materialize하려면
`npm run factory:g1a-owner-signing-handoff`를 실행한다.

## API

Read-only route:

```text
GET /api/factory/g1a-owner-action-packet
```

The route supports `GET` and `HEAD` only. Mutating methods return `405`.

Required response invariants:

- `read_only: true`
- `mutation_allowed: false`
- `action_packet_only: true`
- `owner_completion_required: true`
- `signs_owner_receipt_now: false`
- `source_mutation_allowed_now: false`
- `source_literal_opening_commit_applied_now: false`
- `first_use_audit_present: false`
- `opens_gate_now: false`
- `g1a_project_creation_gate_open_now: false`
- `project_creation_allowed_now: false`
- `production_pass_enabled: false`
- `enterprise_pass_enabled: false`

## Law Firm OS-Style Review

이 패킷도 Law Firm OS closeout review 방식과 같은 증거 사다리를 따라야 한다.

1. compact packet과 review prompt/schema를 만든다.
2. Claude Code Opus 4.8 Max는 read-only reviewer로만 실행한다.
3. raw output을 그대로 저장한다.
4. raw가 wrapper/prose를 포함하면 normalized payload를 별도 파일로 만든다.
5. `factory:claude-review-evidence`로 raw/prompt를 hash-bound 검증한다.
6. auth/login failure, quota failure, empty output, interrupted output,
   malformed JSON, tool-call-shaped output, final approval claim, source mutation
   claim, owner signature claim, owner selection claim은 유효 리뷰 증거로 세지
   않는다.

## 검증

```bash
node --check src/factory-g1a-owner-action-packet.mjs
node --check scripts/factory-g1a-owner-action-packet.mjs
node --test test/factory-g1a-owner-action-packet.test.mjs
npm run factory:g1a-owner-action-packet -- --check --require-pass
node scripts/review-api.mjs --once /api/factory/g1a-owner-action-packet
```
