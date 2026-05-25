#!/usr/bin/env node
import { runOutputDestinationPolicyEnforcementCli } from "../src/output-destination-policy-enforcement.mjs";

await runOutputDestinationPolicyEnforcementCli(process.argv.slice(2));
