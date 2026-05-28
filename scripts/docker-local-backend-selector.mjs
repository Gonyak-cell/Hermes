#!/usr/bin/env node
import { runDockerLocalBackendSelectorCli } from "../src/docker-local-backend-selector.mjs";

await runDockerLocalBackendSelectorCli(process.argv.slice(2));
