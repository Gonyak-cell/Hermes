#!/usr/bin/env node
import { runPostP64000FocusedHrmVerificationNormalizationCli } from "../src/post-p64000-focused-hrm-verification-normalization.mjs";

runPostP64000FocusedHrmVerificationNormalizationCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});
