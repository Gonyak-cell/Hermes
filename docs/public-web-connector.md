# Public Web Connector

Public Web Connector는 Crawl4AI 계열 CLI를 Hermes 리서치 엔진으로 직접 승격하지 않고, 명시 URL allowlist 기반의 resource connector로만 다룬다.

## 적용 위치

- `src/public-web-connector.mjs`가 allowlist, classification, private network 차단을 검사한다.
- `scripts/public-web-connector.mjs`와 `npm run connectors:public-web`으로 fixture 기반 artifact를 만들 수 있다.
- `examples/public-web-connector/allowed-public-pages.json`은 network 없는 기본 fixture smoke input이다.

## 안전 규칙

- 허용 classification은 `P0_PUBLIC`, `P1_INTERNAL`뿐이다.
- 검색어 기반 crawling은 금지한다.
- `file:`, `data:`, `ftp:`, localhost/private network target은 차단한다.
- 기본 fixture mode는 network와 `crwl`을 실행하지 않는다.
- live mode는 명시 `--live`와 local `crwl` command가 있을 때만 사용한다.

생성된 markdown snapshot은 곧바로 법률 리서치 결과가 아니라 resource expansion candidate이며, human review 대상이다.
