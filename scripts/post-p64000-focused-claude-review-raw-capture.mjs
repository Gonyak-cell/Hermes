#!/usr/bin/env node
import { runPostP64000FocusedClaudeReviewRawCaptureCli } from "../src/post-p64000-focused-claude-review-raw-capture.mjs";

runPostP64000FocusedClaudeReviewRawCaptureCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});
