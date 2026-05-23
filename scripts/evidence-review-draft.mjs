#!/usr/bin/env node
import { runEvidenceReviewDraftCli } from "../src/evidence-review-draft.mjs";

await runEvidenceReviewDraftCli(process.argv.slice(2));
