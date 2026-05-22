# Personal Developer Hermes Harness

이 레이어는 로펌용 matter 관리가 아니라, 사용자가 직접 개발하는 프로젝트를 관리하기 위한 Hermes 하네스입니다.

## 목표

Hermes가 매일 다음 질문에 답하게 만듭니다.

- 오늘 무엇을 먼저 해야 하나?
- 어떤 프로젝트가 막혔나?
- 어떤 작업이 리뷰 대기인가?
- 릴리스 전에 무엇이 남았나?
- 지금 30-90분 안에 끝낼 수 있는 가장 작은 다음 행동은 무엇인가?

## 핵심 파일

- `examples/dev-projects.json`: 개인 개발 프로젝트 포트폴리오
- `schemas/dev-projects.schema.json`: 데이터 계약
- `scripts/dev-project-brief.mjs`: daily project brief 생성기
- `scripts/validate-dev-projects.mjs`: 포트폴리오 검증기
- `skills/personal-dev/project-manager/SKILL.md`: Hermes skill

## 실행

```bash
cd /Users/jws/Documents/Codex/Hermes
npm run dev:validate
npm run dev:brief
```

Hermes에서 쓰려면:

```bash
/Users/jws/.local/bin/hermes --skills personal-dev-project-manager
```

Hermes에게 이렇게 말하면 됩니다.

```text
examples/dev-projects.json을 보고 오늘 내가 개발 프로젝트에서 뭘 해야 하는지 정리해줘.
막힌 프로젝트는 다음 30분 액션으로 줄여줘.
```

## 운영 방식

처음에는 GitHub/Linear/Notion 연동 없이 로컬 JSON으로 시작합니다. 이유는 단순합니다.

- 빠르게 수정할 수 있습니다.
- Hermes의 판단 근거가 눈에 보입니다.
- 프로젝트 관리 체계가 굳기 전 인증과 API 문제에 시간을 쓰지 않습니다.

나중에 연결할 수 있는 원천:

- GitHub Issues/PRs
- local git status
- Linear
- Notion
- README/TODO 파일
- commit log
- CI 결과

## 추천 루틴

아침:

```bash
npm run dev:brief
```

작업 시작 전:

- Recommended Focus 1개만 고릅니다.
- 30-90분짜리 작업으로 줄입니다.
- 끝나면 `examples/dev-projects.json`의 task status를 바꿉니다.

저녁:

- done으로 바꿀 것
- blocked로 바꿀 것
- 내일 next로 올릴 것
- 새로 생긴 decision

이 네 가지만 업데이트합니다.
