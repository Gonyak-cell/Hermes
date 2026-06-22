#!/usr/bin/env node
import { runPersonalDevExecutionCandidateLaneCli } from "../src/personal-dev-execution-candidate-lane.mjs";

await runPersonalDevExecutionCandidateLaneCli(process.argv.slice(2));
