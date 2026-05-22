# Hermes Law Firm Harness

Hermes Agent를 위한 개인/업무용 하네스 저장소입니다. 현재 두 레이어가 있습니다.

- 개인 개발 프로젝트 관리용 하네스
- 로펌 matter 운영용 하네스

지금 중심은 **개인 개발 프로젝트 관리**입니다. 목표는 Hermes가 내가 개발하는 프로젝트들의 다음 액션, 막힌 것, 리뷰 대기, 릴리스 준비 상태를 계속 추적하게 만드는 것입니다.

## 지금 들어있는 것

- Hermes가 읽을 수 있는 프로젝트 컨텍스트: `AGENTS.md`
- 개인 개발 프로젝트 관리 skill: `skills/personal-dev/project-manager/SKILL.md`
- 개인 개발 프로젝트 포트폴리오: `examples/dev-projects.json`
- 로펌용 Hermes skill 초안: `skills/law-firm/`
- matter 데이터 계약: `schemas/matter.schema.json`
- 샘플 사건 데이터: `examples/project-alpha-matter.json`
- deterministic daily brief CLI: `scripts/matter-brief.mjs`
- 보안, 운영, 구축 로드맵 문서: `docs/`

## 빠른 실행

```bash
npm run validate
npm run dev:validate
npm run dev:brief
npm run brief
npm run intake:kakao
npm run intake:outlook
npm test
```

`npm run dev:brief`는 개인 개발 프로젝트 포트폴리오를 읽어서 오늘의 focus, blocked tasks, review queue, release gaps를 뽑습니다.

`npm run brief`는 샘플 matter를 읽어서 오늘의 사건 운영 브리프를 만듭니다. `npm run intake:kakao`와 `npm run intake:outlook`은 카카오톡 export와 Outlook 이메일에서 업무·기한·문서·질문 후보를 뽑습니다. 이 생성기는 LLM 없이 동작합니다. Hermes skill은 이 스크립트를 불러 먼저 사실 구조를 정리하고, 이후 변호사 검토용 문안만 LLM에 맡기는 흐름을 전제로 합니다.

## Hermes에 붙이는 방법

1. Hermes를 설치합니다. macOS/Linux/WSL2 기준 공식 설치는 아래입니다.

```bash
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
```

2. 이 폴더에서 Hermes를 실행합니다.

```bash
hermes
```

3. Hermes가 `AGENTS.md`를 읽은 상태에서 아래처럼 지시합니다.

```text
Use the law-firm matter-ops skill and generate a daily brief from examples/project-alpha-matter.json.
```

이 워크스페이스를 Hermes 전역 skill 경로에 연결하려면:

```bash
ln -sfn /Users/jws/Documents/Codex/Hermes/skills/law-firm ~/.hermes/skills/law-firm
printf '\nHERMES_LAW_HARNESS_DIR=/Users/jws/Documents/Codex/Hermes\n' >> ~/.hermes/.env
hermes skills list
```

Hermes가 아직 설치되어 있지 않아도 이 저장소의 CLI와 문서는 바로 사용할 수 있습니다.

## 구축 원칙

- Matter 단위로 기억을 보존합니다.
- 메신저와 회의록은 곧바로 task, deadline, pending question 후보로 구조화합니다.
- 문서와 증거는 claim, issue, fact, source로 연결합니다.
- 모든 client-facing output에는 human review gate를 둡니다.
- 비밀유지, 개인정보, 접근권한, 로그 보존을 기능보다 먼저 설계합니다.

## 참고한 공식 자료

- Hermes README: https://github.com/NousResearch/hermes-agent
- Hermes docs: https://hermes-agent.nousresearch.com/docs/
- Hermes skills guide: https://hermes-agent.nousresearch.com/docs/developer-guide/creating-skills
- Hermes MCP guide: https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp
- Hermes context files: https://hermes-agent.nousresearch.com/docs/user-guide/features/context-files
