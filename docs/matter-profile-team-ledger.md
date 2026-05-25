# Matter Profile/Team Ledger

Phase 115 adds the matter profile and team-membership ledger used before the full Matter Access Policy evaluator.

## Purpose

The ledger makes matter access explicit and deterministic:

- each Matter v2 row becomes a `matter_profile`;
- each MatterTeam v2 row becomes a `matter_team_roster`;
- each team member becomes a `matter_team_membership`;
- each human user receives a per-matter `matter_access_subject` decision;
- access is allowed only when the subject has an active matter-team membership.

This keeps the rule simple for Phase 115: matter access is judged by team membership, not by a prompt or by a global tenant role.

## Inputs

- `artifacts/matter-contract-freeze/latest/matter-contract-freeze.json`
- `artifacts/identity-model/latest/identity-model.json`
- `artifacts/client-counterparty-registry/latest/client-counterparty-registry.json`

## Command

```bash
npm run contracts:matter-teams -- --check
```

## Outputs

- `artifacts/matter-profile-team-ledger/latest/matter-profile-team-ledger.json`
- `artifacts/matter-profile-team-ledger/latest/matter-profiles.json`
- `artifacts/matter-profile-team-ledger/latest/matter-team-rosters.json`
- `artifacts/matter-profile-team-ledger/latest/matter-team-memberships.json`
- `artifacts/matter-profile-team-ledger/latest/matter-access-subjects.json`
- `artifacts/matter-profile-team-ledger/latest/validation-report.json`
- `artifacts/matter-profile-team-ledger/latest/summary.md`

## Phase 115 Acceptance

The phase is complete when:

- every matter has a matter profile;
- every matter profile links to a team roster, matter boundary, client registry row, and conflict references;
- every team member has a membership row linked to a human actor principal and matter role assignment;
- every matter has at least one allowed access subject;
- allowed access subjects are exactly active team members;
- denied access subjects are users without team membership;
- the ledger is visible through dashboard, API, golden fixtures, validation suite, goal checkpoint, and control-plane loop.
