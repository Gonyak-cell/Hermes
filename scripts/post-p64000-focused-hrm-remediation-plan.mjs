#!/usr/bin/env node
import { runPostP64000FocusedHrmRemediationPlanCli } from "../src/post-p64000-focused-hrm-remediation-plan.mjs";

runPostP64000FocusedHrmRemediationPlanCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});
