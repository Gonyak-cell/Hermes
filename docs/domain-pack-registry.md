# Domain Pack Registry

`Domain Pack Registry`는 `packs/*/pack.json`을 읽어 Law Firm, Personal Dev, Creative Document, Common pack을 버전 있는 플러그인형 패키지로 등록한다.

Core는 pack 내부 구현을 import하지 않는다. Pack manifest에 적힌 capability manifest를 읽고, 기존 capability contract와 policy matrix를 통과한 것만 registry에 올린다.

## 실행

```bash
npm run packs:registry
```

검증만 할 때:

```bash
npm run packs:validate
```

출력:

- `domain-pack-registry.json`: 등록된 pack과 capability, validation 결과
- `summary.md`: 사람이 읽는 요약

## Pack Manifest 기준

각 `pack.json`은 다음을 포함해야 한다.

- `pack_id`, `pack_version`, `core_compatibility`
- `capabilities`: capability manifest 경로와 version
- `policies`: pack-level policy overlay
- `schemas`, `workflows`, `gates`
- `templates`, `extractors`, `renderers`
- `migrations`, `golden_cases`
- `dependencies`
- `permissions`

## 현재 Pack

- `common`: evidence, approval, rendering, workflow utility 공통 경계
- `law-firm`: LDD, VDR, litigation, contract, citation, attorney approval
- `personal-dev`: Claude Code/Codex worktree, diff review, test gate, merge approval
- `creative-document`: PPTX 보고자료, 디자인 시스템, content/document rendering

## Goal 내 위치

이 단계는 `/goal`의 “Domain Pack은 core를 수정하지 않고 추가 가능한 플러그인형 구조로 만든다”를 실제 registry 계약으로 고정한다. 이후 새로운 pack이나 capability를 추가할 때 core를 수정하는 대신 `pack.json`과 capability manifest만 추가하면 된다.
