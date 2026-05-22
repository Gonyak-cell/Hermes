#!/usr/bin/env node
import { runWorktreeManagerCli } from "../src/worktree-manager.mjs";

await runWorktreeManagerCli(process.argv.slice(2));
