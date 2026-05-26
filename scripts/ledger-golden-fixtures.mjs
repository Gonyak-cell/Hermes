#!/usr/bin/env node

import { runLedgerGoldenFixturesCli } from "../src/ledger-golden-fixtures.mjs";

await runLedgerGoldenFixturesCli(process.argv.slice(2));
