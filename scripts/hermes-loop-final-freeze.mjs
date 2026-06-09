#!/usr/bin/env node
import { runHermesLoopFinalFreezeCli } from "../src/hermes-loop-final-freeze.mjs";

runHermesLoopFinalFreezeCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});
