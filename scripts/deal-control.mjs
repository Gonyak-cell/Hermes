#!/usr/bin/env node

import { buildDealControlBrief, readDealMatter, renderDealControlBrief } from "../src/deal-control.mjs";
import { validateMatter } from "../src/matter-harness.mjs";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node scripts/deal-control.mjs <matter.json> [YYYY-MM-DD]");
  process.exit(2);
}

const matter = await readDealMatter(path);
const errors = validateMatter(matter);
if (errors.length > 0) {
  console.error("Matter validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const brief = buildDealControlBrief(matter, { today: process.argv[3] });
process.stdout.write(renderDealControlBrief(brief));
