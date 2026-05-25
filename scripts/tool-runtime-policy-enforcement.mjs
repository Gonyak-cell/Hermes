#!/usr/bin/env node
import { runToolRuntimePolicyEnforcementCli } from "../src/tool-runtime-policy-enforcement.mjs";

await runToolRuntimePolicyEnforcementCli(process.argv.slice(2));
