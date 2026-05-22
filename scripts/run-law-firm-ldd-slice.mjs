#!/usr/bin/env node
import { runLawFirmLddSliceCli } from "../src/law-firm-ldd-slice-runner.mjs";

await runLawFirmLddSliceCli(process.argv.slice(2));
