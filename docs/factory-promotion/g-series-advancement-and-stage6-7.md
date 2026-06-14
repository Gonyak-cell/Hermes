# G-series Advancement and Stage6/7 Execution Readiness

이 문서는 G1b, G2, G3, Stage6, Stage7을 코드 개발 대상으로 착수하기 위해 추가된
read-only 실행 표면을 설명한다. 이 표면들은 권한 개방, human protected closeout,
production PASS, enterprise PASS가 아니다.

## 현재 결론

- G1b/G2/G3 계약 개발은 계속 가능하다.
- Stage6/Stage7 계약 개발은 계속 가능하다.
- repo write, command execution, staging deployment, Stage6 runtime, Stage7 release candidate는 모두 닫혀 있다.
- human approval skip은 개발 흐름을 끊지 않기 위한 운영 지시일 뿐이며 protected closeout으로 계산하지 않는다.
- Claude/Opus 독립 리뷰는 현재 사용자 지시에 따라 실행하지 않았고, 어떤 리뷰 영수증도 새로 주장하지 않는다.

## 새 명령

```bash
npm run factory:g-series-advancement-readiness -- --check --require-pass
npm run factory:g-series-runtime-guards -- --check --require-pass
npm run factory:stage6-7-execution-readiness -- --check --require-pass
```

## 새 Review API

```text
GET /api/factory/g-series-advancement-readiness
GET /api/factory/g-series-runtime-guards
GET /api/factory/stage6-7-execution-readiness
```

모든 API는 GET/HEAD 전용이다. mutation, source write, process spawn, deployment를 수행하지 않는다.

## G1b/G2/G3 advancement readiness

`factory:g-series-advancement-readiness`는 다음 행을 만든다.

| Gate | 상태 | 의미 |
|---|---|---|
| G1b | `waiting_for_g1a_first_use_audit_before_repo_write` | G1a 첫 사용 감사 전까지 repo write/apply 금지 |
| G2 | `waiting_for_g1b_three_no_incident_usage_rows` | G1b 무사고 사용 3건 전까지 command execution 금지 |
| G3 | `waiting_for_g2_release_candidate_evidence_loop` | G2와 release-candidate evidence loop 전까지 deployment 금지 |

Stage6/Stage7 행도 같이 생성한다. 두 행 모두 code development는 가능하지만 runtime authority는 닫힌다.

## Runtime guards

`factory:g-series-runtime-guards`는 다음 protected attempt를 모두 `blocked_as_expected`로 처리한다.

- `g1b_repo_write_patch_apply`
- `g2_command_execution`
- `g3_deployment_staging`
- `stage6_limited_execution_runtime`
- `stage7_pilot_release_candidate`

이 guard는 simulation-only이다. 파일을 쓰지 않고, 프로세스를 실행하지 않으며, 실제 배포를 수행하지 않는다.

## Stage6/Stage7 contract readiness

`factory:stage6-7-execution-readiness`는 FE freeze handoff, G-series advancement readiness,
runtime guards를 결합한다.

Stage6 계약 4종:

| Contract | 목적 |
|---|---|
| `stage6.intake_runtime_contract` | E2E intake request를 work packet 후보와 receipt log에 묶음 |
| `stage6.work_packet_execution_contract` | FE.2 work packet 1건 단위 실행 계약 |
| `stage6.validation_loop_runtime_contract` | FE.3 validation loop step과 test evidence/review packet 결합 |
| `stage6.receipt_and_log_binding_contract` | command log, validation evidence, first-use audit hash binding |

Stage7 계약 4종:

| Contract | 목적 |
|---|---|
| `stage7.hermes_harness_pilot_rc` | 첫 pilot product를 `project.hermes_harness`로 제한 |
| `stage7.staging_deploy_contract` | source-bound release candidate의 staging-only 배포 계약 |
| `stage7.rollback_rehearsal_contract` | staging rollback rehearsal 증거 계약 |
| `stage7.scale_closeout_contract` | pilot evidence를 수집하되 production/enterprise trust를 열지 않는 closeout 계약 |

## 권한 경계

다음 플래그는 세 명령 모두에서 false여야 한다.

- `repo_write_allowed_now`
- `command_execution_enabled`
- `deployment_allowed_now`
- `protected_action_allowed_now`
- `production_pass_enabled`
- `enterprise_pass_enabled`
- `factory_promotion_goal_complete_allowed_now`

## 다음 실제 차단 해제 조건

1. G1a 첫 사용 감사가 source-bound evidence로 추가되어야 한다.
2. G1b gate opening은 별도 owner receipt, source-literal commit, 독립 리뷰, 첫 사용 감사 체인을 요구한다.
3. G2는 G1b 무사고 usage row 3건 이상이 필요하다.
4. G3는 G2와 release-candidate evidence loop가 필요하다.
5. Stage6/Stage7 runtime closeout은 human owner protected closeout과 독립 리뷰를 다시 요구한다.
