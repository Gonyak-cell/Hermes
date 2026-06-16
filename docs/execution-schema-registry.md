# Execution Schema Registry

This contract records the first implementation tranche from the Hermes execution
platform handoff package. It keeps execution closed while establishing the data
contracts that later execution lanes must bind to.

## Scope

- Validate the execution schema files for requests, policies, adapters,
  sessions, command invocations, receipts, diffs, tests, rollback plans, human
  review gates, promotion decisions, and desktop execution projections.
- Validate one positive fixture, one missing-required fixture, and one
  forbidden-field fixture per schema.
- Validate semantic negative fixtures for runtime source-of-truth escalation,
  desktop execution, owner-as-independent review, premature production,
  deployment policy opening, sandbox secret/network opening, raw shell strings,
  and receipt authority escalation.

## Boundary

This tranche does not open command execution, file writes, network access,
package installs, raw secret access, connector writes, deployment, production,
protected output, desktop shell execution, or agent final-pass authority.

## Verification

Run:

```bash
npm run execution:schema -- --check
node --test test/execution-schema-registry.test.mjs
```
