# Hermes Global Operator Console Amplitude Reference Plan

Source reference pack: `/Users/jws/Applications/LazyWeb/Amplitude web Feb 2025`

This plan converts the full Amplitude web February 2025 LazyWeb reference folder into a Hermes Global Operator Console design execution package. The source screenshots are visual evidence only. Hermes may adopt measured layout rhythm, density, spacing, information hierarchy, and flow structure; it must not copy Amplitude logos, brand identity, customer-facing copy, screenshots, or the LazyWeb/Mobbin attribution footer as product UI.

## Objective

Build the Hermes UI as a serious SaaS control plane for making and operating SaaS products:

- first screen: `Global Operator Queue`, not a landing page or marketing dashboard
- primary pattern: saved views, dense object records, inspector panel, evidence/gate detail, review trace, receipt workbench
- product identity: Hermes project/workflow control plane across domain packs
- authority boundary: read-only evidence and gate state first; no fake approval, no protected write control, no production/enterprise claims

## Deterministic Intake

Run:

```bash
npm run platform:amplitude-ui-reference-audit
npm run platform:amplitude-ui-reference-audit -- --check
```

The command writes the package to:

`artifacts/ui-reference/amplitude-feb-2025/latest`

Required artifacts:

- `screenshot-manifest.json`: all numbered screenshots, dimensions, bytes, sha256
- `asset-manifest.json`: showcase preview and showcase HTML metadata
- `crop-manifest.json`: product crop and attribution/footer exclusion rows
- `screen-family-rows.json`: seed classifications plus pending full visual review rows
- `measurement-queue-rows.json`: one exact-pixel measurement queue row per screenshot
- `pixel-measurement-rows.json`: decoded PNG pixel analysis rows for every numbered screenshot
- `pixel-measurement-summary-rows.json`: aggregated metric candidates across the full reference set
- `pixel-layout-overlay.html`: human-reviewable local-image overlay for seeded and high-confidence samples
- `measurement-plan.json`: measurable layout/component targets
- `design-token-seed.json`: Hermes token candidates derived from the reference rhythm
- `hermes-surface-mapping-rows.json`: reference pattern to Hermes surface map
- `flow-mapping-rows.json`: reference flow to Hermes flow map
- `validation-report.json`: count, range, dimension, crop, mapping, and safety validation

## Measurement Contract

Every numbered screenshot is measured in source pixel space. For the 1920x1320 source captures, the product measurement crop is:

```json
{ "x": 0, "y": 0, "width": 1920, "height": 1200 }
```

The bottom attribution/footer band is excluded:

```json
{ "x": 0, "y": 1200, "width": 1920, "height": 120 }
```

The exact-pixel measurement pass must capture:

- topbar height
- left icon rail width
- saved-view/sidebar width
- content gutter
- panel gap
- table header height
- table row height
- input/control height
- icon button size
- modal width
- inspector width
- chart/workspace region height

## Current Pixel Measurement Output

The deterministic pixel pass decodes the source PNGs directly and excludes the bottom attribution/footer band before measuring. Current generated output reports:

| Metric | Current Evidence |
|---|---|
| Numbered screenshots decoded | 318/318 |
| Pixel measurement summaries | 9 |
| Common topbar candidate | 43px median across 295 samples |
| Common rail candidate | 43px median across 265 samples; 83px also appears in app-shell samples |
| Common sidebar width candidates | 145px, 204px, 225px families |
| Common table/control rhythm | 28-32px dense rhythm |
| Common modal width candidates | 532px and 650px families |
| Inspector width candidate | 391px median, with 452px/462px families |

These are machine-extracted candidates, not final product tokens by themselves. Hermes implementation should promote only repeated app-shell values after reviewing `pixel-layout-overlay.html` and excluding marketing-only layouts.

## Hermes Surface Map

| Hermes Surface | Reference Pattern | Translation |
|---|---|---|
| Global Operator Queue | app-shell workspaces | dense scan-first work object table |
| Saved View Sidebar | left navigation/project sidebars | Queue, Projects, Requirements, Evidence, Reviews, Gates, Conversations, Actions, Domain Packs, Governance, Audit |
| Object Inspector | right/detail panels and profile pages | object summary, source refs, requirement trace, evidence chain, gate state, next action |
| Review Gate Detail | modal/detail flows | gate requirements and review evidence without final approval controls |
| Evidence Timeline | profile/event history | chronological evidence rows with actor, timestamp, source, artifact, gate, verdict |
| Readiness Rule Matrix | analytics tables and legends | rule rows, not KPI scorecards |
| Review Evidence Trace | provenance/details | reviewer receipt, model/effort, findings, revalidation, authority boundary |
| Receipt Workbench | save/share/configuration modals | receipt requirements and validation state |
| Domain Pack Detail | workspace/project/account detail | context overlay, not product identity |
| Governance/Audit | admin/settings/profile surfaces | owner, timestamp, policy, trust tier, blocked capabilities |

## Implementation Phases

1. Reference audit and manifest freeze
   - Verify all 318 screenshots exist and are 1920x1320.
   - Verify `showcase-preview.png` is 1440x900.
   - Exclude attribution/footer from all measurements.

2. Exact pixel annotation pass
   - Work through `pixel-measurement-rows.json` and `pixel-layout-overlay.html`.
   - Record accepted component bounds per screen family.
   - Promote repeated measurements into stable Hermes tokens.

3. Hermes shell design system
   - Tokenize spacing, typography, radius, borders, panel gaps, table density, and modal dimensions.
   - Keep cards at 8px radius or less.
   - Keep the palette neutral, operational, and not one-note.

4. Global Operator Console screens
   - Build Queue, Object Inspector, Review Gate Detail, Evidence Timeline, Review Evidence Trace, Receipt Workbench, and Governance/Audit.
   - Start as static/read-only UI bound to Hermes read models.
   - Add browser smoke and visual regression only after surfaces are deterministic.

5. Safety and review
   - Block raw body exposure, secret exposure, write/apply/delete/send controls, final approval UI, production claims, enterprise trust claims, and brand copying.
   - Produce a review packet for independent UI review after implementation screenshots exist.

## Non-Negotiables

- Do not embed the 318 source screenshots into Hermes product UI.
- Do not reuse Amplitude names, logos, product copy, customer copy, or brand styling as identity.
- Do not turn Hermes into a marketing page.
- Do not expose protected action controls from the reference UI.
- Do not present Codex, Claude, or any model as final approver.
