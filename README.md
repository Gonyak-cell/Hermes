# Hermes Project Operations Harness

Hermes Agent를 위한 **프로젝트 운영 플랫폼 하네스**입니다. 이 저장소의 본체는 로펌 전용 앱이 아니라, 여러 종류의 작업을 같은 control plane 위에서 관리하는 로컬 플랫폼입니다.

로펌 matter 운영은 이 플랫폼 위에 올라간 domain pack 중 하나입니다. 현재 실사용 기준의 중심은 **개인 개발 프로젝트 관리**이고, law-firm과 creative-document는 같은 계약과 게이트를 공유하는 확장 domain pack입니다.

## 제품 정체성

Hermes Harness는 다음을 관리합니다.

- 프로젝트/업무별 context와 source of truth
- 다음 액션, blocker, review queue, release readiness
- resource, evidence, output artifact, audit trail
- human review gate, approval gate, protected action gate
- read-only dashboard/API와 operator handbook

Domain pack은 다음처럼 분리됩니다.

- `personal-dev`: 개발 프로젝트, issue intake, plan reconciliation, worktree lane, diff review, canonical test, PR draft, release note, rollback, technical debt
- `law-firm`: matter, LDD, litigation brief, contract draft, evidence, citation, attorney approval matrix
- `creative-document`: template/style/asset registry, DOCX/PPTX/PDF/HTML renderer, layout validation, citation rendering, draft output artifact
- `connectors`/`resource`: Outlook, KakaoTalk, GitHub, VDR, Plaud, ERP export 같은 read-only ingestion과 resource expansion

## 지금 들어있는 것

- Hermes가 읽을 수 있는 프로젝트 컨텍스트: `AGENTS.md`
- 전체 사용자 매뉴얼: `docs/USER_MANUAL.ko.md`
- 개인 개발 프로젝트 관리 skill: `skills/personal-dev/project-manager/SKILL.md`
- 개인 개발 프로젝트 포트폴리오: `examples/dev-projects.json`
- 로펌 domain pack skill: `skills/law-firm/`
- creative/document domain pack: `packs/creative-document/`
- core/domain data contracts: `schemas/`
- safe demo data: `examples/`
- deterministic CLI scripts: `scripts/`
- read-only dashboard/API/operator artifacts: `artifacts/`

## 빠른 실행

PowerShell에서는 `npm.cmd`를 쓰는 것이 안전합니다.

```powershell
npm.cmd run validate
npm.cmd run dev:validate
npm.cmd run dev:brief
npm.cmd run operator:handbook -- --check
npm.cmd run api:smoke
npm.cmd test
```

가장 먼저 볼 결과는 `npm.cmd run dev:brief`입니다. 이 명령은 `examples/dev-projects.json`을 읽어서 오늘의 focus, blocked tasks, review queue, release gaps를 뽑습니다.

로펌 domain pack을 확인하려면:

```powershell
npm.cmd run brief
npm.cmd run law-firm:e2e-report -- --check
```

creative/document domain pack을 확인하려면:

```powershell
npm.cmd run creative-document:e2e-report -- --check
```

전체 v1 freeze 상태를 확인하려면:

```powershell
npm.cmd run release:candidate -- --check
npm.cmd run release:freeze -- --check
```

## Dashboard/API

정적 dashboard는 다음 파일에서 확인합니다.

```text
artifacts/dashboard/latest/index.html
```

read-only Review API를 실행하려면:

```powershell
npm.cmd run api:serve
```

기본 주소는 `http://127.0.0.1:4177`입니다.

주요 route:

- `/health`
- `/api`
- `/api/dashboard`
- `/api/personal-dev-dashboard-apis`
- `/api/matter-cockpit-ui-artifacts`
- `/api/operator-handbooks`
- `/api/v1-freezes`

## Hermes에 붙이는 방법

Hermes가 설치되어 있지 않아도 이 저장소의 CLI와 문서는 바로 사용할 수 있습니다. Hermes에 붙일 때는 이 저장소를 project operations harness로 보고, 필요한 domain skill을 선택해 사용합니다.

예시 지시:

```text
Use the personal-dev project-manager skill and summarize today's development focus from examples/dev-projects.json.
```

```text
Use the law-firm matter-ops skill and generate a daily brief from examples/project-alpha-matter.json.
```

이 워크스페이스를 Hermes 전역 skill 경로에 연결할 때는 개인 개발과 로펌 skill을 모두 연결할 수 있습니다. 기존 문서의 `HERMES_LAW_HARNESS_DIR` 이름은 과거 호환용입니다. 의미상으로는 이 저장소 전체 경로를 가리키는 harness directory입니다.

## 운영 원칙

- 프로젝트와 domain data는 stable ID로 분리합니다.
- personal-dev, law-firm, creative-document context를 섞지 않습니다.
- 모든 release-facing, client-facing, legal-facing, protected output은 human review gate를 통과해야 합니다.
- deterministic script로 먼저 구조화하고, LLM은 설명/초안/검토 보조로 제한합니다.
- audit trail에는 source, timestamp, confidence, responsible owner, review status를 남깁니다.
- 외부 서비스, live API, API key는 명시 승인 전 추가하지 않습니다.

## 다음에 읽을 문서

- 전체 입문 매뉴얼: `docs/USER_MANUAL.ko.md`
- 개인 개발 하네스: `docs/personal-dev-harness.md`
- 플랫폼 아키텍처: `docs/architecture.md`
- dashboard: `docs/review-dashboard.md`
- Review API: `docs/review-api.md`
- operator handbook: `docs/operator-handbook.md`
- 로펌 matter data contract: `docs/matter-data-contract.md`
