#!/usr/bin/env node
import { runReviewDashboardCli } from "../src/review-dashboard.mjs";

await runReviewDashboardCli(process.argv.slice(2));
