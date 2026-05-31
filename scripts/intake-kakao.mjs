#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { parseKakaoTalkExport } from "../src/kakao-parser.mjs";
import { extractIntakeCandidates, mergeCandidatesIntoMatter, renderIntakeReport } from "../src/intake-adapter.mjs";
import { readMatterFile, validateMatter } from "../src/matter-harness.mjs";

const [matterPath, kakaoPath, ...args] = process.argv.slice(2);

if (!matterPath || !kakaoPath) {
  console.error("Usage: node scripts/intake-kakao.mjs <matter.json> <kakaotalk-export.txt> [--source-id id] [--write output.json]");
  process.exit(2);
}

const sourceId = readArg(args, "--source-id") ?? "kakaotalk-export";
const outputPath = readArg(args, "--write");

const matter = await readMatterFile(matterPath);
const errors = validateMatter(matter);
if (errors.length > 0) {
  console.error("Matter validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const exportText = await readFile(kakaoPath, "utf8");
const messages = parseKakaoTalkExport(exportText, {
  matterId: matter.matter_id,
  sourceId,
});
const candidates = extractIntakeCandidates(matter, messages);

if (outputPath) {
  const merged = mergeCandidatesIntoMatter(matter, candidates);
  await writeFile(outputPath, `${JSON.stringify(merged, null, 2)}\n`);
  console.error(`Wrote merged matter draft to ${outputPath}`);
}

process.stdout.write(renderIntakeReport(candidates));

function readArg(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}
