#!/usr/bin/env node
import { runPostP64000ClaudeReviewReceiptNormalizationCli } from "../src/post-p64000-claude-review-receipt-normalization.mjs";

runPostP64000ClaudeReviewReceiptNormalizationCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});
