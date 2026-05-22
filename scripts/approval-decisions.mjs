#!/usr/bin/env node
import { runApprovalDecisionsCli } from "../src/approval-decisions.mjs";

await runApprovalDecisionsCli(process.argv.slice(2));
