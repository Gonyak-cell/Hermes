#!/usr/bin/env node

import { buildLitigationMatrix, readLitigationMatter, renderLitigationMatrix } from "../src/litigation-matrix.mjs";
import { validateMatter } from "../src/matter-harness.mjs";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node scripts/litigation-matrix.mjs <matter.json> [YYYY-MM-DD]");
  process.exit(2);
}

const matter = await readLitigationMatter(path);
const errors = validateMatter(matter);
if (errors.length > 0) {
  console.error("Matter validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const matrix = buildLitigationMatrix(matter, { today: process.argv[3] });
process.stdout.write(renderLitigationMatrix(matrix));
