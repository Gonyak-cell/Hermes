#!/usr/bin/env node
import { readdir } from "node:fs/promises";
import path from "node:path";
import {
  validateCapabilityManifestFile,
  validateEventLedgerFile,
  validatePolicyMatrixFile,
  validateRuntimeAdapterRegistryFile,
  validateVerticalSliceFile,
} from "../src/core-contract-validator.mjs";

const targets = process.argv.slice(2).filter((arg) => arg !== "--check");
const validationTargets = targets.length ? targets : await defaultValidationTargets();

for (const target of validationTargets) {
  const result = await validateTarget(target);

  if (!result.valid) {
    console.error(`Core contract validation failed for ${target}`);
    for (const error of result.errors) {
      console.error(`- ${error.path}: ${error.message}`);
    }
    process.exit(1);
  }

  console.log(`Core contract validation passed for ${target}`);
}

async function defaultValidationTargets() {
  const capabilityDir = "examples/core/capabilities";
  const capabilityFiles = (await readdir(capabilityDir))
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => path.join(capabilityDir, file));
  return [
    "examples/core/vertical-slice-example.json",
    "examples/core/policy-matrix.json",
    ...capabilityFiles,
    "examples/core/event-ledger.json",
    "examples/core/runtime-adapters.json",
  ];
}

function validateTarget(target) {
  if (target.endsWith("policy-matrix.json")) return validatePolicyMatrixFile(target);
  if (target.endsWith("event-ledger.json")) return validateEventLedgerFile(target);
  if (target.endsWith("runtime-adapters.json")) return validateRuntimeAdapterRegistryFile(target);
  if (target.includes(`${path.sep}capabilities${path.sep}`) || target.includes("/capabilities/")) {
    return validateCapabilityManifestFile(target);
  }
  return validateVerticalSliceFile(target);
}
