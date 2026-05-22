# Hermes Local Setup

Local setup completed on 2026-05-22 Asia/Seoul.

## Installed Hermes

- Version: Hermes Agent v0.14.0 (2026.5.16)
- Code path: `/Users/jws/.hermes/hermes-agent`
- Command: `/Users/jws/.local/bin/hermes`
- Config: `/Users/jws/.hermes/config.yaml`
- Environment: `/Users/jws/.hermes/.env`
- Skills path: `/Users/jws/.hermes/skills`

The installer was run with:

```bash
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash -s -- --skip-setup --skip-browser
```

Official installation reference:

- https://hermes-agent.nousresearch.com/docs/getting-started/installation/

## Connected Law-Firm Skills

The local skill pack is symlinked into Hermes:

```bash
~/.hermes/skills/law-firm -> /Users/jws/Documents/Codex/Hermes/skills/law-firm
```

The following skills are visible as local enabled skills:

- `personal-dev-project-manager`
- `law-firm-matter-ops`
- `law-firm-ma-deal-control`
- `law-firm-litigation-evidence-matrix`
- `law-firm-governance-risk-map`

The harness path is set in `/Users/jws/.hermes/.env`:

```bash
HERMES_LAW_HARNESS_DIR=/Users/jws/Documents/Codex/Hermes
```

## Verification Commands

```bash
/Users/jws/.local/bin/hermes --version
/Users/jws/.local/bin/hermes doctor
/Users/jws/.local/bin/hermes skills list --source local
npm run validate
npm run brief
npm run intake
npm run deal
npm run litigation
npm test
```

## Current Caveats

- Interactive model/provider setup was intentionally skipped. Run `hermes setup` or `hermes model` when ready to configure the preferred model provider.
- `hermes doctor` reports optional missing providers such as Discord, Telegram, OpenRouter web-search keys, and Codex OAuth. These are not required for this local harness.
- Browser install was skipped, but `doctor` detected available browser tooling through the local environment.
- Do not connect live law-firm data until client AI consent, access control, retention, and human review gates are approved.
