#!/usr/bin/env node
import { runPlatformClaimReceiptVerdictRefreshCli } from "../src/platform-claim-receipt-verdict-refresh.mjs";

await runPlatformClaimReceiptVerdictRefreshCli(process.argv.slice(2));
