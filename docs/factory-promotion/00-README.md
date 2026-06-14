# Hermes SaaS Factory 승격 서류 패키지

| 항목 | 값 |
|---|---|
| 패키지 버전 | v0.1.5 (F0 OWNER EXCEPTION — one-time no-Opus FA start, low trust) |
| 작성일 | 2026-06-11 |
| 작성 엔진 | Claude Code (Fable 5, resolved model id: `claude-fable-5[1m]`) — 계획/리뷰어 레인 |
| 문서 지위 | **계획 증거(planning evidence) + S0 소유자 판정 기록이며, 구현 승인/게이트 개방은 아님** |
| 커밋 상태 | 비커밋 초안. 문서 패키지 커밋은 구현 커밋과 분리 |

## 절대 고지 (모든 문서 공통)

1. 본 패키지의 어떤 문서도 **승인·PASS·closeout·readiness 증거가 아니다.**
2. 본 패키지의 어떤 문서도 **`includesText`/term-scan 류 검증의 소스 기질(substrate)로 사용할 수 없다.**
   어떤 모듈도 이 문서들의 키워드 존재 여부를 `pass` 근거로 삼아서는 안 된다.
3. 다음 권한 플래그는 본 패키지가 다루는 전 구간에서 소스 리터럴 `false`로 유지된다:
   `project_creation_allowed_now`, `repo_write_allowed_now`, `connector_write_allowed_now`,
   `deployment_allowed_now`, `protected_action_allowed_now`, `codex_final_approval_allowed`,
   `claude_final_approval_allowed`, `fable_final_approval_allowed`,
   `production_pass_enabled`, `enterprise_pass_enabled`
4. 게이트 개방은 오직 [05-gate-opening-program.md](05-gate-opening-program.md)의 절차
   (분리 커밋 + 독립 리뷰 + 소유자 판정 영수증)로만 가능하다.
5. 본 패키지 작성 엔진(Fable)은 이 계획의 **구현에 대한 독립 리뷰어가 될 수 없다**
   (계획 작성자 ≠ 독립 리뷰어). 구현 리뷰는 별도 엔진 세션이 수행한다.

## 읽는 순서

| 순서 | 문서 | 대상 독자 | 목적 |
|---|---|---|---|
| 1 | [01-diagnosis.md](01-diagnosis.md) | 전원 | 검증된 현재 상태 (전수점검 결과) |
| 2 | [02-master-promotion-plan.md](02-master-promotion-plan.md) | 소유자 | 전체 승격 로드맵 Stage 0~7 |
| 3 | [09-decision-records/](09-decision-records/) | 전원 | Stage 0 소유자 판정 5건 |
| 4 | [CODEX-REVIEW.md](CODEX-REVIEW.md) | Codex + 소유자 | 구현 관점 리뷰 노트와 보완 필요사항 |
| 5 | [f0-receipt-integrity-preflight.md](f0-receipt-integrity-preflight.md) | Codex 레인 | F0.1 누락 리뷰 영수증의 최소 무결성 preflight |
| 6 | [f0-readiness-baseline.md](f0-readiness-baseline.md) | Codex + 소유자 | F0 kickoff 기준선과 source-chain blocker 현황 |
| 7 | [f0-review-requests/](f0-review-requests/) | 소유자 + 독립 리뷰어 | F0.1 Opus 리뷰 요청 패킷 |
| 8 | [s0-owner-adjudication-receipt.json](s0-owner-adjudication-receipt.json) | 기계/감사 | S0 판정 묶음 영수증 |
| 9 | [f0-owner-no-opus-exception-receipt.json](f0-owner-no-opus-exception-receipt.json) | 기계/감사 | 이번 한정 Opus 없는 FA 착수 예외. 독립 리뷰/production/enterprise 승인 아님 |
| 9 | [03-fcore-program.md](03-fcore-program.md) | Codex 레인 | FCORE 프로그램: 트랜치/phase 상세 |
| 10 | [04-target-architecture.md](04-target-architecture.md) | Codex 레인 | 목표 아키텍처 + 데이터 계약 초안 |
| 11 | [05-gate-opening-program.md](05-gate-opening-program.md) | 소유자 + Codex | 권한 게이트 개방 절차 |
| 12 | [06-pilot-strategy.md](06-pilot-strategy.md) | 소유자 | 파일럿 제품 순서와 기준 |
| 13 | [07-verification-strategy.md](07-verification-strategy.md) | Codex 레인 | 상태형 테스트·실행형 네거티브 픽스처 규약 |
| 14 | [08-operating-cadence-and-checklist.md](08-operating-cadence-and-checklist.md) | 전원 | 리뷰 윈도우 운영·체크리스트 |
| 15 | [g1a-owner-action-packet.md](g1a-owner-action-packet.md) | 소유자 + Codex | G1a owner-chain의 다음 human-owner 작업을 모은 read-only action packet |
| 16 | [g1a-owner-action-packet-claude-opus-4-8-review-receipt.md](g1a-owner-action-packet-claude-opus-4-8-review-receipt.md) | 감사/리뷰 | G1a owner action packet Opus 4.8 read-only 리뷰 영수증 |
| 17 | [factory-promotion-closeout-readiness.md](factory-promotion-closeout-readiness.md) | 소유자 + Codex | FCORE 완료 증거와 G1a owner-chain 대기 상태를 묶은 최상위 closeout readiness |
| 18 | [factory-promotion-closeout-readiness-claude-opus-4-8-review-receipt.md](factory-promotion-closeout-readiness-claude-opus-4-8-review-receipt.md) | 감사/리뷰 | 최상위 closeout readiness Opus 4.8 read-only 리뷰 영수증 |
| 19 | [g-series-advancement-and-stage6-7.md](g-series-advancement-and-stage6-7.md) | Codex + 소유자 | G1b/G2/G3 advancement, runtime guards, Stage6/Stage7 contract readiness |
| 20 | [99-structured-summary.json](99-structured-summary.json) | 기계/감사 | 패키지 메타데이터 |

## 용어 (패키지 전체 공통)

| 용어 | 의미 |
|---|---|
| **Stage 0~7** | 승격 프로그램의 스테이지 (조직 차원의 진행 단계) |
| **F0, FA~FE** | FCORE 프로그램의 트랜치 (코드/문서 작업 묶음) |
| **G1a, G1b, G2, G3** | 권한 게이트 개방 프로그램 (트랜치 밖, 소유자 판정 1회 = 게이트 1개) |
| **PS0~PS7** | 개별 제품의 라이프사이클 상태 (제품 차원, 상태 원장에 기록) |
| **FCORE phase** | 리뷰 가능한 커밋 1개 = phase 1개 (총 30개) |
| **레거시 P-범위** | 기존 pNNNN 로드맵 범위. FCORE는 이를 재배열·승격하며 새 P-범위를 발행하지 않음 |

## 채택 절차

1. 소유자 판정은 2026-06-11에 권고안대로 채택되었고, [s0-owner-adjudication-receipt.json](s0-owner-adjudication-receipt.json)에 묶었다.
2. Codex 레인이 패키지를 검토(구현 관점 이의 제기 포함)하고 검토 노트를 남긴다.
3. Codex 레인이 문서 패키지를 커밋한다 (HRM-03 준수: 계획 문서 커밋은 구현 커밋과 분리).
4. FCORE F0 트랜치가 개시된다. 이번 run에서는 human owner의 명시 지시에 따라 Opus 리뷰 없이 FA 착수를 허용하되,
   [f0-owner-no-opus-exception-receipt.json](f0-owner-no-opus-exception-receipt.json)을 통해 낮은 신뢰도 예외로만 표시한다.
5. FA 구현 착수 전 `npm run factory:promotion-f0-gate -- --check --require-pass`가 현재 repo 상태에서 통과해야 한다.
   이 통과는 production PASS, enterprise PASS, final approval, protected action, connector write, deployment를 의미하지 않는다.
