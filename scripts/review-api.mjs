#!/usr/bin/env node
import { runReviewApiCli } from "../src/review-api.mjs";

await runReviewApiCli(process.argv.slice(2));
