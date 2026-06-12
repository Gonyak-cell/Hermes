# 05. 게이트 개방 프로그램 (G-시리즈)

> 지위: DRAFT v0.1 / 2026-06-11 / 작성: Fable 5 계획 레인 (`claude-fable-5[1m]`)
> 계획 증거이며 승인이 아니다. 검증 기질 사용 금지. ([00-README.md](00-README.md) 공통 고지 적용)

## 1. 원칙

1. 게이트 개방은 FCORE 트랜치 **밖**의 별도 프로그램이다. 한 번에 게이트 하나.
2. 개방 = **소스 리터럴 변경 커밋** (데이터로 권한을 뒤집는 경로 영구 금지).
3. 개방 커밋은 단독 커밋이며 다른 변경과 섞지 않는다.
4. 개방 절차 4단계: ① 개방 커밋(분리) → ② 독립 리뷰(개방 범위·차단 픽스처 확인)
   → ③ 소유자 판정 영수증(`receipt_kind: gate_opening`) → ④ 개방 후 첫 사용 1건의 전체 감사 추적 캡처.
5. 모든 개방은 **범위 한정**이다 (전역 개방 없음): 제품 단위, 영수증 1건당 액션 1건.

현재 구현 기준선은 [g0-gate-opening-readiness.md](g0-gate-opening-readiness.md),
[g1a-opening-packet.md](g1a-opening-packet.md),
[g1a-owner-receipt-intake.md](g1a-owner-receipt-intake.md), 그리고
[g1a-source-literal-preflight.md](g1a-source-literal-preflight.md),
[g1a-source-literal-commit-draft.md](g1a-source-literal-commit-draft.md),
[g1a-opening-closeout-readiness.md](g1a-opening-closeout-readiness.md),
[g1a-first-use-audit-readiness.md](g1a-first-use-audit-readiness.md),
[g1a-owner-candidate-selection-docket.md](g1a-owner-candidate-selection-docket.md),
[g1a-owner-signing-handoff.md](g1a-owner-signing-handoff.md), 그리고
[g1a-owner-action-packet.md](g1a-owner-action-packet.md),
[factory-promotion-closeout-readiness.md](factory-promotion-closeout-readiness.md)이다. G0는
G1a/G1b/G2/G3 상태를 읽기전용으로 계산하고, 어떤 권한도 열지 않는다.
G1a는 선행조건과 리뷰 패킷이 준비됐지만 signed owner `gate_opening`
영수증, 분리 소스 리터럴 개방 커밋, 첫 사용 감사가 없으므로 닫힌 상태다.

G1a opening packet은 owner 영수증 템플릿, 소스 리터럴 개방 커밋 계획,
Law Firm OS식 Claude Opus 4.8 Max 리뷰 패킷, 첫 사용 감사 체크리스트만
생성한다. 이 패킷은 `project_creation_allowed_now`를 열지 않고, signed
receipt나 source literal 변경으로 취급하지 않는다.

G1a owner receipt intake는 future signed owner receipt 후보를 검증한다.
현재 기본 receipt는 unsigned template이므로 intake status는
`waiting_for_signed_g1a_owner_receipt`이며, 이 상태도 권한을 열지 않는다.

G1a owner candidate selection docket은 FC.3 후보 hash를 소유자 서명 흐름에
연결한다. 기본 상태는 후보 3개가 보이고 선택은 없는
`ready_g1a_owner_candidate_selection_docket`이다. hash를 명시하면 정확히 한
row와 매칭되는지 검증하고 owner signing handoff pre-bind command를 보여줄
수 있지만, owner 대신 후보를 선택하거나 receipt에 서명하거나 G1a를 열지는
않는다.

G1a owner signing handoff는 unsigned template과 signed receipt intake 사이의
소유자 작업 패킷이다. `signable-owner-receipt-draft.json`,
`owner-completion-checklist.json`, `owner-signing-work-order.json`, 그리고
Law Firm OS식 Opus review packet을 만들지만 owner 대신 서명하지 않고,
G1a를 열지 않으며, source literal을 변경하지 않는다.

G1a owner action packet은 candidate selection docket, owner signing handoff,
Factory Promotion closeout readiness를 묶어 다음 owner action을 한 표면에
정렬한다. 기본 상태는 `ready_g1a_owner_action_packet`, candidate cards 3개,
owner action pass/wait/fail `0/8/0`, first required action
`owner.choose_candidate_hash`이다. 이 패킷도 후보를 기본 선택하지 않고,
owner receipt 서명, source literal 변경, first-use audit, protected closeout,
G1a 개방, production/enterprise PASS를 수행하지 않는다.

G1a source literal preflight는 signed owner receipt가 들어왔을 때의 미래
소스 리터럴 커밋 형태를 사전검증한다. 현재는 unsigned template만 있으므로
`waiting_for_signed_g1a_owner_receipt`이며, preflight 자체는 소스 파일을
수정하거나 G1a를 열지 않는다.

G1a source literal commit draft는 preflight가 준비됐을 때 단일 파일 patch
artifact를 만든다. patch는 `SOURCE_LITERAL_GATE_OPEN_COMMITS.G1a`의
false→true 변경과 owner receipt 1건 바인딩만 포함해야 한다. 기본 상태는
signed owner receipt가 없어 `waiting_for_signed_g1a_owner_receipt`이며,
이 단계도 patch 적용, source mutation, first-use audit, G1a 개방을 수행하지
않는다.

Factory Promotion closeout readiness는 FCORE F0~FE 완료 증거와 G1a
owner-chain 대기 상태를 하나의 read-only 판정으로 묶는다. 현재 판정은
`waiting_for_g1a_owner_gate_opening_chain`이며, FCORE chain은 ready이나
owner candidate 선택, signed owner receipt, source-literal opening commit,
first-use audit, G1a opening closeout은 아직 대기 상태다. 이 단계도 protected
closeout, source mutation, G1a 개방, production/enterprise PASS를 수행하지
않는다.

G1a opening closeout readiness는 G0, packet, owner receipt intake,
source-literal preflight, first-use audit binding을 한 표면으로 집계한다.
현재 chain은 10 pass / 0 wait / 0 fail이며, G1a source evidence는 complete
상태다. 단, `project_creation_allowed_now`와 production/enterprise authority는
계속 닫힌 상태다.

G1a first-use audit readiness는 개방 이후 첫 workspace creation 감사 후보를
검증하고 `SOURCE_LITERAL_FIRST_USE_AUDITS` source binding을 확인한다. 현재
source-controlled fixture가 바인딩되어 `g1a_first_use_audit_already_bound`이며,
추가 감사 수행·source mutation·protected authority 개방을 주장하지 않는다.

## 2. 게이트 매트릭스

| 게이트 | 개방 플래그 | 선행 증거 | 범위 제한 | PS 연동 |
|---|---|---|---|---|
| **G1a** | `project_creation_allowed_now` | Stage 2 후보 매니페스트 실증 + FB 리뷰 영수증 | 신규 제품 워크스페이스 생성만. 영수증 1건 = 생성 1건 | PS2→PS3 핸들러 추가 |
| **G1b** | `repo_write_allowed_now` (patch apply) | Stage 4 전 사이클 실증(apply→검증→롤백) + FD 보안 리뷰 | **워크트리 한정**. 영수증 1건 = apply 1건. 보호 경로(`gates:protected-files`) 차단 유지 | PS3→PS4 핸들러 추가 |
| **G2** | `command_execution_enabled` | G1b 가동 실적 ≥3건 무사고 | allowlist 명령만, repo-local 샌드박스, 타임아웃·로그 의무 | PS4→PS5 핸들러 추가 |
| **G3** | `deployment_allowed_now` | G2 + 릴리스 후보 증거 루프 통과 | 파일럿 제품 1개, 스테이징 환경 한정 | PS6→PS7 핸들러 추가 |

## 3. 유보 게이트 (본 계획 범위 밖)

| 플래그 | 유보 사유 | 개방 전제 |
|---|---|---|
| `connector_write_allowed_now` | 외부 서비스·네트워크 금지 제약과 충돌 | 제약 해제 판정 + OAuth/시크릿 설계 별도 프로그램 |
| `production_pass_enabled` | 단독 소유자 모드 (REVIEW.md, P5801–P6200 규칙) | 외부 독립 GitHub 리뷰 + required status checks |
| `enterprise_pass_enabled` | 동상 | 서명 attestation + 독립 리뷰 증거 |
| `codex/claude/fable_final_approval_allowed` | **영구 유보** — AI 최종 승인은 시스템 설계상 금지 | 없음 |

## 4. 개방 후 운영 규칙

- 개방된 게이트로 수행되는 모든 액션은 상태 원장에 `receipt_id` + `bound_candidate_sha256`와 함께 기록.
- 액션 1건이라도 중단 조건([02-master-promotion-plan.md](02-master-promotion-plan.md) §5)에 해당하면
  **게이트 자동 재폐쇄 검토** (재폐쇄도 분리 커밋 + 소유자 영수증).
- 게이트 개방 상태는 워크벤치에 항상 표시 (개방일, 판정 영수증 ref, 사용 횟수).

## 5. 강등(Demotion) 절차

제품이 사고·중단 조건을 유발하면: 소유자 영수증 동반 명시 강등 이벤트(PSn→PSm, `direction: demote`)
+ 원인 finding 기록 + 재승격 조건 명시. 강등 없이 동일 PS에서 재시도 금지.
