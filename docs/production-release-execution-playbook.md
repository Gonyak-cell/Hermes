# Production Release Execution Playbook

이 문서는 Hermes를 실제 출시로 가져가기 위한 실행 순서다. 현재 상태에서 Codex가 할 수 있는 검증과 패킷 준비는 자동화하고, 독립 리뷰, owner 판정, 서명 provenance, 배포 권한 개방은 명시적으로 사람 또는 외부 시스템 입력으로 남긴다.

현재 기준 후보:

- Branch: `codex/p3840-review-hardening`
- Pull request: `https://github.com/Gonyak-cell/Hermes/pull/1`
- Candidate commit: `ae88f02cb54e6d916915b53545b46ce8a32abd8c`
- Release candidate report: `artifacts/release-candidate-report/latest`
- Non-human launch readiness: `artifacts/launch-non-human-readiness/latest`
- Release readiness control plane: `artifacts/release-readiness-control-plane/latest`

## 0. Candidate Freeze

목표: 출시 후보가 어떤 commit과 PR을 기준으로 하는지 고정한다.

Codex가 할 일:

```bash
git status --short --branch
git log --oneline -5
gh pr view 1 --json number,state,mergeable,reviewDecision,statusCheckRollup,url,headRefOid
npm run release:candidate -- --check
```

통과 조건:

- worktree가 clean이다.
- PR head SHA가 candidate commit과 일치한다.
- PR CI가 성공 상태다.
- `release:candidate`가 `Status: complete`, `Validation errors: 0`을 출력한다.

현재 판정: Codex 실행 가능, 현재 후보는 RC report 기준 통과 상태다.

## 1. Non-Human Launch Readiness

목표: 사람 승인 없이 Codex가 닫을 수 있는 작업과 닫을 수 없는 승인 작업을 분리한다.

Codex가 할 일:

```bash
npm run platform:launch-non-human-readiness -- --check
```

통과 조건:

- `launch_non_human_readiness_status`가 `ready_for_non_human_launch_readiness_execution`이다.
- `human_approval_excluded_now`가 `true`다.
- `codex_final_approval_allowed`, `deployment_allowed_now`, `production_pass_enabled`, `enterprise_pass_enabled`가 모두 `false`다.

현재 판정: Codex 실행 가능, 비휴먼 출시 준비는 준비 완료 상태다.

## 2. Base Provenance Verification

목표: provenance ledger, release bundle hash, signed tag policy, freeze preflight가 준비되어 있는지 확인한다. 이 단계는 실제 signer 서명과 다르다.

Codex가 할 일:

```bash
npm run platform:provenance-ledger -- --check
npm run platform:release-bundle-provenance -- --check
npm run platform:signed-tag-provenance -- --check
npm run platform:provenance-freeze-preflight -- --check
```

통과 조건:

- 각 명령이 `Status: ready`를 출력한다.
- 각 명령의 `Validation errors`가 `0`이다.

현재 판정: Codex 실행 가능, base provenance 검증은 통과 상태다.

## 3. Independent Release Review

목표: Codex가 만든 출시 후보를 Codex가 아닌 리뷰 레인이 읽고, 출시 readiness에 대한 독립 review receipt를 만든다.

Codex가 할 일:

```bash
npm run platform:release-check-review-packet -- --check
```

외부 리뷰어가 할 일:

- PR #1 또는 release readiness packet을 읽는다.
- Claude Code Opus max 또는 GitHub reviewer로 독립 review를 수행한다.
- 실패한 CLI run, quota failure, login failure, empty output, malformed JSON은 유효한 review evidence로 세지 않는다.
- 발견 사항이 있으면 finding id, severity, affected ref, required change, unresolved 여부를 남긴다.

유효한 Claude release review receipt 최소 조건:

```json
{
  "review_engine": "claude_code_opus_max",
  "receipt_status": "complete",
  "scope_release_readiness_control_plane": true,
  "unresolved_finding_count": 0
}
```

필수 경로:

```text
artifacts/release-readiness-control-plane/review/claude-release-readiness-review-receipt.json
```

통과 조건:

- release review receipt가 위 경로에 존재한다.
- `unresolved_finding_count`가 `0`이다.
- PR review decision이 더 이상 `REVIEW_REQUIRED`가 아니다.

현재 판정: packet 준비는 Codex 실행 가능, 독립 approval 자체는 Codex 불가.

## 4. Human Owner Adjudication

목표: 최종 owner가 보호 closeout에 대해 승인, 보류, 거절, 조건부 승인 중 하나를 명시한다.

Codex가 할 일:

```bash
npm run platform:human-owner-adjudication-option -- --check
```

owner가 할 일:

- 후보 commit, PR, release candidate report, independent review receipt, validation 결과를 읽는다.
- owner adjudication receipt를 작성한다.
- owner receipt는 GitHub independent approval이나 enterprise independent review를 대체하지 않는다고 명시한다.

유효한 owner receipt 최소 조건:

```json
{
  "schema_version": "owner-adjudication-receipt.v1",
  "receipt_status": "observed",
  "owner_adjudication_receipt_present_now": true,
  "scope_human_owner_adjudication_option": true,
  "raw_payload_inlined": false,
  "final_authority_allowed_now": false,
  "enterprise_trust_claim_allowed_now": false
}
```

필수 경로:

```text
artifacts/human-owner-adjudication-option/review/owner-adjudication-receipt.json
```

통과 조건:

- `owner_adjudication_receipt_present_now`가 `true`다.
- `ready_for_p12801_handoff`가 `true`가 된다.
- `production_pass_enabled`와 `enterprise_pass_enabled`는 여전히 `false`다.

현재 판정: Codex는 packet과 검증만 가능, owner adjudication 자체는 사람 필요.

## 5. Signed Provenance Receipt

목표: 출시 후보의 commit, artifact digest, CI evidence, review evidence가 signer에 의해 묶였음을 증명한다.

Codex가 할 일:

- candidate commit, release candidate report, CI run, review packet, validation commands를 수집한다.
- unsigned 또는 draft 형태의 provenance 자료를 준비한다.
- 실제 signer가 없는 상태에서 `observed` 또는 `attestation_verification_passed_now: true`를 만들지 않는다.

signer가 할 일:

- candidate commit과 artifact digest를 확인한다.
- release bundle과 CI evidence를 확인한다.
- 서명 또는 attestation verification receipt를 남긴다.

유효한 signed provenance receipt 최소 조건:

```json
{
  "schema_version": "release-signed-provenance-receipt.v1",
  "receipt_status": "observed",
  "signed_provenance_bundle_present_now": true,
  "artifact_digest_bound_now": true,
  "commit_sha_bound_now": true,
  "attestation_verification_passed_now": true,
  "raw_payload_inlined": false
}
```

필수 경로:

```text
artifacts/release-readiness-control-plane/provenance/signed-provenance-receipt.json
```

통과 조건:

- signed provenance receipt가 존재한다.
- commit SHA와 artifact digest가 candidate와 일치한다.
- raw secret, raw payload, private credential이 receipt에 inline으로 들어가지 않는다.

현재 판정: Codex는 자료 준비 가능, signer attestation은 Codex 불가.

## 6. Release Readiness Control Plane

목표: owner adjudication, signed provenance, Claude release review가 모두 관측된 뒤 release handoff 가능 여부를 판정한다.

Codex가 할 일:

```bash
npm run platform:release-readiness-control-plane -- --check
```

통과 조건:

- `source_ready_for_p12801_handoff`가 `true`다.
- `signed_provenance_receipt_present_now`가 `true`다.
- `claude_release_review_receipt_present_now`가 `true`다.
- `ready_for_p13001_handoff`가 `true`다.
- `validation_error_count`가 `0`이다.

주의:

- 이 단계가 통과해도 자동으로 production deploy가 허용되는 것은 아니다.
- `deployment_allowed_now`는 별도 G3/deployment authority가 열리기 전까지 `false`여야 한다.

현재 판정: Codex 실행 가능, 현재는 receipt 3종 부재로 blocked 상태다.

## 7. Factory Gate Advancement

목표: SaaS factory 모드의 G1a/G1b/G2/G3/Stage6/Stage7 ladder를 readiness와 실제 authority 개방으로 분리해서 진행한다.

Codex가 할 일:

```bash
npm run factory:g1a-first-use-audit-readiness -- --check --require-pass
npm run factory:g-series-advancement-readiness -- --check --require-pass
npm run factory:stage6-7-execution-readiness -- --check --require-pass
```

통과 조건:

- G1a first-use audit rows가 pass다.
- G-series code development가 allowed다.
- Stage6/Stage7 contract development가 ready다.
- `runtime_authority_open`은 실제 권한 개방 전까지 `false`다.

권한 개방 순서:

1. G1a first-use audit/source binding closeout
2. G1b repo-write gate
3. G2 command-execution gate
4. G3 staging/deployment gate
5. Stage6 execution contracts
6. Stage7 release-candidate contracts

현재 판정: Codex는 development readiness 검증 가능, runtime/deploy authority 개방은 별도 승인 필요.

## 8. Deployment Runbook And Staging

목표: deployment가 허용되기 전 필요한 environment, command, rollback, smoke check를 준비한다.

Codex가 할 일:

```bash
npm run deployment:runbook -- --check
```

G3/deployment authority가 열린 뒤 할 일:

- staging deploy를 수행한다.
- API smoke와 UI smoke를 수행한다.
- rollback/restore dry-run evidence를 확인한다.
- incident owner, rollback owner, monitoring owner를 확인한다.

통과 조건:

- deployment runbook이 `Status: complete`다.
- rollback procedure가 문서화되어 있다.
- staging smoke가 통과한다.
- production deploy 전 `deployment_allowed_now`가 명시적으로 true가 된 상태여야 한다.

현재 판정: runbook은 Codex 실행 가능, 실제 deploy는 아직 불가.

## 9. Enterprise Trust And Production Governance

목표: 출시 가능 상태와 enterprise trust claim 가능 상태를 분리한다.

Codex가 할 일:

```bash
npm run platform:enterprise-trust-hardening-control-plane -- --check
npm run platform:production-governance-hardening -- --check
```

통과 조건:

- enterprise trust review receipt가 별도로 존재한다.
- production governance review receipt가 별도로 존재한다.
- production PASS와 enterprise PASS는 명시적 승인 없이는 열리지 않는다.

현재 판정: Codex 실행 가능, 현재 둘 다 source/review receipt 부재로 blocked 상태다.

## 10. Merge, Tag, Production Go/No-Go

목표: 승인된 후보를 protected branch에 merge하고, main 기준으로 다시 검증한 뒤 production go/no-go를 판정한다.

Codex가 할 일:

```bash
gh pr view 1 --json number,state,mergeable,reviewDecision,statusCheckRollup,url,headRefOid
npm test
npm run validate
npm run platform:release-readiness-control-plane -- --check
```

권한자가 할 일:

- PR approval을 완료한다.
- protected branch merge를 승인한다.
- release tag를 서명한다.
- production go/no-go를 기록한다.

통과 조건:

- PR approval 완료.
- main branch CI green.
- signed tag 또는 equivalent release attestation 존재.
- production checklist 완료.
- rollback trigger와 incident owner 확정.

현재 판정: Codex는 검증과 packet 준비 가능, merge approval과 production go/no-go는 owner/external authority 필요.

## Immediate Queue

다음 순서로 진행한다.

1. Independent release review receipt 확보.
2. Owner adjudication receipt 확보.
3. Signed provenance receipt 확보.
4. `platform:human-owner-adjudication-option -- --check` 재실행.
5. `platform:release-readiness-control-plane -- --check` 재실행.
6. G3/deployment authority가 열린 뒤 staging smoke.
7. PR merge, main CI 확인, release tag, production go/no-go.

Codex가 지금 즉시 계속할 수 있는 작업은 review packet refresh, receipt template 점검, 검증 명령 재실행, blocked state 보고서 갱신이다. Codex가 해서는 안 되는 작업은 independent approval, owner final approval, signer attestation, deployment authority opening, production PASS, enterprise PASS를 자체 발급하는 것이다.
