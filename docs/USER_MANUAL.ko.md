# Hermes Project Operations Harness 사용자 매뉴얼

이 문서는 Hermes Harness를 처음 쓰는 사람을 위한 입문 매뉴얼입니다. 이 저장소는 로펌 전용 앱이 아니라 **개발 프로젝트와 업무 domain pack을 같은 control plane으로 관리하는 플랫폼**입니다.

## 1. 무엇을 하는 플랫폼인가

Hermes Harness는 프로젝트별로 다음 정보를 계속 정리합니다.

- 지금 먼저 해야 할 작업
- 막힌 작업과 blocker
- 사람이 검토해야 할 산출물
- 테스트, 릴리스, 롤백 준비 상태
- resource, evidence, output artifact, audit trail
- domain pack별 안전 게이트

기본 사용 중심은 `personal-dev`입니다. `law-firm`, `creative-document`, `connectors`, `resource`는 같은 플랫폼 위에 올라가는 확장 domain pack입니다.

## 2. 처음 실행

PowerShell에서 저장소로 이동합니다.

```powershell
cd "G:\Computers\내 Mac\Documents\Codex\Hermes"
```

기본 검증을 실행합니다.

```powershell
npm.cmd run validate
npm.cmd test
```

정상이라면 core contract, domain pack, demo matter validation, local test가 통과합니다.

## 3. 개인 개발 프로젝트 운영

현재 플랫폼의 기본 루틴입니다.

```powershell
npm.cmd run dev:validate
npm.cmd run dev:brief
```

입력 파일은 `examples/dev-projects.json`입니다. 결과는 터미널에 오늘의 focus, blocked task, review queue, release gap 형태로 나옵니다.

운영 방식은 단순합니다.

- 아침에 `npm.cmd run dev:brief`를 실행합니다.
- Recommended Focus 중 하나만 고릅니다.
- 30-90분 안에 끝낼 수 있는 next action으로 줄입니다.
- 작업이 끝나면 `examples/dev-projects.json`의 task 상태를 갱신합니다.
- 릴리스 전에는 `personal-dev:*` 검증 명령으로 plan, diff, test, PR draft, rollback 상태를 확인합니다.

개인 개발 domain의 주요 명령:

```powershell
npm.cmd run personal-dev:repo-profile
npm.cmd run personal-dev:issue-intake
npm.cmd run personal-dev:plan-reconciliation
npm.cmd run personal-dev:diff-review
npm.cmd run personal-dev:test-matrix
npm.cmd run personal-dev:pr-draft
npm.cmd run personal-dev:e2e-report -- --check
```

이 명령들은 기본적으로 read-only 산출물과 검토 자료를 만듭니다. 실제 git push, merge, release는 자동으로 하지 않습니다.

## 4. Operator Handbook

운영자 관점의 현재 상태를 보려면:

```powershell
npm.cmd run operator:handbook -- --check
```

결과는 `artifacts/operator-handbook/latest`에 생성됩니다.

가장 먼저 볼 파일:

- `summary.md`
- `operator-handbook.json`
- `operator-workflows.json`
- `operator-screens.json`
- `operator-gates.json`

이 handbook은 읽기 전용입니다. 승인 적용, receipt 적용, 정책 변경, 복구, rollback, 명령 실행은 명시 승인 전 수행하지 않습니다.

## 5. Dashboard와 Review API

정적 dashboard 파일:

```text
artifacts/dashboard/latest/index.html
```

Review API 실행:

```powershell
npm.cmd run api:serve
```

기본 주소:

```text
http://127.0.0.1:4177
```

확인할 route:

```text
/health
/api
/api/dashboard
/api/personal-dev-dashboard-apis
/api/operator-handbooks
/api/release-candidate-reports
/api/v1-freezes
```

API는 read-only 운영 화면입니다. route를 호출해도 프로젝트 상태, issue, matter, approval, delivery를 직접 변경하지 않습니다.

## 6. 로펌 domain pack

로펌 기능은 플랫폼의 하위 모듈입니다. matter, LDD, litigation, contract draft, evidence, citation, approval gate를 다룹니다.

데모 브리프:

```powershell
npm.cmd run brief
```

로펌 E2E 검증:

```powershell
npm.cmd run law-firm:e2e-report -- --check
```

카카오톡/Outlook export intake:

```powershell
npm.cmd run intake:kakao
npm.cmd run intake:outlook
```

실제 법률 또는 고객-facing 산출물은 반드시 변호사/담당자 검토가 필요합니다.

## 7. Creative Document domain pack

문서 생성과 렌더링 품질을 다룹니다.

```powershell
npm.cmd run creative-document:e2e-report -- --check
npm.cmd run creative-document:docx-renderer
npm.cmd run creative-document:pptx-renderer
npm.cmd run creative-document:layout-validator
```

이 domain도 draft output artifact와 human approval gate를 기본으로 둡니다.

## 8. 전체 release 상태 확인

v1.0 freeze 기준의 최종 상태를 보려면:

```powershell
npm.cmd run release:candidate -- --check
npm.cmd run release:freeze -- --check
```

결과는 다음 위치에 생성됩니다.

- `artifacts/release-candidate-report/latest`
- `artifacts/v1-freeze/latest`

P312 기준으로 문서상 planned slot은 0개입니다. 다만 이것은 tag/release/deploy를 실행했다는 뜻이 아니라, read-only release checklist와 freeze report가 완성되었다는 뜻입니다.

## 9. Hermes에서 쓰는 방식

Hermes에게는 domain pack을 명시해서 지시합니다.

개인 개발:

```text
Use the personal-dev project-manager skill and summarize today's development focus from examples/dev-projects.json.
```

로펌:

```text
Use the law-firm matter-ops skill and generate a daily brief from examples/project-alpha-matter.json.
```

문서:

```text
Use the creative-document workflow outputs and summarize layout or approval blockers.
```

## 10. 안전 원칙

- 플랫폼 본체는 project/control-plane입니다.
- domain pack끼리 context를 섞지 않습니다.
- protected action은 명시 승인 전 실행하지 않습니다.
- legal/client-facing/release-facing output은 human review gate를 통과해야 합니다.
- 외부 서비스, live API, API key는 승인 전 추가하지 않습니다.
- LLM은 초안과 검토 보조로 쓰고, deterministic script가 먼저 구조화합니다.
