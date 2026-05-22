#!/usr/bin/env node
import { runVerticalSliceCli } from "../src/vertical-slice-runner.mjs";

await runVerticalSliceCli(process.argv.slice(2));
