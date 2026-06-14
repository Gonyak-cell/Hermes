# Hermes Desktop Dependency Baseline

Date: 2026-06-14

This document records the Stage 2 dependency and lockfile decision before adding
the Electron/Vite desktop shell. It is not production launch approval,
enterprise PASS, protected closeout, deployment authorization, or GitHub
independent approval.

## Package Manager Decision

- Package manager: `npm`, matching root `packageManager`.
- Root package remains the Hermes harness source of truth.
- Desktop dependencies are isolated under `apps/desktop`.
- Root scripts delegate to `npm --prefix apps/desktop ...`.
- Desktop dependency installation writes `apps/desktop/package-lock.json`.
- Root `package-lock.json` is not used for Electron/Vite dependency pinning.

## Pinned Majors

The first desktop shell pins exact package versions inside these major lines.
The initial Stage 2 candidate was checked against `npm audit`; Electron 35 and
Vite 6 were rejected because the current advisory database reports high
severity findings. The baseline therefore starts on advisory-clean majors that
match the local Node 22 runtime.

- `electron` major 42
- `vite` major 8
- `@vitejs/plugin-react` major 5
- `react` major 19
- `react-dom` major 19

Exact versions must remain lockfile-bound. Any major upgrade requires a separate
review packet, lockfile diff, desktop security test run, renderer smoke, and
owner review.

## Lockfile Policy

- Commit `apps/desktop/package-lock.json` with the desktop shell.
- Do not hand-edit lockfiles.
- Run dependency changes through `npm install --prefix apps/desktop`.
- Keep dependency updates separate from protected release, production, and
enterprise-trust decisions.
- Do not add external service SDKs, API keys, telemetry exporters, or cloud
mutation clients to the desktop shell.

## CVE And Supply Chain Cadence

- Before each desktop release candidate, run `npm audit --prefix apps/desktop`.
- Review Electron release notes before changing the Electron major.
- Treat high or critical advisories in Electron, Vite, React, or build tooling as
  release blockers unless a documented non-applicability note exists.
- Re-run desktop unit tests and renderer smoke after every dependency update.

## Authority Boundary

Dependency installation does not open:

- desktop write authority;
- shell execution from renderer;
- deploy;
- git push;
- approval apply;
- receipt apply;
- connector write;
- secret read;
- raw protected source exposure;
- production PASS;
- enterprise PASS.
