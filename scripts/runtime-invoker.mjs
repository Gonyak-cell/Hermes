#!/usr/bin/env node
import { runRuntimeInvokerCli } from "../src/runtime-invoker.mjs";

await runRuntimeInvokerCli(process.argv.slice(2));
