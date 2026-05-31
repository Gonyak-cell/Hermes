#!/usr/bin/env node

import { buildMatterBrief, readMatterFile, renderMatterBrief, validateMatter } from "../src/matter-harness.mjs";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node scripts/matter-brief.mjs <matter.json> [YYYY-MM-DD]");
  process.exit(2);
}

const today = process.argv[3];
const matter = await readMatterFile(path);
const errors = validateMatter(matter);

if (errors.length > 0) {
  console.error("Matter validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

const brief = buildMatterBrief(matter, { today });
process.stdout.write(renderMatterBrief(brief));
