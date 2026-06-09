#!/usr/bin/env node
import { runPostP64000ClaudeReviewExecutionCli } from "../src/post-p64000-claude-review-execution.mjs";

runPostP64000ClaudeReviewExecutionCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});
