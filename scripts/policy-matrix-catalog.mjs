#!/usr/bin/env node
import { runPolicyMatrixCatalogCli } from "../src/policy-matrix-catalog.mjs";

await runPolicyMatrixCatalogCli(process.argv.slice(2));
