#!/usr/bin/env node

import { readDevProjectsFile, validateDevProjects } from "../src/dev-projects.mjs";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node scripts/validate-dev-projects.mjs <dev-projects.json>");
  process.exit(2);
}

const portfolio = await readDevProjectsFile(path);
const errors = validateDevProjects(portfolio);
if (errors.length > 0) {
  console.error("Developer project portfolio validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Developer project portfolio for ${portfolio.owner} is valid.`);
