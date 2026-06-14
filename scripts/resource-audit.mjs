#!/usr/bin/env node
import path from "node:path";
import { buildResourceAudit, writeResourceAudit } from "../src/resource-audit.mjs";

const DEFAULT_OUT_DIR = "audits/resource-audit/latest";

function parseArgs(argv) {
  const options = {
    roots: [],
    outDir: DEFAULT_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.roots.push(argv[++index]);
    } else if (arg === "--out") {
      options.outDir = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function usage() {
  return `Usage:
  node scripts/resource-audit.mjs [--root <folder>] [--out <folder>]

Defaults:
  --root $HERMES_RESOURCE_AUDIT_ROOT or .local/resource-audit-root
  --out  ${DEFAULT_OUT_DIR}
`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const outDir = path.resolve(process.cwd(), options.outDir);
  const audit = await buildResourceAudit({ roots: options.roots });
  await writeResourceAudit(audit, outDir);

  console.log(`Resource audit written to ${outDir}`);
  console.log(`Total files: ${audit.summary.total_files}`);
  console.log(`Needs materialization: ${audit.summary.dataless_files}`);
  console.log(`Ready for extraction: ${audit.queues.extractable.length}`);
  console.log(`Unsupported/unknown: ${audit.queues.unsupported.length}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
