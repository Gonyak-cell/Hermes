#!/usr/bin/env node
import path from "node:path";
import {
  DEFAULT_EXTRACTION_OUT_DIR,
  DEFAULT_EXTRACTOR_QUEUE,
  extractResourceQueue,
  writeResourceExtraction,
} from "../src/resource-extract.mjs";

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const extraction = await extractResourceQueue({
  queuePath: args.queuePath,
  limit: args.limit,
  concurrency: args.concurrency,
  maxTextBytes: args.maxTextBytes,
});

await writeResourceExtraction(extraction, args.outDir);

console.log(`Resource extraction written to ${path.resolve(args.outDir)}`);
console.log(`Input files: ${extraction.input_count}`);
console.log(`Extracted: ${extraction.summary.extracted_files}`);
console.log(`Failed: ${extraction.summary.failed_files}`);
console.log(`Capability candidates: ${extraction.capability_signals.length}`);

function parseArgs(argv) {
  const parsed = {
    queuePath: DEFAULT_EXTRACTOR_QUEUE,
    outDir: DEFAULT_EXTRACTION_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--queue") parsed.queuePath = argv[++index];
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--limit") parsed.limit = Number.parseInt(argv[++index], 10);
    else if (arg === "--concurrency") parsed.concurrency = Number.parseInt(argv[++index], 10);
    else if (arg === "--max-text-bytes") parsed.maxTextBytes = Number.parseInt(argv[++index], 10);
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/resource-extract.mjs [options]

Options:
  --queue <path>           Extractor queue JSON path.
  --out-dir <path>         Output directory.
  --limit <n>              Extract only the first n files.
  --concurrency <n>        Number of files to process concurrently.
  --max-text-bytes <n>     Max bytes read for plain text files.
  -h, --help               Show this help.
`);
}
