#!/usr/bin/env node
import { runWorktreeManagerV2Cli } from "../src/worktree-manager-v2.mjs";

await runWorktreeManagerV2Cli(process.argv.slice(2));
