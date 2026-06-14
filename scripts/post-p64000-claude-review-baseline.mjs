#!/usr/bin/env node
import { runPostP64000ClaudeReviewBaselineCli } from "../src/post-p64000-claude-review-baseline.mjs";

runPostP64000ClaudeReviewBaselineCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});
