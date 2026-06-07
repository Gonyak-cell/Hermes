#!/usr/bin/env node
import { runCheckModeGuardNormalizationCli } from "../src/check-mode-guard-normalization.mjs";

await runCheckModeGuardNormalizationCli(process.argv.slice(2));
