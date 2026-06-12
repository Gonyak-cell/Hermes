# Factory Promotion Closeout Readiness

## Status

`factory:promotion-closeout-readiness`는 Hermes Factory Promotion 전체 목표의
최상위 read-only closeout 판정 패킷이다. 현재 판정은
`waiting_for_g1a_owner_gate_opening_chain`이다.

이 판정은 FCORE F0-FA-FB-FC-FD-FE 구현 체인이 준비됐다는 뜻이지, Factory
Promotion 목표가 완료됐다는 뜻이 아니다. 목표 완료와 보호 closeout은 human
owner의 G1a 후보 선택, signed owner receipt, source-literal opening commit,
첫 사용 감사 캡처가 모두 끝난 뒤에만 다시 판정할 수 있다.

## Command

```bash
npm run factory:promotion-closeout-readiness -- --check
```

기본 artifact 생성:

```bash
npm run factory:promotion-closeout-readiness
```

출력 위치:

- `artifacts/factory-promotion-closeout-readiness/latest/factory-promotion-closeout-readiness.json`
- `artifacts/factory-promotion-closeout-readiness/latest/closeout-readiness-rows.json`
- `artifacts/factory-promotion-closeout-readiness/latest/closeout-blocker-rows.json`
- `artifacts/factory-promotion-closeout-readiness/latest/boundary.json`
- `artifacts/factory-promotion-closeout-readiness/latest/validation-items.json`
- `artifacts/factory-promotion-closeout-readiness/latest/summary.md`

## Current Evidence

Current generated artifact hashes:

| Artifact | SHA-256 |
|---|---|
| `factory-promotion-closeout-readiness.json` | `e14adf5e5bcac935567f7e98bc570251eaf13569447167e7eac7100d58942f1e` |
| `closeout-readiness-rows.json` | `b25cc48357d290c920a93aa146e405f32fff4dd47de8f7538fcbd31321132687` |
| `closeout-blocker-rows.json` | `ece303aafaf44c22a25ac23563bd0d08111563d509c5890877d2f03af53819ba` |
| `boundary.json` | `6f54a885b7642a558eb24b057c96d057e32d4a3b6c0afc421c5a30b147fbb5c8` |
| `validation-items.json` | `4b452202d6cf9b1a723747695505f1e6fab053da42cf5f13a9c589cfe6979c0d` |
| `summary.md` | `d04d3f715a400555a0de4e209457b6d3d20514d232ecbd5c9067005a3f4133b1` |

Current summary:

- FCORE closeout chain ready: `true`
- G1a owner gate-opening chain ready: `false`
- Readiness pass/wait/fail: `7/5/0`
- Blocking validation errors: `0`
- Protected closeout allowed now: `false`
- Factory promotion goal complete allowed now: `false`

## Waiting Blockers

The current waiting blockers are:

1. `g1a.owner_candidate_selected`
2. `g1a.signed_owner_receipt_present`
3. `g1a.source_literal_commit_applied`
4. `g1a.first_use_audit_present`
5. `g1a.opening_closeout_ready`

These are intentional `wait` states, not hard failures. Codex must not bypass
them by signing as owner, applying a protected source-literal gate opening
without the signed owner receipt, or claiming the first-use audit before the
first scoped G1a action exists.

## API

Read-only route:

```text
GET /api/factory/promotion-closeout-readiness
```

The route supports `GET` and `HEAD` only. Mutating methods return `405`.

Required response invariants:

- `read_only: true`
- `mutation_allowed: false`
- `closeout_readiness_only: true`
- `human_owner_protected_closeout_required: true`
- `fcore_closeout_chain_ready: true`
- `g1a_owner_gate_opening_chain_ready: false` until the owner chain is complete
- `factory_promotion_goal_complete_allowed_now: false`
- `project_creation_allowed_now: false`
- `production_pass_enabled: false`
- `enterprise_pass_enabled: false`

## Boundary

This command never:

- signs an owner receipt
- chooses an owner candidate
- mutates source
- applies the G1a source-literal opening commit
- records first-use audit completion
- opens G1a/G1b/G2/G3
- grants production or enterprise PASS
- marks the active Factory Promotion goal complete
