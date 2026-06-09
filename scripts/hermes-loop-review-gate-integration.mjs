#!/usr/bin/env node
import { runHermesLoopReviewGateIntegrationCli } from "../src/hermes-loop-review-gate-integration.mjs";

runHermesLoopReviewGateIntegrationCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});
