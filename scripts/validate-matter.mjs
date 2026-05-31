#!/usr/bin/env node

import { readMatterFile, validateMatter } from "../src/matter-harness.mjs";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node scripts/validate-matter.mjs <matter.json>");
  process.exit(2);
}

const matter = await readMatterFile(path);
const errors = validateMatter(matter);

if (errors.length > 0) {
  console.error("Matter validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Matter ${matter.matter_id} is valid.`);
