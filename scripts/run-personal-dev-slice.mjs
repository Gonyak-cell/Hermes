#!/usr/bin/env node
import { runPersonalDevSliceCli } from "../src/personal-dev-slice-runner.mjs";

await runPersonalDevSliceCli(process.argv.slice(2));
