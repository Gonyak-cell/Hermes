#!/usr/bin/env node
import { runPostP64000ClaudeReadOnlyReviewCaptureCli } from "../src/post-p64000-claude-read-only-review-capture.mjs";

runPostP64000ClaudeReadOnlyReviewCaptureCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});
