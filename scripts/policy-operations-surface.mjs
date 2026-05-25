#!/usr/bin/env node
import { runPolicyOperationsSurfaceCli } from "../src/policy-operations-surface.mjs";

await runPolicyOperationsSurfaceCli(process.argv.slice(2));
