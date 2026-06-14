# Hermes Desktop Local Launch Runbook - 2026-06-14

이 문서는 `Hermes Operator Desktop`을 로컬에서 검증하고 실행하는 절차다.

이 절차는 로컬 실행 절차일 뿐이며 production launch approval, production PASS, enterprise PASS, protected closeout, deployment authorization, GitHub independent approval이 아니다. 현재 데스크톱 앱은 Hermes evidence를 읽는 operator surface이며 source of truth가 아니다.

## Who Should Use This

- Hermes를 로컬 데스크톱 앱 형태로 열어 보고 싶은 owner/operator.
- release, factory, review, artifact evidence를 한 화면에서 확인하려는 개발자.
- 데스크톱 UI 변경 후 read-only boundary가 깨지지 않았는지 확인하려는 reviewer.

## Prerequisites

| Requirement | Expected State |
|---|---|
| Repo | `/Users/jws/Documents/Codex/Hermes` |
| Node | root `package.json` engine 범위: `>=20 <27` |
| npm | root `package.json` engine 범위: `>=10 <12` |
| Desktop dependencies | `apps/desktop/package-lock.json` 기준 설치 완료 |
| Desktop posture | read-only, single-owner lower-trust RC |

## One-Command Local Preflight

출시 후보로 데스크톱 UI를 볼 수 있는지 확인하려면 아래 명령을 실행한다.

```bash
npm run desktop:local-preflight
```

이 명령은 다음을 순서대로 확인한다.

1. `desktop:packaging-manifest`: local build, packaging, signing, notarization, publish, auto-update boundary artifact를 생성한다.
2. `desktop:packaging-manifest -- --check`: autoUpdater와 packaging authority가 닫혀 있는지 확인한다.
3. `desktop:read-model`: desktop read model artifact를 최신 source 기준으로 생성한다.
4. `desktop:read-model -- --check`: desktop read model이 20개 source와 6개 section을 fail-closed 방식으로 읽을 수 있는지 확인한다.
5. `desktop:authority-boundary`: desktop authority boundary artifact를 최신 source 기준으로 생성한다.
6. `desktop:authority-boundary -- --check`: deploy, git push, approval apply, receipt apply, connector write, secret read, raw exposure, desktop write authority가 닫혀 있는지 확인한다.
7. `test:desktop`: Electron security policy, renderer contract, read model sanitizer, preview redaction, forbidden trust-copy policy를 테스트한다.
8. `desktop:build`: Vite renderer bundle을 생성한다.
9. `desktop:smoke:render`: Electron으로 실제 화면을 열고 DOM text에서 금지 trust/approval 문구가 새지 않는지 검사한다.

생성되는 스모크 산출물은 `tmp/` 아래에 있으며 커밋 대상이 아니다.

## Run The Built Desktop App

preflight가 통과한 뒤 빌드된 앱을 로컬에서 열려면 아래 명령을 실행한다.

```bash
npm run desktop:start
```

`desktop:start`는 `apps/desktop/dist/renderer/index.html`을 Electron에서 연다. 이 명령은 앱을 실행하지만 deploy, git push, approval apply, receipt apply, connector write, secret read, raw source exposure를 수행하지 않는다.

## Development Mode

UI를 수정하면서 바로 확인하려면 아래 명령을 실행한다.

```bash
npm run desktop:dev
```

development mode는 Vite dev server를 `127.0.0.1:5173`에 띄우고 Electron이 해당 local URL만 읽도록 한다. 외부 origin, navigation, permission request는 main-process guard에서 차단된다.

## Manual Smoke Commands

개별 화면을 확인하고 싶을 때는 아래 명령을 사용할 수 있다.

```bash
npm run desktop:smoke:render -- --out=tmp/desktop-render-smoke.png --text-out=tmp/desktop-render-smoke-report.json
npm run desktop:smoke:render -- --screen=factory --out=tmp/desktop-render-smoke-factory.png --text-out=tmp/desktop-render-smoke-factory-report.json
npm run desktop:smoke:render -- --width=430 --height=900 --out=tmp/desktop-render-smoke-narrow.png --text-out=tmp/desktop-render-smoke-narrow-report.json
npm run desktop:smoke:render -- --preview=docs/release-owner-decision-2026-06-14.md --out=tmp/desktop-render-smoke-preview.png --text-out=tmp/desktop-render-smoke-preview-report.json
```

각 report의 `forbidden_trust_copy_matches`가 빈 배열이어야 한다.

## Expected Safe Language

화면은 다음처럼 낮은 권한 상태를 유지해야 한다.

| Unsafe Claim To Avoid | Safe Desktop Wording |
|---|---|
| GitHub independent approval | Independent review: not pursued or missing |
| Production launch approval | Launch approval: missing or not approved |
| Deployment authorization | Deploy authority: not authorized |
| production PASS | not shown as approval state |
| enterprise PASS | not shown as approval state |

문서 preview에서 위 unsafe claim이 원문에 들어 있더라도 화면에는 `[redacted ... claim]` 형태로만 표시되어야 한다.

## What This Does Not Do

- macOS `.app` packaging, signing, notarization, auto-update를 수행하지 않는다.
- GitHub release를 publish하지 않는다.
- local RC tag를 push하지 않는다.
- owner production launch decision을 대체하지 않는다.
- enterprise independent trust를 만들지 않는다.

## Troubleshooting

| Symptom | First Check |
|---|---|
| Desktop opens blank | `npm run desktop:build`를 다시 실행한다. |
| `desktop:smoke:render` fails with forbidden copy | 최근 UI label 또는 preview redaction 변경에서 unsafe claim이 새었는지 확인한다. |
| source preview blocked | 해당 path가 desktop read model source row에 있고 markdown allowlist에 포함되어 있는지 확인한다. |
| artifact rows missing | `npm run desktop:read-model -- --check` 결과의 blocker row를 먼저 확인한다. |

## Release Boundary

이 runbook을 통과해도 상태는 다음 그대로다.

- `deployment_allowed_now`: false
- `git_push_allowed_now`: false
- `approval_application_allowed_now`: false
- `receipt_application_allowed_now`: false
- `connector_write_allowed_now`: false
- `secret_read_allowed_now`: false
- `raw_source_exposure_allowed`: false
- `production_pass_enabled`: false
- `enterprise_pass_enabled`: false
- `protected_closeout_enabled`: false
- `desktop_write_authority_enabled`: false
