#!/usr/bin/env node
import { runPolicySnapshotLedgerCli } from "../src/policy-snapshot-ledger.mjs";

await runPolicySnapshotLedgerCli(process.argv.slice(2));
