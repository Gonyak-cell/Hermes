#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { extractIntakeCandidates, mergeCandidatesIntoMatter, renderIntakeReport } from "../src/intake-adapter.mjs";
import { readMatterFile, validateMatter } from "../src/matter-harness.mjs";

const [matterPath, messagesPath, ...args] = process.argv.slice(2);

if (!matterPath || !messagesPath) {
  console.error("Usage: node scripts/intake-messages.mjs <matter.json> <messages.json> [--write output.json]");
  process.exit(2);
}

const writeIndex = args.indexOf("--write");
const outputPath = writeIndex >= 0 ? args[writeIndex + 1] : undefined;

const matter = await readMatterFile(matterPath);
const validationErrors = validateMatter(matter);
if (validationErrors.length > 0) {
  console.error("Matter validation failed:");
  for (const error of validationErrors) console.error(`- ${error}`);
  process.exit(1);
}

const messages = JSON.parse(await readFile(messagesPath, "utf8"));
const candidates = extractIntakeCandidates(matter, messages);

if (outputPath) {
  const merged = mergeCandidatesIntoMatter(matter, candidates);
  await writeFile(outputPath, `${JSON.stringify(merged, null, 2)}\n`);
  console.error(`Wrote merged matter draft to ${outputPath}`);
}

process.stdout.write(renderIntakeReport(candidates));
