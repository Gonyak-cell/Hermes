# G1a Owner Candidate Selection Docket

`factory:g1a-owner-candidate-selection-docket`는 FC.3 candidate review docket과
G1a owner signing handoff 사이의 읽기전용 bridge이다. 소유자가 어떤
candidate packet hash 또는 candidate manifest hash를 owner receipt에 바인딩할
수 있는지 보여주지만, Codex/Claude/Fable이 후보를 대신 고르거나 서명하거나
G1a를 열지는 않는다.

```bash
npm run factory:g1a-owner-candidate-selection-docket
npm run factory:g1a-owner-candidate-selection-docket -- --check --require-pass
node scripts/review-api.mjs --once /api/factory/g1a-owner-candidate-selection-docket
```

특정 후보를 소유자 검토용으로 pre-bind하려면 이 docket의
`candidate-selection-rows.json`에 표시된 hash 중 하나를 명시한다.

```bash
npm run factory:g1a-owner-candidate-selection-docket -- \
  --selected-candidate-packet-sha256 <candidate_packet_sha256> \
  --check --require-pass
```

기본 출력은
`artifacts/factory-g1a-owner-candidate-selection-docket/latest/`이다.

- `factory-g1a-owner-candidate-selection-docket.json`
- `candidate-selection-rows.json`
- `owner-prebind-command-rows.json`
- `selection-policy.json`
- `source-chain-rows.json`
- `independent-review-packet.json`
- `review-request.json`
- `review-schema.json`
- `boundary.json`
- `validation-items.json`
- `review-prompt.md`
- `summary.md`

## 역할

이 docket은 G1a signed owner receipt의 `candidate_binding_required` 공백을
줄인다. FC.3에서 이미 review-required 상태로 묶인 후보 3개를 읽고, 각 row가
아래 조건을 만족할 때만 owner-selectable로 표시한다.

- `candidate_packet_sha256`와 `candidate_manifest_sha256`가 SHA-256 형식이다.
- candidate hash가 manifest에 바인딩되어 있다.
- preflight가 실행됐고 `passed` 상태다.
- review status는 `review_required_not_approved`이다.
- review decision, approval, apply, source write, repo write, connector write,
  deployment, protected action, production PASS, enterprise PASS가 모두 닫혀 있다.

선택이 없는 기본 상태는 `ready_g1a_owner_candidate_selection_docket`이며
`owner_selection_required_now: true`,
`selected_candidate_now: false`, `candidate_hash_bound_now: false`이다.
이는 정상이다. 후보 목록을 보여줄 준비가 된 것이지, 소유자 대신 후보를
선택했다는 뜻이 아니다.

## Pre-Bind

선택 hash가 명시되면 docket은 정확히 한 row와 매칭되는지만 검증한다.
매칭되면 `selected_candidate_now: true`와 `candidate_hash_bound_now: true`가
될 수 있지만, 이는 owner signing handoff의 unsigned draft에 hash를
pre-bind한 상태일 뿐이다.

pre-bind 상태에서도 아래는 항상 false다.

- `signs_owner_receipt_now`
- `owner_gate_opening_receipt_signed_now`
- `source_mutation_allowed_now`
- `source_literal_opening_commit_applied_now`
- `opens_gate_now`
- `g1a_project_creation_gate_open_now`
- `project_creation_allowed_now`
- `production_pass_enabled`
- `enterprise_pass_enabled`

## Law Firm OS-Style Review

이 docket은 Law Firm OS closeout review 방식과 같은 증거 사다리를 따른다.

1. compact packet과 `review-prompt.md`를 만든다.
2. Claude Code Opus 4.8 Max는 read-only reviewer로만 실행한다.
3. raw output을 그대로 저장한다.
4. `factory:claude-review-evidence`로 raw/prompt를 hash-bound 검증한다.
5. auth/login failure, quota failure, empty output, interrupted output,
   malformed JSON, tool-call-shaped output, final approval claim, source mutation
   claim, owner signature claim, owner selection claim은 유효 리뷰 증거로 세지
   않는다.

## 권한 경계

이 command와 Review API route는 docket-only/read-only surface다. owner
selection을 보조하지만, 선택 행위 자체도 human owner의 보호 판정이다.
따라서 이 산출물은 protected closeout, enterprise trust, source-literal
opening commit, first-use audit, 또는 Factory Promotion goal 완료 증거로
계산할 수 없다.

## 검증

```bash
node --check src/factory-g1a-owner-candidate-selection-docket.mjs
node --check scripts/factory-g1a-owner-candidate-selection-docket.mjs
node --test test/factory-g1a-owner-candidate-selection-docket.test.mjs
npm run factory:g1a-owner-candidate-selection-docket -- --check --require-pass
node scripts/review-api.mjs --once /api/factory/g1a-owner-candidate-selection-docket
```
