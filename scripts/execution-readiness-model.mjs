#!/usr/bin/env node
import { runExecutionReadinessModelCli } from "../src/execution-readiness-model.mjs";

await runExecutionReadinessModelCli(process.argv.slice(2));
