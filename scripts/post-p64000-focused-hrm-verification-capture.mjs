#!/usr/bin/env node
import { runPostP64000FocusedHrmVerificationCaptureCli } from "../src/post-p64000-focused-hrm-verification-capture.mjs";

runPostP64000FocusedHrmVerificationCaptureCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});
