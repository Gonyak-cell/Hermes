#!/usr/bin/env node
import { runApprovalQueueCli } from "../src/approval-queue.mjs";

await runApprovalQueueCli(process.argv.slice(2));
