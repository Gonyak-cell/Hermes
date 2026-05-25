#!/usr/bin/env node
import { runModelPolicyEnforcementCli } from "../src/model-policy-enforcement.mjs";

await runModelPolicyEnforcementCli(process.argv.slice(2));
