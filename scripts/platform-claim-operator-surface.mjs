#!/usr/bin/env node
import { runPlatformClaimOperatorSurfaceCli } from "../src/platform-claim-operator-surface.mjs";

await runPlatformClaimOperatorSurfaceCli(process.argv.slice(2));
