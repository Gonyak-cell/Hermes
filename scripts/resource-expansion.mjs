#!/usr/bin/env node
import { runResourceExpansionCli } from "../src/resource-expansion.mjs";

await runResourceExpansionCli(process.argv.slice(2));
