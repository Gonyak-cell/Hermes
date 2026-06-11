#!/usr/bin/env node
import { runClaudeReviewEvidenceValidatorCli } from "../src/claude-review-evidence-validator.mjs";

runClaudeReviewEvidenceValidatorCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});
