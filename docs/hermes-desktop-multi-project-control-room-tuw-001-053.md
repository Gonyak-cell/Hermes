# Hermes Desktop Multi-Project Control Room TUW-001-053

Status: closed local-only implementation tracker.

This document fixes the current desktop multi-project work into one non-overlapping TUW sequence. Hermes Desktop remains local-only, read-only, and artifact-backed. It is not a source of truth and it does not open commit, push, merge, deploy, approve, apply, receipt apply, production PASS, enterprise PASS, protected closeout, connector write, raw source exposure, or secret read authority.

## Pyramid Gates

| Layer | Range | Gate |
|---|---:|---|
| L1 Project Operating Contract | TUW-001-TUW-009 | `npm run platform:project-operating-contract -- --check` |
| L2 Multi-Project Read Model | TUW-010-TUW-018 | `npm run desktop:read-model -- --check` |
| L3 Control Room Main Surfaces | TUW-019-TUW-027 | `npm run desktop:smoke:render -- --screen=projects` and default queue smoke |
| L4 Project Drilldown | TUW-028-TUW-035 | desktop tests plus Projects smoke |
| L5 Safe Control Affordances | TUW-036-TUW-043 | `npm run test:desktop` authority/preview tests |
| L6 UX, i18n, Visual Density | TUW-044-TUW-048 | desktop smoke screenshots and renderer contract tests |
| L7 Verification, Preflight, Runbook | TUW-049-TUW-053 | `npm run desktop:local-preflight`, `npm run validate:core`, `git diff --check` |

## TUW Registry

| TUW | Layer | Testable Unit | Required Evidence | Current Status |
|---:|---|---|---|---|
| 001 | L1 | Define Project Operating Contract identity and scope | schema + generator constants | implemented |
| 002 | L1 | Bind multi-project source artifact as the only upstream project input | source status row + hash | implemented |
| 003 | L1 | Project identity rows with domain-pack boundary | identity row validation | implemented |
| 004 | L1 | Project source inventory rows | source inventory artifact | implemented |
| 005 | L1 | Project state taxonomy and state rows | state row validation | implemented |
| 006 | L1 | Progress rows with goal, phase, confidence, remaining units | progress row validation | implemented |
| 007 | L1 | Blocker and next safe action taxonomy | taxonomy rows | implemented |
| 008 | L1 | Per-project authority boundary rows | unsafe flag count zero | implemented |
| 009 | L1 | Contract closeout artifact, schema check, and check mode | `platform:project-operating-contract -- --check` | implemented |
| 010 | L2 | Add project contract to desktop read allowlist | read-model source row | implemented |
| 011 | L2 | Add Projects section to desktop read model | 7/7 sections | implemented |
| 012 | L2 | Add project projection summary rows | project_count/ready/blocked/stale cards | implemented |
| 013 | L2 | Add project rows for desktop table consumption | `project_rows` schema | implemented |
| 014 | L2 | Add project detail rows for drilldown | `project_detail_rows` schema | implemented |
| 015 | L2 | Sanitize project projection in Electron main process | desktop sanitizer tests | implemented |
| 016 | L2 | Fail closed on missing or unsafe project contract | root read-model tests | implemented |
| 017 | L2 | Queue projection binds to project projection | default queue smoke | implemented |
| 018 | L2 | Historical drift row for project source freshness | explicit stale/refresh fixture | implemented |
| 019 | L3 | Projects navigation maps to Projects section | renderer contract test | implemented |
| 020 | L3 | Projects table shows state, domain, phase, blockers, freshness, next action | Projects smoke screenshot | implemented |
| 021 | L3 | Queue screen starts with multi-project control | default smoke screenshot | implemented |
| 022 | L3 | Right panel shows selected project before generic authority list | Projects/Queue smoke screenshot | implemented |
| 023 | L3 | Governance screen rolls up project authority boundary | governance smoke target | implemented |
| 024 | L3 | Reviews screen connects review-needed project count | review projection fixture | implemented |
| 025 | L3 | Gates screen connects project blockers to gate readiness | gate projection fixture | implemented |
| 026 | L3 | Evidence screen filters project-safe evidence rows | evidence screen fixture | implemented |
| 027 | L3 | Sources screen exposes project contract source row and preview | source preview smoke | implemented |
| 028 | L4 | Select project from Projects table | visual selected row | implemented |
| 029 | L4 | Select project from Queue table | default queue visual selected row | implemented |
| 030 | L4 | Project inspector shows progress, source age, and unsafe flags | Projects/Queue smoke screenshot | implemented |
| 031 | L4 | Project inspector shows source path and state reason below fold | renderer smoke + DOM text report | implemented |
| 032 | L4 | Blocked project detail renders blocker type and remediation hint | blocked fixture | implemented |
| 033 | L4 | Stale project detail renders refresh-required notice | stale fixture | implemented |
| 034 | L4 | Review-needed project detail renders review packet hint | review-needed fixture | implemented |
| 035 | L4 | Owner-action-needed detail renders owner decision draft hint | owner-action fixture | implemented |
| 036 | L5 | Safe action chips are display-only | renderer contract test | implemented |
| 037 | L5 | Source preview is allowlisted and redacted | desktop preview tests | implemented |
| 038 | L5 | No commit/push/merge/deploy/apply affordance appears | trust-copy policy + DOM smoke | implemented |
| 039 | L5 | Copy-command affordance is represented as safe text only | copy fixture | implemented |
| 040 | L5 | Open-artifact affordance is preview-only, not OS write | preview fixture | implemented |
| 041 | L5 | Draft-review packet affordance is not a review submission | review draft fixture | implemented |
| 042 | L5 | Draft-owner decision affordance is not owner approval | owner draft fixture | implemented |
| 043 | L5 | Refresh-artifact affordance is request/display only | refresh fixture | implemented |
| 044 | L6 | Korean/English locale toggle remains available | renderer i18n test | implemented |
| 045 | L6 | Korean default copy uses operator-console language | renderer i18n test | implemented |
| 046 | L6 | Dense project table avoids horizontal overflow at desktop width | Projects smoke screenshot | implemented |
| 047 | L6 | Narrow viewport avoids text overlap and blank panel | narrow smoke screenshot | implemented |
| 048 | L6 | Amplitude-inspired density stays informational, not marketing layout | visual smoke review | implemented |
| 049 | L7 | Local preflight includes project contract write/check | `desktop:local-preflight` | implemented |
| 050 | L7 | Local preflight includes Queue and Projects smoke | `desktop:local-preflight` | implemented |
| 051 | L7 | Runbook documents 22 sources, 7 sections, and Project contract | launch runbook | implemented |
| 052 | L7 | Core validation and diff whitespace gates pass | `validate:core`, `git diff --check` | implemented |
| 053 | L7 | Final desktop multi-project closeout packet records remaining non-production blockers | `docs/hermes-desktop-multi-project-control-room-closeout-2026-06-16.md` | implemented |

## Current Verification Envelope

The current implemented slice is validated by:

```bash
npm run platform:project-operating-contract -- --check
npm run desktop:read-model -- --check
npm run test:desktop
npm run desktop:local-preflight
npm run validate:core
git diff --check
```

`production_pass_enabled`, `enterprise_pass_enabled`, `protected_closeout_enabled`, and all desktop write/deploy/apply authorities remain false.

Final closeout evidence is recorded in `docs/hermes-desktop-multi-project-control-room-closeout-2026-06-16.md`.
