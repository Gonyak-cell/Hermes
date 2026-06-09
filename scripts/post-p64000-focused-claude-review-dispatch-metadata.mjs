#!/usr/bin/env node
import { runPostP64000FocusedClaudeReviewDispatchMetadataCli } from "../src/post-p64000-focused-claude-review-dispatch-metadata.mjs";

runPostP64000FocusedClaudeReviewDispatchMetadataCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});
