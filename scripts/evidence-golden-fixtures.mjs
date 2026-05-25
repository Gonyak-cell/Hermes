#!/usr/bin/env node

import { runEvidenceGoldenFixturesCli } from "../src/evidence-golden-fixtures.mjs";

await runEvidenceGoldenFixturesCli(process.argv.slice(2));
