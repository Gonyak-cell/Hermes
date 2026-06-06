# Hermes Roadmap P10201-P10400 CI/GitHub Evidence Bridge

P10201-P10400은 P10200 Claude Review Integration Lane 다음 단계다. 목표는 GitHub Actions, branch protection/ruleset, required checks, PR/commit SHA, signed attestation evidence를 Hermes의 read-only evidence plane으로 들여오되, GitHub 조작, merge, release PASS, enterprise trust를 열지 않는 것이다.

## Phase Plan

| Range | Name | Goal | Output |
|---|---|---|---|
| P10201-P10220 | P10200 Source Binding | P10200 Claude review integration artifact와 source Claude receipt를 bridge source로 묶는다. | `p10200_source_binding_rows` |
| P10221-P10240 | GitHub Remote And Branch Binding | GitHub remote, auth, repo, branch, local commit SHA를 evidence row로 정규화한다. | `github_remote_binding_rows` |
| P10241-P10260 | Branch Protection And Ruleset Evidence | branch protection, required PR review, stale review dismissal, force-push block evidence를 읽는다. | `branch_protection_evidence_rows` |
| P10261-P10280 | Required Check Evidence | required status check context와 latest required check result를 receipt로 묶는다. | `required_check_evidence_rows` |
| P10281-P10300 | GitHub Actions Run Evidence | actions run id, URL, status, conclusion, head SHA를 current commit과 비교한다. | `actions_run_evidence_rows` |
| P10301-P10320 | Pull Request And Commit SHA Evidence | PR review decision, approval count, PR head SHA, local SHA를 비교한다. | `pr_commit_evidence_rows` |
| P10321-P10340 | Signed Attestation Evidence | signed attestation verification status와 commit binding 상태를 표시한다. | `attestation_evidence_rows` |
| P10341-P10360 | Evidence Freshness And Provenance | receipt timestamp, freshness window, commit mismatch, stale evidence를 별도 row로 표시한다. | `evidence_freshness_rows` |
| P10361-P10380 | CI GitHub API Projection | external evidence와 blockers를 GET/HEAD-only API/UI로 투영한다. | `ci_github_api_route_rows`, `ci_github_api_smoke_rows`, `ci_github_browser_smoke_rows` |
| P10381-P10400 | P10400 Freeze | source, evidence visibility, blocker visibility, read-only API, authority boundary, Claude review receipt를 freeze한다. | `p10400_freeze_rows`, `ci_github_gate_rows` |

## Bridge Semantics

P10400은 GitHub/CI evidence를 조작하거나 새로 생성하는 단계가 아니다. 이미 캡처된 receipts를 읽고 다음 상태를 분리한다.

- `p10400_bridge_ready`: Harness가 외부 증거를 read-only로 읽고 blockers를 표시할 준비가 됨
- `external_evidence_complete_now`: GitHub/CI/attestation/PR evidence가 현재 commit 기준으로 모두 complete
- `external_closeout_allowed_now`: 이 tranche에서는 항상 false
- `release_closeout_allowed_now`: 이 tranche에서는 항상 false
- `enterprise_trust_allowed_now`: 이 tranche에서는 항상 false

즉 P10400 bridge는 ready가 될 수 있어도, stale commit, missing PR approval, missing attestation commit binding 같은 외부 evidence blocker는 그대로 남아야 한다.

## Fail-Closed Rules

다음 조건은 external closeout을 BLOCK한다.

- P10200 source artifact가 ready가 아님
- GitHub remote/auth receipt가 없음
- branch protection 또는 required PR review evidence가 없음
- required status check evidence가 없음
- actions run이 success가 아니거나 current commit과 다름
- PR review가 완료되지 않았거나 PR head SHA가 current commit과 다름
- attestation verification이 없거나 current release subject/commit에 묶이지 않음
- receipt timestamp가 stale이거나 provenance가 없음
- API/UI가 raw payload, stdout/stderr, token, secret, write action, merge action을 노출함

## Completion Criteria

```text
P10200 source 없음 = P10400 bridge 없음
GitHub evidence 없음 = external closeout 없음
stale GitHub evidence = external closeout 없음
PR approval 없음 = independent GitHub approval 없음
attestation commit binding 없음 = release/enterprise trust 없음
raw payload/API token 노출 없음
GitHub write/merge 없음
Codex/Claude final approval 없음
P10400 bridge ready는 release PASS 또는 enterprise PASS가 아님
```
