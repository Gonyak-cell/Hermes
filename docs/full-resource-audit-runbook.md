# Full Resource Audit Runbook

목표: `02_Template`와 `플러그인`의 모든 파일을 실제 본문 기준으로 점검하고, 그 결과를 Hermes Harness 사전 설계에 반영한다.

## 1. 현재 상태 확인

```bash
npm run resource:audit
```

산출물:

- `audits/resource-audit/latest/resource-audit.json`
- `audits/resource-audit/latest/materialization-queue.json`
- `audits/resource-audit/latest/extractor-queue.json`
- `audits/resource-audit/latest/unsupported-queue.json`
- `audits/resource-audit/latest/summary.md`

현재 2026-05-22 기준:

- 전체 파일: 3,836개
- 로컬 파일: 1,123개
- OneDrive `dataless` 파일: 2,713개
- `dataless` 용량: 약 1.09 GB
- 후보 도메인: law-firm 2,868개, personal-dev 354개, creative 162개, unclassified 452개

## 2. Materialization Gate

OneDrive File Provider 항목은 macOS에서 `dataless` placeholder로 존재할 수 있다. 이 상태의 파일은 파일명과 크기는 보이지만 본문이 로컬에 없으므로 extractor에 넘기면 안 된다.

필수 조치:

1. Finder에서 `/Users/jws/Library/CloudStorage/OneDrive-개인/02_Template` 폴더를 연다.
2. `02_Template` 폴더를 우클릭한다.
3. OneDrive 메뉴에서 `Always Keep on This Device` 또는 한국어 UI의 `항상 이 장치에 유지`를 선택한다.
4. OneDrive 동기화가 끝날 때까지 기다린다.
5. 아래 명령으로 `Needs materialization`이 0에 가까워졌는지 확인한다.

```bash
npm run resource:audit
```

완료 기준:

- `Needs materialization: 0`
- 또는 남은 파일이 명시적으로 `waived` 처리됨

## 3. Extractor Gate

materialization 이후 다음 순서로 extractor를 실행한다.

1. plain text 계열: `md`, `txt`, `json`, `yaml`, `js`, `py`, `mjs`, `ps1`
2. plugin/archive 계열: `.plugin`, `zip`
3. Office Open XML 계열: `docx`, `pptx`, `xlsx`
4. PDF 계열: text layer 추출 후 OCR 필요 여부 분류
5. Outlook/legacy 계열: `msg`, `doc`, `hwp`, `xlsb`
6. image/media 계열: `jpg`, `png`, `webp`, `mp4`

각 extractor는 다음을 남긴다.

- raw file hash
- extracted text hash
- table hash
- style/template fingerprint
- semantic classification
- capability mapping
- extractor coverage
- unsupported reason

현재 로컬 파일에 대한 1차 추출 명령:

```bash
npm run resource:extract
```

산출물:

- `audits/resource-audit/latest/extraction/resource-extraction.json`
- `audits/resource-audit/latest/extraction/capability-signals.json`
- `audits/resource-audit/latest/extraction/extraction-failures.json`
- `audits/resource-audit/latest/extraction/summary.md`

2026-05-22 현재 추출 결과:

- 입력 파일: 1,045개
- 추출 성공: 1,045개
- 추출 실패: 0개
- `archive_header_probe`: 1개 (`.zip` 확장자이나 유효 zip이 아닌 파일로 기록)

현재 등록된 1차 extractor:

- `plain_text_probe`
- `docx_word_xml_probe`
- `pptx_open_xml_probe`
- `xlsx_open_xml_probe`
- `claude_plugin_archive_probe`
- `zip_archive_probe`
- `archive_header_probe`

## 4. Design Update Gate

전체 파일 점검 결과는 아래 설계 문서에 반영한다.

- `docs/resource-audit-prearchitecture.md`
- `docs/architecture.md`
- `docs/implementation-roadmap.md`

반영 대상:

- Resource Registry
- Capability Catalog
- Extractor Registry
- Template Intelligence Layer
- Plugin Runtime Boundary
- Evidence OS
- Personal Dev Harness Pack

최종 설계 확정 조건:

- 모든 파일이 `readable`, `unsupported_but_recorded`, 또는 `waived` 상태
- 최신/중복/legacy 플러그인 분리 완료
- LDD 문서유형별 extractor coverage matrix 작성
- 로펌용/개인개발용/콘텐츠용 리소스 분리 완료
