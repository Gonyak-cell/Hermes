#!/usr/bin/env node
import { runHermesLoopDagTopologyCli } from "../src/hermes-loop-dag-topology.mjs";

runHermesLoopDagTopologyCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});
