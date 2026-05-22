#!/usr/bin/env node
import { runRuntimeBindingsCli } from "../src/runtime-invoker.mjs";

await runRuntimeBindingsCli(process.argv.slice(2));
