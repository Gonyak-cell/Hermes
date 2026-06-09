#!/usr/bin/env node
import { runHermesLoopModelBudgetControlCli } from "../src/hermes-loop-model-budget-control.mjs";

runHermesLoopModelBudgetControlCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});
