#!/usr/bin/env node

import { buildDevProjectBrief, readDevProjectsFile, renderDevProjectBrief, validateDevProjects } from "../src/dev-projects.mjs";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node scripts/dev-project-brief.mjs <dev-projects.json> [YYYY-MM-DD]");
  process.exit(2);
}

const portfolio = await readDevProjectsFile(path);
const errors = validateDevProjects(portfolio);
if (errors.length > 0) {
  console.error("Developer project portfolio validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const brief = buildDevProjectBrief(portfolio, { today: process.argv[3] });
process.stdout.write(renderDevProjectBrief(brief));
