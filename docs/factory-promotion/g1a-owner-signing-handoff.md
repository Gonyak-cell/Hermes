# G1a Owner Signing Handoff

`factory:g1a-owner-signing-handoff`는 G1a `project_creation`
게이트를 열기 전, 소유자가 실제로 검토하고 완성할 서명 패킷을 만드는
read-only handoff이다. 이 명령은 영수증을 서명하지 않고, 소스를 변경하지
않고, G1a를 열지 않는다.

## Commands

```bash
npm run factory:g1a-owner-signing-handoff
npm run factory:g1a-owner-signing-handoff -- --check --require-pass
node scripts/review-api.mjs --once /api/factory/g1a-owner-signing-handoff
```

선택적으로 후보 manifest 또는 packet hash를 미리 바인딩할 수 있다.

```bash
npm run factory:g1a-owner-signing-handoff -- \
  --bound-candidate-manifest-sha256 <sha256>
```

## Artifacts

기본 출력은 `artifacts/factory-g1a-owner-signing-handoff/latest/`이다.

- `factory-g1a-owner-signing-handoff.json`
- `signable-owner-receipt-draft.json`
- `owner-completion-checklist.json`
- `owner-signing-work-order.json`
- `independent-review-packet.json`
- `review-request.json`
- `review-schema.json`
- `review-prompt.md`
- `handoff-rows.json`
- `boundary.json`
- `validation-items.json`
- `summary.md`

## Contract

- `signable-owner-receipt-draft.json`는 `receipt_status:
  draft_unsigned`와 `human_owner_signed: false`를 유지한다.
- 소유자는 서명 전에 후보 manifest 또는 후보 packet SHA-256을 하나만
  바인딩해야 한다.
- 소유자 서명 후에도 `factory:g1a-owner-receipt-intake`와
  `factory:g1a-source-literal-preflight`가 통과해야 하며, G1a 오픈은
  별도 isolated source-literal commit으로만 가능하다.
- 첫 workspace 생성 후 `factory:g1a-first-use-audit-readiness` 경로로
  first-use audit을 별도 바인딩해야 한다.

## Review Boundary

handoff는 Law Firm OS식 Opus review packet을 포함한다. Claude Code Opus
max 리뷰는 독립 reviewer evidence일 뿐이며, 소유자 서명, protected
closeout, production PASS, enterprise PASS, 또는 최종 승인을 대체하지
않는다.
