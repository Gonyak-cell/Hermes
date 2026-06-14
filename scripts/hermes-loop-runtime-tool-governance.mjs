#!/usr/bin/env node
import { runHermesLoopRuntimeToolGovernanceCli } from "../src/hermes-loop-runtime-tool-governance.mjs";

runHermesLoopRuntimeToolGovernanceCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});
