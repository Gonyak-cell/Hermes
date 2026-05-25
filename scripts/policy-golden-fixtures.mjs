#!/usr/bin/env node

import { runPolicyGoldenFixturesCli } from "../src/policy-golden-fixtures.mjs";

await runPolicyGoldenFixturesCli(process.argv.slice(2));
