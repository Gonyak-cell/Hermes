#!/usr/bin/env node
import { runSandboxPolicyModelCli } from "../src/sandbox-policy-model.mjs";

await runSandboxPolicyModelCli(process.argv.slice(2));
