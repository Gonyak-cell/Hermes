#!/usr/bin/env node
import { runEvidenceViewerCli } from "../src/evidence-viewer.mjs";

await runEvidenceViewerCli(process.argv.slice(2));
