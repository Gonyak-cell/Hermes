#!/usr/bin/env node
import { runResourceIngestCli } from "../src/resource-ingest.mjs";

await runResourceIngestCli(process.argv.slice(2));
