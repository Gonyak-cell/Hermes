# Hermes Desktop App Plan - 2026-06-14

이 문서는 Hermes를 데스크톱 앱으로 만들기 위한 단계별 구현 계획이다. 목표는 Hermes 자체를 별도 제품처럼 포장하는 것이 아니라, Hermes control-plane harness를 사람이 감독하기 쉬운 `Hermes Operator Desktop`으로 제공하는 것이다.

이 계획은 구현 승인이나 배포 승인이 아니다. desktop 앱은 처음부터 source of truth가 아니며, release approval, production PASS, enterprise PASS, protected closeout, deployment, connector write, secret read, raw source exposure를 열지 않는다.

## Current Baseline

| Field | Value |
|---|---|
| Repository | `Gonyak-cell/Hermes` |
| Current commit | `5e332b1c6327b255cf9bf418bc455b7965172658` |
| Local RC tag | `v0.1.0-rc.20260614.5e332b1` |
| Trust mode | `single-owner lower-trust RC` |
| Existing runtime | Node ESM scripts, read-only Review API, deterministic artifacts |
| Existing desktop posture | Desktop-oriented operator surface only |
| Recommended desktop stack | Electron + Vite renderer + local read-only adapter |
| Claude plan review | re-review complete; 0 blocking findings before Stage 1 |
| Initial review receipt | `artifacts/hermes-desktop-app-plan-review/claude-desktop-app-plan-review-receipt.json` |
| Re-review receipt | `artifacts/hermes-desktop-app-plan-review/claude-desktop-app-plan-rereview-receipt.json` |

## Claude Review Disposition

Claude Code was asked for an Opus 4.8 Ultracode read-only plan review. The actual CLI run resolved model usage to `claude-opus-4-7`; the receipt preserves the requested engine string and the observed model separately.

The initial review found the direction sound but not yet implementation-ready. The following changes were mandatory before Stage 1 implementation and have been incorporated into this plan:

1. Electron security defaults must explicitly require `sandbox: true`, `contextIsolation: true`, `webSecurity: true`, strict CSP, and outbound renderer network denial tests.
2. The artifact adapter must use a concrete allowlist and denylist, not broad `artifacts/*/latest` reads.
3. The UI must include negative fixtures forbidding unsafe trust strings such as `production PASS`, `enterprise PASS`, `enterprise trust`, `independently approved`, and `production launch approved`.
4. The authority boundary must become a `--check`-able deterministic artifact, not only a prose document.
5. The desktop read model must have a committed JSON Schema.
6. The test layout and command paths must match.
7. The desktop read model must bind to existing `operator-handbook` artifacts instead of inventing a parallel operator surface.

The re-review found these blocking issues adequately addressed. Residual items are non-blocking and should be handled in later stages:

- enumerate exact normalized Claude receipt subfields before Stage 4;
- add packaging build-manifest and `autoUpdater` disabled assertions before Stage 6;
- add a Stage 0 main-freeze note if the release-doc commit is delayed;
- remove duplicate inline review questions if they become noisy;
- specify exact Korean font asset name, license, and bundling policy before UI implementation.

## Product Definition

Hermes Desktop is a local operator console for:

- current release-candidate state;
- factory gate and Stage6/7 readiness;
- review packets and receipts;
- evidence trace and artifact summaries;
- launch checklist and owner decisions;
- local validation command visibility;
- read-only Review API browsing.

Hermes Desktop is not:

- a deployment console;
- a GitHub approval replacement;
- a production authority surface;
- a secret manager;
- a raw source browser for protected payloads;
- a connector-write runtime;
- an enterprise trust attestation system.

## Architecture Principles

1. Desktop is a view over Hermes evidence, not a new source of truth.
2. All app actions start read-only.
3. The renderer cannot execute shell commands directly.
4. The main process exposes only typed, allowlisted read APIs.
5. Any future command execution must go through a separate protected-action packet and receipt model.
6. Locale and typography are first-class contracts: Korean / English selectable, Korean text uses the approved Korean font asset when available.
7. UI design follows dense operator-console patterns, not marketing landing-page composition.
8. The desktop package must preserve `single-owner lower-trust RC` language unless independent review is later reopened.

## Proposed File Layout

```text
apps/
  desktop/
    package.json
    electron.vite.config.mjs
    src/
      main/
        main.mjs
        preload.mjs
        read-model.mjs
        security-policy.mjs
      renderer/
        index.html
        src/
          app.jsx
          i18n/
            en.json
            ko.json
          styles/
            tokens.css
            app.css
          components/
            app-shell.jsx
            status-band.jsx
            evidence-table.jsx
            decision-panel.jsx
            review-packet-panel.jsx
            launch-checklist.jsx
            authority-boundary.jsx
          routes/
            release.jsx
            factory.jsx
            reviews.jsx
            artifacts.jsx
            settings.jsx
      test/
        read-model.test.mjs
        security-policy.test.mjs
        renderer-smoke.test.mjs
docs/
  hermes-desktop-app-plan-2026-06-14.md
```

The exact framework may be adjusted during implementation, but the app must remain local-first, dependency-light, and read-only by default.

## Stage 0 - Release Record Commit

Goal: preserve the current RC evidence and local tag decision before opening desktop implementation.

### TUW D0.1 - Record Current Release Docs

Inputs:

- `docs/release-owner-decision-2026-06-14.md`
- `docs/release-decision-packet-2026-06-14.md`
- `docs/production-launch-checklist-2026-06-14.md`
- `docs/github-final-review-packet-2026-06-14.md`
- `docs/release-note-tag-draft-2026-06-14.md`

Work:

- Review docs for authority boundaries.
- Confirm local RC tag targets `5e332b1c6327b255cf9bf418bc455b7965172658`.
- Commit docs as release record only.

Acceptance:

- `git status --short --branch` shows only intended files before commit.
- `npm run validate:core` passes.
- Commit message clearly says release docs / RC freeze record.

### TUW D0.2 - Create Desktop Branch

Work:

- Create `codex/hermes-desktop-shell` from `main` after release docs are committed.

Acceptance:

- Branch starts from latest local release-record commit.
- Local RC tag remains pointed at `5e332b1c6327b255cf9bf418bc455b7965172658`.

## Stage 1 - Desktop Architecture Freeze

Goal: define the desktop contract before adding Electron code.

### TUW D1.1 - Desktop Authority Boundary

Work:

- Add a deterministic desktop boundary artifact covering:
  - no shell execution from renderer;
  - no deploy;
  - no git push;
  - no approval apply;
  - no receipt apply;
  - no connector write;
  - no secret read;
  - no raw protected source exposure.

Acceptance:

- Add `scripts/desktop-authority-boundary.mjs`.
- Add `npm run desktop:authority-boundary -- --check`.
- Emit:
  - `artifacts/desktop-authority-boundary/latest/desktop-authority-boundary.json`;
  - `artifacts/desktop-authority-boundary/latest/validation-report.json`;
  - `artifacts/desktop-authority-boundary/latest/summary.md`.
- Boundary artifact includes explicit false flags.
- Negative fixture descriptions exist for each forbidden capability.
- Check mode validates without writing or overwriting artifacts.

### TUW D1.2 - Read Model Contract

Work:

- Define the read model the desktop app may consume:
  - release summary;
  - tag summary;
  - gate status;
  - review packet list;
  - checklist state;
  - artifact index;
  - authority boundary.
- Add `schemas/desktop-read-model.schema.json`.
- Use the schema for adapter output validation and preload API typing.

Acceptance:

- Contract can be produced from local docs/artifacts without starting a server.
- Missing artifact paths fail closed with visible blocker rows.
- Schema requires `source_path`, `generated_at`, `status`, `blocker`, and section-level refs for release, factory, reviews, artifacts, and authority boundary.

### TUW D1.3 - Operator Handbook Binding

Work:

- Bind the desktop read model to existing operator-handbook artifacts as the primary operator surface:
  - `artifacts/operator-handbook/latest/operator-handbook.json`;
  - `artifacts/operator-handbook/latest/operator-surfaces.json`;
  - `artifacts/operator-handbook/latest/operator-screens.json`;
  - `artifacts/operator-handbook/latest/operator-workflows.json`;
  - `artifacts/operator-handbook/latest/operator-gates.json`;
  - `artifacts/operator-handbook/latest/operator-handbook-boundary.json`.
- Supplement only missing desktop-specific rows, such as local RC tag projection and desktop review packet references.

Acceptance:

- Desktop does not define a parallel operator truth model.
- Desktop boundary cross-checks `operator-handbook-boundary.json`.
- Missing operator-handbook artifacts render blocker rows, not fallback authority.

### TUW D1.4 - Navigation And Screen Map

Work:

- Define screens:
  - Release;
  - Factory;
  - Reviews;
  - Artifacts;
  - Settings.

Acceptance:

- Every screen has source refs, primary rows, empty state, blocker state, and no-action authority notice.

## Stage 2 - Electron Shell Skeleton

Goal: create a minimal installable desktop shell without business logic mutation.

### TUW D2.1 - App Scaffold

Work:

- Add `apps/desktop/package.json`.
- Add Electron/Vite config.
- Add main, preload, renderer entry files.
- Add local dev command.

Acceptance:

- `npm install` or package-manager decision is documented before dependency changes.
- Electron, Vite, and packaging dependencies are pinned to explicit majors.
- The lockfile policy is documented before dependency installation.
- CVE/supply-chain review cadence is recorded as a desktop dependency baseline.
- `npm run desktop:dev` opens the app locally.
- App title is `Hermes Operator Desktop`.

### TUW D2.2 - Security Defaults

Work:

- Enable context isolation.
- Enable Electron sandbox.
- Keep `webSecurity: true`.
- Disable node integration in renderer.
- Disable node integration in workers.
- Disable remote module.
- Use allowlisted preload API.
- Restrict external navigation.
- Apply strict Content-Security-Policy for local resources only.
- Block renderer `fetch` / XHR to non-local origins.

Acceptance:

- Security policy test verifies unsafe APIs are not exposed.
- Renderer has no direct access to `fs`, `child_process`, `process.env`, or shell commands.
- BrowserWindow `webPreferences` explicitly include `sandbox: true`, `contextIsolation: true`, `webSecurity: true`, `nodeIntegration: false`, and `nodeIntegrationInWorker: false`.
- Network denial test proves non-local renderer outbound requests are blocked.

### TUW D2.3 - Empty Shell UI

Work:

- Implement app shell layout:
  - top status band;
  - left navigation;
  - main evidence table;
  - right decision panel.

Acceptance:

- Desktop viewport renders without overlap at 1440x900.
- Narrow viewport renders without horizontal overflow.
- Korean / English toggle is visible and persists locally.

## Stage 3 - Read-Only Data Adapter

Goal: connect desktop to Hermes evidence without opening execution.

### TUW D3.1 - Artifact Reader

Work:

- Read safe JSON/markdown summaries from a concrete allowlist only.
- Do not read raw review payloads by default.
- Do not read secret-like files.

Initial allowlist:

- `docs/release-owner-decision-2026-06-14.md`
- `docs/release-decision-packet-2026-06-14.md`
- `docs/production-launch-checklist-2026-06-14.md`
- `docs/release-note-tag-draft-2026-06-14.md`
- `docs/operator-handbook.md`
- `docs/dashboard-api-freeze.md`
- `artifacts/operator-handbook/latest/operator-handbook.json`
- `artifacts/operator-handbook/latest/operator-surfaces.json`
- `artifacts/operator-handbook/latest/operator-screens.json`
- `artifacts/operator-handbook/latest/operator-workflows.json`
- `artifacts/operator-handbook/latest/operator-gates.json`
- `artifacts/operator-handbook/latest/operator-handbook-boundary.json`
- `artifacts/release-readiness-control-plane/latest/summary.md`
- `artifacts/production-governance-hardening/latest/summary.md`
- `artifacts/p16800-platform-freeze/latest/summary.md`
- `artifacts/factory-gate-opening-readiness/latest/summary.md`
- `artifacts/factory-stage6-7-execution-readiness/latest/summary.md`

Initial denylist:

- `artifacts/**/raw-output*.json`
- `artifacts/**/raw*.json`
- `artifacts/**/secret*`
- `artifacts/**/provenance/signed-provenance-receipt.json`
- `artifacts/**/review/raw-output.json`
- `.env*`
- files whose path contains `secret`, `credential`, `token`, or `private-key`

Acceptance:

- Unit tests cover present, missing, malformed, and blocked artifact states.
- Returned payload includes source path, generated_at, status, and blocker.
- Denylist fixtures prove blocked paths are not read.

### TUW D3.2 - Release State Projection

Work:

- Show:
  - candidate commit;
  - local RC tag;
  - GitHub independent approval not pursued;
  - production launch not approved;
  - deployment not authorized.

Acceptance:

- UI never displays production PASS or enterprise PASS.
- UI labels this as `single-owner lower-trust RC`.
- Degenerate read-model fixtures cannot make the UI claim independent approval, production launch approval, or enterprise trust.

### TUW D3.3 - Gate And Stage Projection

Work:

- Show:
  - Factory gate readiness;
  - Stage6/7 contract readiness;
  - P16800 freeze status;
  - closed authority flags.

Acceptance:

- Gate rows distinguish evidence readiness from actual gate opening.
- `Gate open now: 0` remains visible.

## Stage 4 - Operator UI Implementation

Goal: build the usable desktop operator experience.

### TUW D4.1 - Release Screen

Work:

- Display release decision packet, owner decision, tag status, CI links, and launch checklist.

Acceptance:

- The screen clearly separates:
  - RC freeze observed;
  - tag local only;
  - tag push missing;
  - production approval missing.

### TUW D4.2 - Reviews Screen

Work:

- Display final reviewer packet, Claude review receipts, and unresolved finding counts where available.
- Read only normalized review receipts from explicit allowlisted paths.
- Do not surface raw model output, full transcript, raw API response, or `raw-output.json`.

Acceptance:

- Claude review is evidence only.
- GitHub independent approval remains not pursued unless a future receipt exists.

### TUW D4.3 - Artifacts Screen

Work:

- Browse safe artifact summaries.
- Open docs as read-only text.

Acceptance:

- Raw payload and secret-like files are hidden or blocked.
- User sees why blocked files are unavailable.

### TUW D4.4 - Settings Screen

Work:

- Locale selector: Korean / English.
- Theme density selector.
- Workspace path display.
- Read-only mode indicator.

Acceptance:

- Korean text uses approved font when available.
- English remains natural for terms like `release`, `gate`, `review`, `artifact`, `RC`.

## Stage 5 - Testing And Verification

Goal: make the desktop app testable without relying on manual confidence.

### TUW D5.1 - Unit Tests

Commands:

```bash
node --test apps/desktop/test/*.test.mjs
```

Acceptance:

- Read model, security policy, missing artifacts, and block states pass.
- Root `npm test` either includes desktop tests or a separate `npm run test:desktop` is documented and wired.

### TUW D5.2 - Renderer Smoke

Work:

- Add a Playwright Electron smoke script, pinned to a documented version.
- Capture desktop and narrow viewport screenshots.
- Check for horizontal overflow and blank screens.

Acceptance:

- 1440x900 and 390x844 pass layout smoke.
- No text overlap in primary screens.
- Screenshots and smoke JSON are written under `artifacts/desktop-renderer-smoke/latest/`.
- CI vs local-only execution is explicitly declared.

### TUW D5.3 - Forbidden Trust String Fixtures

Work:

- Render every route with realistic, missing, malformed, and malicious read-model fixtures.
- Assert the DOM never contains:
  - `production PASS`;
  - `enterprise PASS`;
  - `enterprise trust`;
  - `independently approved`;
  - `production launch approved`.

Acceptance:

- Unsafe trust strings fail tests even if a fixture tries to inject them.
- The UI shows lower-authority language instead.

### TUW D5.4 - Repository Validation

Commands:

```bash
npm run validate:core
npm test
```

Acceptance:

- Existing harness tests remain green.
- Desktop tests are included or documented as separate app tests.

## Stage 6 - Packaging Draft

Goal: create local package evidence without publishing.

### TUW D6.1 - macOS Local Build

Work:

- Add local package command.
- Produce unsigned local app build.

Acceptance:

- Local build artifact exists.
- Build is not notarized.
- Build is not distributed.

### TUW D6.2 - Packaging Boundary

Work:

- Document:
  - unsigned local build;
  - no auto-update;
  - no notarization;
  - no distribution;
  - no production deployment.

Acceptance:

- Desktop packaging cannot be confused with production release.

## Stage 7 - Release Handoff

Goal: prepare the desktop shell for owner review.

### TUW D7.1 - Desktop Review Packet

Work:

- Summarize scope, commands, screenshots, and known blockers.

Acceptance:

- Packet includes authority boundary and test evidence.
- Owner can decide continue / hold / change scope.

### TUW D7.2 - Optional Claude Review

Work:

- Run read-only Claude review on desktop implementation diff.

Acceptance:

- Raw review is captured.
- Findings are normalized.
- Invalid or failed attempts are not counted.

## Stage 8 - Future Authority Lanes

These lanes are explicitly out of scope for the first desktop app:

- command execution from desktop;
- Git push from desktop;
- approval application from desktop;
- receipt application from desktop;
- deployment from desktop;
- connector write from desktop;
- secret manager integration;
- enterprise trust dashboard.

Each lane requires a separate protected-action design, negative fixtures, independent review, and owner approval.

## Recommended Immediate Next Action

1. Commit current release documentation and owner RC freeze record.
2. Keep local RC tag local.
3. Create `codex/hermes-desktop-shell`.
4. Implement Stage 1 and Stage 2 only.
5. Run desktop security and renderer smoke tests before connecting broader artifacts.

## Review Questions For Claude

1. Does this plan keep desktop as an operator surface rather than source of truth?
2. Are the authority boundaries strong enough for a first desktop implementation?
3. Does the Electron choice create avoidable risk compared with Tauri or a browser-only shell?
4. Are the stages ordered safely for a single-owner lower-trust RC?
5. Are the testable units specific enough to execute without hidden production/deploy authority?
6. What blockers must be fixed before implementation starts?
