#!/usr/bin/env node
import { runCostBudgetLedgerCli } from "../src/cost-budget-ledger.mjs";

await runCostBudgetLedgerCli(process.argv.slice(2));
