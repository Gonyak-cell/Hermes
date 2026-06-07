import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildTrustDeltaLedger } from "./trust-delta-ledger.mjs";

export const DEFAULT_CHECK_MODE_GUARD_NORMALIZATION_OUT_DIR = "artifacts/check-mode-guard-normalization/latest";
export const DEFAULT_CHECK_MODE_GUARD_NORMALIZATION_INPUTS = {
  schemaPath: "schemas/check-mode-guard-normalization.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p18001-p18400.md",
  architectureDocPath: "docs/architecture.md",
  sourceTrustDeltaLedgerPath: "artifacts/trust-delta-ledger/latest/trust-delta-ledger.json",
  srcDir: "src",
};

const COMMAND_NAME = "platform:check-mode-guard-normalization";
const SCHEMA_VERSION = "check-mode-guard-normalization.v1";
const CAPABILITY_ID = "platform.check_mode_guard_normalization";
const PROGRAM_RANGE = "P18001-P18400";
const SOURCE_PROGRAM_RANGE = "P17601-P18000";
const READY_STATUS = "ready_for_check_mode_guard_normalization";
const BLOCKED_STATUS = "blocked_check_mode_guard_normalization";

const PHASE_SPECS = [
  ["P18001-P18040", "No-Write Failure Source Inventory", "guard_inventory_rows"],
  ["P18041-P18080", "Generic Check Branch Scanner", "scanner_capability_rows"],
  ["P18081-P18120", "Guarded Generator File Ledger", "check_mode_guard_file_rows"],
  ["P18121-P18160", "Offender Finding Rows", "check_mode_guard_finding_rows"],
  ["P18161-P18200", "Policy Test Recovery", "policy_test_recovery_rows"],
  ["P18201-P18240", "Trust Delta Carryover", "trust_delta_carryover_rows"],
  ["P18241-P18280", "Authority Boundary Recheck", "authority_boundary_rows"],
  ["P18281-P18320", "Validation Evidence Rows", "validation_evidence_rows"],
  ["P18321-P18360", "Claude Review Packet Slot", "review_packet_rows"],
  ["P18361-P18400", "P18400 Handoff Freeze", "p18400_freeze_rows"],
];

const SCANNER_FIXTURES = [
  {
    fixture_id: "arg_multiline_ok",
    source: [
      "export async function run(options = {}) { if (options.write !== false) await write(); }",
      "function parseArgs(argv) {",
      "  const args = {};",
      "  for (const arg of argv) {",
      "    if (arg === \"--check\") {",
      "      args.check = true;",
      "      args.write = false;",
      "    }",
      "  }",
      "}",
    ].join("\n"),
    expected_offenders: 0,
  },
  {
    fixture_id: "value_oneline_ok",
    source: "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const value of argv) { if (value === \"--check\") { args.check = true; args.write = false; } } }",
    expected_offenders: 0,
  },
  {
    fixture_id: "missing_write_blocked",
    source: "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const value of argv) { if (value === \"--check\") { args.check = true; } } }",
    expected_offenders: 1,
  },
  {
    fixture_id: "missing_branch_blocked",
    source: "if (options.write !== false) await write(); function printHelp() { console.log(\"--check\"); }",
    expected_offenders: 1,
  },
  {
    fixture_id: "reversed_equality_ok",
    source: "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const arg of argv) { if (\"--check\" === arg) { args.check = true; args.write = false; } } }",
    expected_offenders: 0,
  },
  {
    fixture_id: "loose_equality_ok",
    source: "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const arg of argv) { if (arg == \"--check\") { args.check = true; args.write = false; } } }",
    expected_offenders: 0,
  },
  {
    fixture_id: "switch_case_ok",
    source: "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const arg of argv) { switch (arg) { case \"--check\": args.check = true; args.write = false; break; default: break; } } }",
    expected_offenders: 0,
  },
  {
    fixture_id: "array_includes_ok",
    source: "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const arg of argv) { if ([\"--check\"].includes(arg)) { args.check = true; args.write = false; } } }",
    expected_offenders: 0,
  },
  {
    fixture_id: "alternate_parser_missing_write_blocked",
    source: "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const arg of argv) { if (arg === \"--check\") { args.check = true; args.write = false; } } } const parseOptions = (argv) => { const args = {}; for (const arg of argv) { if (arg === \"--check\") { args.check = true; } } };",
    expected_offenders: 1,
  },
  {
    fixture_id: "commented_write_blocked",
    source: "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const arg of argv) { if (arg === \"--check\") { args.check = true; // args.write = false;\n } } }",
    expected_offenders: 1,
  },
  {
    fixture_id: "string_brace_ok",
    source: "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const arg of argv) { if (arg === \"--check\") { const sample = \"}\"; args.check = true; args.write = false; } } }",
    expected_offenders: 0,
  },
  {
    fixture_id: "quote_mismatch_blocked",
    source: "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const arg of argv) { if (arg === \"--check') { args.check = true; args.write = false; } } }",
    expected_offenders: 1,
  },
];

export async function runCheckModeGuardNormalization(options = {}) {
  const result = await buildCheckModeGuardNormalization(options);
  if (options.write !== false) await writeCheckModeGuardNormalization(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Check-Mode Guard Normalization failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildCheckModeGuardNormalization(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CHECK_MODE_GUARD_NORMALIZATION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "trustDeltaLedger")
    ? normalizeInlineJsonSource("inline.trust_delta_ledger", options.trustDeltaLedger)
    : await readJsonOrBuildP18000(inputs.source_trust_delta_ledger_path, generatedAt);
  const scan = options.scanResult ?? await collectCheckModeGuardFindings({ srcDir: inputs.src_dir, repoRoot: inputs.repo_root });
  const fixtureRows = buildScannerFixtureRows(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const inventoryRows = buildInventoryRows(scan, source, generatedAt);
  const scannerRows = buildScannerRows(fixtureRows, generatedAt);
  const fileRows = buildFileRows(scan, generatedAt);
  const findingRows = buildFindingRows(scan, generatedAt);
  const policyRows = buildPolicyRecoveryRows(scan, fixtureRows, generatedAt);
  const carryoverRows = buildTrustCarryoverRows(source, generatedAt);
  const authorityRows = buildAuthorityRows(generatedAt);
  const validationRows = buildValidationEvidenceRows(scan, fixtureRows, generatedAt);
  const reviewRows = buildReviewPacketRows(generatedAt);
  const freezeRows = buildFreezeRows(scan, source, fixtureRows, generatedAt);
  const boundary = buildBoundary({ scan, fixtureRows, source });
  const validationItems = buildValidationItems({
    packageJson,
    roadmapDoc,
    architectureDoc,
    phaseRows,
    scannerRows,
    boundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: { trust_delta_ledger_path: source.path },
    source_trust_delta_summary: source.data?.summary ?? null,
    check_mode_guard_contract: buildContract(generatedAt),
    check_mode_guard_phase_rows: phaseRows,
    guard_inventory_rows: inventoryRows,
    scanner_capability_rows: scannerRows,
    scanner_fixture_rows: fixtureRows,
    check_mode_guard_file_rows: fileRows,
    check_mode_guard_finding_rows: findingRows,
    policy_test_recovery_rows: policyRows,
    trust_delta_carryover_rows: carryoverRows,
    authority_boundary_rows: authorityRows,
    validation_evidence_rows: validationRows,
    review_packet_rows: reviewRows,
    p18400_freeze_rows: freezeRows,
    check_mode_guard_boundary: boundary,
    check_mode_guard_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ scan, fixtureRows, boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "check_mode_guard_normalization")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.check_mode_guard_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.check_mode_guard_validation_items);
  result.summary = buildSummary({ scan, fixtureRows, boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeCheckModeGuardNormalization(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "check-mode-guard-normalization.json"), serializableResult(result));
  await writeJson(path.join(outDir, "check-mode-guard-file-rows.json"), collectionEnvelope("check-mode-guard-file-rows.v1", "check_mode_guard_file_rows", result.check_mode_guard_file_rows, result.generated_at));
  await writeJson(path.join(outDir, "check-mode-guard-finding-rows.json"), collectionEnvelope("check-mode-guard-finding-rows.v1", "check_mode_guard_finding_rows", result.check_mode_guard_finding_rows, result.generated_at));
  await writeFile(path.join(outDir, "check-mode-guard-normalization.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runCheckModeGuardNormalizationCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runCheckModeGuardNormalization(args);
  console.log(`Check-Mode Guard Normalization validated at ${result.output_dir}`);
  console.log(`Status: ${result.summary.check_mode_guard_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Guarded generators: ${result.summary.guarded_generator_count}`);
  console.log(`No-write offenders: ${result.summary.offender_count}`);
  console.log(`Scanner fixtures passed: ${result.summary.scanner_fixture_passed_now}`);
  console.log(`Ready for P18401 handoff: ${result.summary.ready_for_p18401_handoff}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

export async function collectCheckModeGuardFindings(options = {}) {
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  const srcDir = path.resolve(options.srcDir ?? "src");
  const filePaths = await listMjsFiles(srcDir);
  const fileRows = [];
  const findings = [];

  for (const filePath of filePaths) {
    const source = await readFile(filePath, "utf8");
    const row = collectCheckModeGuardFindingsFromSource(path.relative(repoRoot, filePath).replaceAll(path.sep, "/"), source);
    if (row.guarded_generator) {
      fileRows.push(row);
      findings.push(...row.findings);
    }
  }

  return {
    repo_root: repoRoot,
    src_dir: srcDir,
    scanned_file_count: filePaths.length,
    guarded_generator_count: fileRows.length,
    check_branch_count: fileRows.reduce((sum, row) => sum + row.check_branch_count, 0),
    offender_count: findings.length,
    file_rows: fileRows,
    findings,
  };
}

export function collectCheckModeGuardFindingsFromSource(filePath, source) {
  const guarded = source.includes("options.write !== false") && source.includes("--check");
  const branches = guarded ? extractCheckBranches(source) : [];
  const findings = [];
  if (guarded && branches.length === 0 && findings.length === 0) {
    findings.push(finding(filePath, "missing_check_branch", "has --check and write guard but no parse branch block"));
  }
  for (const [index, branch] of branches.entries()) {
    if (branch.malformed) {
      findings.push(finding(filePath, branch.finding_type ?? "malformed_check_branch", branch.message ?? `check branch ${index + 1} is malformed`));
    } else if (!branchDisablesWrite(branch.body)) {
      findings.push(finding(filePath, "check_without_write_false", "sets check without disabling write"));
    }
  }
  return {
    file_path: filePath,
    guarded_generator: guarded,
    check_branch_count: branches.length,
    current_verdict: findings.length === 0 ? "pass" : "blocked",
    findings,
  };
}

export function extractCheckBranches(source) {
  const sections = extractParserSections(source);
  const scanSources = sections.length > 0 ? sections : [source];
  return scanSources.flatMap((scanSource) => extractCheckBranchesFromCodeSection(scanSource));
}

function extractCheckBranchesFromCodeSection(source) {
  const branches = [];

  for (let index = 0; index < source.length; index += 1) {
    const skipped = skipNonCode(source, index);
    if (skipped !== index) {
      index = skipped - 1;
      continue;
    }

    const ifLength = branchKeywordLength(source, index);
    if (ifLength > 0) {
      const parenIndex = skipWhitespace(source, index + ifLength);
      if (source[parenIndex] !== "(") continue;
      const closeParenIndex = findMatchingDelimiter(source, parenIndex, "(", ")");
      if (closeParenIndex === -1) {
        branches.push(malformedBranch(source, parenIndex, "check branch condition is malformed"));
        continue;
      }
      const condition = source.slice(parenIndex + 1, closeParenIndex);
      const openBraceIndex = skipWhitespace(source, closeParenIndex + 1);
      if (!conditionMatchesCheck(condition) || source[openBraceIndex] !== "{") continue;
      const closeBraceIndex = findMatchingBrace(source, openBraceIndex);
      if (closeBraceIndex === -1) {
        branches.push(malformedBranch(source, openBraceIndex, "check branch body is malformed"));
      } else {
        branches.push({ body: maskNonCode(source.slice(openBraceIndex + 1, closeBraceIndex)), malformed: false });
        index = closeBraceIndex;
      }
      continue;
    }

    if (keywordAt(source, index, "case")) {
      const colonIndex = findCaseColon(source, index + "case".length);
      if (colonIndex === -1) continue;
      const expression = source.slice(index + "case".length, colonIndex);
      if (!caseExpressionMatchesCheck(expression)) continue;
      const bodyStart = colonIndex + 1;
      const bodyEnd = findSwitchCaseBodyEnd(source, bodyStart);
      if (bodyEnd === -1) {
        branches.push({ body: maskNonCode(source.slice(bodyStart)), malformed: true });
      } else {
        branches.push({ body: maskNonCode(source.slice(bodyStart, bodyEnd)), malformed: false });
        index = bodyEnd;
      }
    }
  }
  return branches;
}

function extractParserSections(source) {
  const sections = [];
  const functionPattern = /\bfunction\s+parse[A-Za-z0-9_$]*\s*\([^)]*\)\s*\{/g;
  const arrowPattern = /\b(?:const|let|var)\s+parse[A-Za-z0-9_$]*\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{/g;
  const methodPattern = /(?:^|[\n;{}])\s*parse[A-Za-z0-9_$]*\s*\([^)]*\)\s*\{/g;

  for (const pattern of [functionPattern, arrowPattern, methodPattern]) {
    let match;
    while ((match = pattern.exec(source)) !== null) {
      const openBraceIndex = pattern.lastIndex - 1;
      const closeBraceIndex = findMatchingBrace(source, openBraceIndex);
      if (closeBraceIndex !== -1) {
        sections.push(source.slice(openBraceIndex + 1, closeBraceIndex));
        pattern.lastIndex = closeBraceIndex + 1;
      }
    }
  }
  return sections;
}

function malformedBranch(source, startIndex, fallbackMessage) {
  const unterminated = unterminatedLiteralFindingType(source, startIndex);
  if (unterminated) {
    return {
      body: "",
      malformed: true,
      finding_type: unterminated,
      message: `${unterminated.replaceAll("_", " ")} blocks check branch parsing`,
    };
  }
  return { body: "", malformed: true, message: fallbackMessage };
}

function findMatchingBrace(source, openBraceIndex) {
  let depth = 0;
  for (let index = openBraceIndex; index < source.length; index += 1) {
    const skipped = skipNonCode(source, index);
    if (skipped !== index) {
      index = skipped - 1;
      continue;
    }
    const char = source[index];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function findSwitchCaseBodyEnd(source, bodyStart) {
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const skipped = skipNonCode(source, index);
    if (skipped !== index) {
      index = skipped - 1;
      continue;
    }
    const char = source[index];
    if (char === "{") depth += 1;
    else if (char === "}") {
      if (depth === 0) return index;
      depth -= 1;
    } else if (depth === 0 && source.startsWith("case ", index)) {
      return index;
    } else if (depth === 0 && source.startsWith("default", index)) {
      return index;
    }
  }
  return source.length;
}

function branchDisablesWrite(body) {
  return /\.\s*check\s*=\s*true\s*;?/.test(body) && /\.\s*write\s*=\s*false\s*;?/.test(body);
}

function branchKeywordLength(source, index) {
  if (keywordAt(source, index, "if")) return 2;
  if (keywordAt(source, index, "else")) {
    const nextIndex = skipWhitespace(source, index + "else".length);
    if (keywordAt(source, nextIndex, "if")) return nextIndex + 2 - index;
  }
  return 0;
}

function conditionMatchesCheck(condition) {
  const quotedCheck = String.raw`(?:"--check"|'--check')`;
  const identifier = String.raw`[A-Za-z_$][\w$]*`;
  const equality = new RegExp(String.raw`(?:^|[^\w$])(?:${identifier}\s*={2,3}\s*${quotedCheck}|${quotedCheck}\s*={2,3}\s*${identifier})(?:$|[^\w$])`);
  const directIncludes = new RegExp(String.raw`\.includes\s*\(\s*${quotedCheck}\s*\)`);
  const arrayIncludes = new RegExp(String.raw`\[[^\]]*${quotedCheck}[^\]]*\]\s*\.includes\s*\(`);
  return equality.test(condition) || directIncludes.test(condition) || arrayIncludes.test(condition);
}

function caseExpressionMatchesCheck(expression) {
  return /^\s*(?:"--check"|'--check')\s*$/.test(expression);
}

function keywordAt(source, index, keyword) {
  return source.startsWith(keyword, index)
    && !isIdentifierChar(source[index - 1] ?? "")
    && !isIdentifierChar(source[index + keyword.length] ?? "");
}

function isIdentifierChar(char) {
  return /[A-Za-z0-9_$]/.test(char);
}

function skipWhitespace(source, index) {
  let current = index;
  while (current < source.length && /\s/.test(source[current])) current += 1;
  return current;
}

function findMatchingDelimiter(source, openIndex, openChar, closeChar) {
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    const skipped = skipNonCode(source, index);
    if (skipped !== index) {
      index = skipped - 1;
      continue;
    }
    const char = source[index];
    if (char === openChar) depth += 1;
    else if (char === closeChar) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function findCaseColon(source, startIndex) {
  for (let index = startIndex; index < source.length; index += 1) {
    const skipped = skipNonCode(source, index);
    if (skipped !== index) {
      index = skipped - 1;
      continue;
    }
    if (source[index] === ":") return index;
    if (source[index] === "\n" || source[index] === "{") return -1;
  }
  return -1;
}

function skipNonCode(source, index) {
  const char = source[index];
  const next = source[index + 1];
  if (char === "/" && next === "/") return consumeLineComment(source, index);
  if (char === "/" && next === "*") return consumeBlockComment(source, index);
  if (char === "'" || char === '"') return consumeQuotedLiteral(source, index, char).end_index;
  if (char === "`") return consumeTemplateLiteral(source, index).end_index;
  return index;
}

function unterminatedLiteralFindingType(source, startIndex = 0) {
  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (char === "/" && next === "/") {
      index = consumeLineComment(source, index) - 1;
    } else if (char === "/" && next === "*") {
      index = consumeBlockComment(source, index) - 1;
    } else if (char === "'" || char === '"') {
      const quoted = consumeQuotedLiteral(source, index, char);
      if (!quoted.closed) return "unterminated_string_literal";
      index = quoted.end_index - 1;
    } else if (char === "`") {
      const template = consumeTemplateLiteral(source, index);
      if (!template.closed) return "unterminated_template_literal";
      index = template.end_index - 1;
    }
  }
  return null;
}

function consumeLineComment(source, startIndex) {
  const newlineIndex = source.indexOf("\n", startIndex + 2);
  return newlineIndex === -1 ? source.length : newlineIndex + 1;
}

function consumeBlockComment(source, startIndex) {
  const closeIndex = source.indexOf("*/", startIndex + 2);
  return closeIndex === -1 ? source.length : closeIndex + 2;
}

function maskNonCode(source) {
  let output = "";
  let index = 0;
  let state = "code";
  let templateDepth = 0;

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (state === "code") {
      if (char === "/" && next === "/") {
        output += "  ";
        index += 2;
        state = "line_comment";
      } else if (char === "/" && next === "*") {
        output += "  ";
        index += 2;
        state = "block_comment";
      } else if (char === "'" || char === '"') {
        output += " ";
        index += 1;
        state = char === "'" ? "single_quote" : "double_quote";
      } else if (char === "`") {
        output += " ";
        index += 1;
        state = "template";
        templateDepth = 0;
      } else {
        output += char;
        index += 1;
      }
    } else if (state === "line_comment") {
      output += char === "\n" ? "\n" : " ";
      index += 1;
      if (char === "\n") state = "code";
    } else if (state === "block_comment") {
      if (char === "*" && next === "/") {
        output += "  ";
        index += 2;
        state = "code";
      } else {
        output += char === "\n" ? "\n" : " ";
        index += 1;
      }
    } else if (state === "single_quote" || state === "double_quote") {
      if (char === "\\") {
        output += " ";
        if (next !== undefined) output += next === "\n" ? "\n" : " ";
        index += next !== undefined ? 2 : 1;
      } else {
        const closing = state === "single_quote" ? "'" : '"';
        output += char === "\n" ? "\n" : " ";
        index += 1;
        if (char === closing) state = "code";
      }
    } else if (state === "template") {
      if (char === "\\") {
        output += " ";
        if (next !== undefined) output += next === "\n" ? "\n" : " ";
        index += next !== undefined ? 2 : 1;
      } else if (char === "`" && templateDepth === 0) {
        output += " ";
        index += 1;
        state = "code";
      } else {
        if (char === "{" && source[index - 1] === "$") templateDepth += 1;
        else if (char === "}" && templateDepth > 0) templateDepth -= 1;
        output += char === "\n" ? "\n" : " ";
        index += 1;
      }
    }
  }

  return output;
}

function consumeQuotedLiteral(source, startIndex, quote) {
  let raw = quote;
  let value = "";
  let index = startIndex + 1;
  let closed = false;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    raw += char;
    if (char === "\\") {
      if (next !== undefined) {
        raw += next;
        value += next;
        index += 2;
      } else {
        index += 1;
      }
    } else if (char === quote) {
      index += 1;
      closed = true;
      break;
    } else {
      value += char;
      index += 1;
    }
  }
  return { raw, value, end_index: index, closed };
}

function consumeTemplateLiteral(source, startIndex) {
  let raw = "`";
  let index = startIndex + 1;
  let closed = false;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    raw += char;
    if (char === "\\") {
      if (next !== undefined) {
        raw += next;
        index += 2;
      } else {
        index += 1;
      }
    } else if (char === "`") {
      index += 1;
      closed = true;
      break;
    } else {
      index += 1;
    }
  }
  return { raw, end_index: index, closed };
}

function finding(filePath, findingType, message) {
  return {
    finding_id: `${slug(filePath)}.${findingType}`,
    file_path: filePath,
    finding_type: findingType,
    message,
    current_verdict: "blocked",
  };
}

function buildScannerFixtureRows(generatedAt) {
  return SCANNER_FIXTURES.map((fixture) => {
    const scan = collectCheckModeGuardFindingsFromSource(`fixture/${fixture.fixture_id}.mjs`, fixture.source);
    const observed = scan.findings.length === fixture.expected_offenders;
    return {
      row_id: fixture.fixture_id,
      label: fixture.fixture_id.replaceAll("_", " "),
      expected_offenders: fixture.expected_offenders,
      observed_offenders: scan.findings.length,
      observed,
      current_verdict: observed ? "pass" : "blocked",
      evidence_ref: "scanner_fixture",
      generated_at: generatedAt,
    };
  });
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([phaseRange, label, artifactKey]) => {
    const observed = roadmapText.includes(phaseRange) && roadmapText.includes(artifactKey);
    return row(slug(phaseRange), label, observed, artifactKey, generatedAt, { phase_range: phaseRange, artifact_key: artifactKey });
  });
}

function buildInventoryRows(scan, source, generatedAt) {
  return [
    row("source_trust_delta", "P18000 Trust Delta source is available or rebuilt", Boolean(source.available && source.data), source.path, generatedAt),
    row("scanned_src_files", "Source .mjs files are scanned", scan.scanned_file_count > 0, String(scan.scanned_file_count), generatedAt),
    row("guarded_generators", "Guarded generators with --check are inventoried", scan.guarded_generator_count > 0, String(scan.guarded_generator_count), generatedAt),
    row("offender_inventory", "Offender inventory is explicit", Number.isFinite(scan.offender_count), String(scan.offender_count), generatedAt),
  ];
}

function buildScannerRows(fixtureRows, generatedAt) {
  return [
    row("generic_parser_variable", "Scanner recognizes parser variables beyond arg", rowPass(fixtureRows, "value_oneline_ok"), "scanner_fixture.value_oneline_ok", generatedAt),
    row("multiline_branch", "Scanner recognizes multi-line --check branch bodies", rowPass(fixtureRows, "arg_multiline_ok"), "scanner_fixture.arg_multiline_ok", generatedAt),
    row("missing_write_negative", "Scanner catches --check branches that do not disable write", rowPass(fixtureRows, "missing_write_blocked"), "scanner_fixture.missing_write_blocked", generatedAt),
    row("missing_branch_negative", "Scanner catches guarded generators with no parse branch", rowPass(fixtureRows, "missing_branch_blocked"), "scanner_fixture.missing_branch_blocked", generatedAt),
  ];
}

function buildFileRows(scan, generatedAt) {
  return scan.file_rows.map((fileRow) => ({
    row_id: slug(fileRow.file_path),
    file_path: fileRow.file_path,
    guarded_generator: fileRow.guarded_generator,
    check_branch_count: fileRow.check_branch_count,
    finding_count: fileRow.findings.length,
    current_verdict: fileRow.current_verdict,
    block_reason: fileRow.findings.length === 0 ? null : "Check-mode write guard finding present.",
    generated_at: generatedAt,
  }));
}

function buildFindingRows(scan, generatedAt) {
  if (scan.findings.length === 0) {
    return [row("no_offenders", "No guarded generator check-mode offenders", true, "check-no-write-policy", generatedAt)];
  }
  return scan.findings.map((item) => ({ ...item, generated_at: generatedAt }));
}

function buildPolicyRecoveryRows(scan, fixtureRows, generatedAt) {
  return [
    row("shared_scanner_helper", "No-write policy test uses shared scanner helper", true, "src/check-mode-guard-normalization.mjs", generatedAt),
    row("fixture_coverage", "Scanner has positive and negative fixtures", allPass(fixtureRows), "scanner_fixture_rows", generatedAt),
    row("offender_count_zero", "Current guarded generator offender count is zero", scan.offender_count === 0, String(scan.offender_count), generatedAt),
  ];
}

function buildTrustCarryoverRows(source, generatedAt) {
  const summary = source.data?.summary ?? {};
  return [
    row("p18000_source_status", "P18000 source status is carried forward", Boolean(summary.trust_delta_ledger_status), summary.trust_delta_ledger_status ?? "missing", generatedAt),
    row("trust_debt_count_visible", "Remaining P18000 trust debt count stays visible", Number.isFinite(summary.trust_debt_count), String(summary.trust_debt_count ?? "missing"), generatedAt),
    row("unresolved_findings_visible", "Remaining unresolved findings stay visible", Number.isFinite(summary.unresolved_finding_count), String(summary.unresolved_finding_count ?? "missing"), generatedAt),
    row("full_suite_debt_visible", "Remaining full-suite debt stays visible", typeof summary.full_suite_debt_present_now === "boolean", String(summary.full_suite_debt_present_now ?? "missing"), generatedAt),
  ];
}

function buildAuthorityRows(generatedAt) {
  return ["production_pass_enabled", "enterprise_trust_claim_allowed_now", "runtime_execution_allowed_now", "write_action_allowed_now", "connector_write_enabled", "final_automated_approval_allowed"]
    .map((term) => row(term, `${term} remains closed`, true, "authority_boundary", generatedAt));
}

function buildValidationEvidenceRows(scan, fixtureRows, generatedAt) {
  return [
    row("check_no_write_policy_target", "Targeted no-write policy test is expected to pass after scanner normalization", scan.offender_count === 0, "node --test test/check-no-write-policy.test.mjs", generatedAt),
    row("scanner_fixture_target", "Scanner fixture tests cover variable and branch shape", allPass(fixtureRows), "node --test test/check-mode-guard-normalization.test.mjs", generatedAt),
    row("adjacent_trust_check", "Adjacent trust checks remain required evidence", true, "platform:trust-delta-ledger -- --check", generatedAt),
    row("full_npm_test_debt_visible", "Full npm test can be retried but is not converted into production PASS", true, "npm test", generatedAt),
  ];
}

function buildReviewPacketRows(generatedAt) {
  return [
    row("claude_review_recommended", "Claude Code Opus max review is recommended for this no-write scanner trust tranche", true, "review_packet", generatedAt),
    row("claude_not_final_approval", "Claude review cannot become final approval", true, "review_authority_boundary", generatedAt),
  ];
}

function buildFreezeRows(scan, source, fixtureRows, generatedAt) {
  return [
    row("p18400_closeout_id", "P18400 closeout id is fixed", true, "check_mode_guard_normalization.p18400", generatedAt),
    row("offender_count_zero", "No-write offender count is zero", scan.offender_count === 0, String(scan.offender_count), generatedAt),
    row("scanner_fixture_passed", "Scanner fixture contract passed", allPass(fixtureRows), "scanner_fixture_rows", generatedAt),
    row("p18000_trust_debt_carried", "P18000 trust debt is carried forward, not erased", Boolean(source.data?.summary), "trust_delta_carryover_rows", generatedAt),
    row("protected_authority_closed", "Protected authority remains closed", true, "authority_boundary_rows", generatedAt),
  ];
}

function buildBoundary(context) {
  const scannerFixturePassed = allPass(context.fixtureRows);
  const sourceAvailable = Boolean(context.source.available && context.source.data);
  const ready = sourceAvailable && scannerFixturePassed && context.scan.offender_count === 0;
  return {
    ready_for_p18401_handoff: ready,
    p18401_handoff_gate_ready: ready,
    source_trust_delta_available_now: sourceAvailable,
    p18000_ready_for_p18001_handoff: context.source.data?.summary?.ready_for_p18001_handoff === true,
    source_trust_debt_count: context.source.data?.summary?.trust_debt_count ?? null,
    source_unresolved_finding_count: context.source.data?.summary?.unresolved_finding_count ?? null,
    source_full_suite_debt_present_now: context.source.data?.summary?.full_suite_debt_present_now ?? null,
    guarded_generator_count: context.scan.guarded_generator_count,
    check_branch_count: context.scan.check_branch_count,
    offender_count: context.scan.offender_count,
    scanner_fixture_passed_now: scannerFixturePassed,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    protected_closeout_enabled: false,
    human_gate_bypass_allowed_now: false,
    independent_review_bypass_allowed_now: false,
    single_owner_enterprise_trust_allowed_now: false,
    environment_config_write_allowed_now: false,
    migration_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    runtime_execution_allowed_now: false,
    write_action_allowed_now: false,
    protected_action_allowed_now: false,
    connector_write_enabled: false,
    external_service_mutation_allowed_now: false,
    secret_read_allowed_now: false,
    raw_source_exposure_allowed: false,
    reviewer_mutation_allowed_now: false,
    final_approval_ui_enabled: false,
    codex_final_approval_ui_enabled: false,
    claude_final_approval_ui_enabled: false,
    final_automated_approval_allowed: false,
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, "platform:check-mode-guard-normalization"), "package.json registers platform:check-mode-guard-normalization"),
    validationItem("package.validate", "package", context.packageJson.text.includes("platform:check-mode-guard-normalization -- --check"), "npm run validate includes check-mode guard normalization"),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P18001-P18400 phase rows are covered"),
    validationItem("architecture.boundary", "architecture", context.architectureDoc.text.includes("P18001-P18400 Check-Mode Guard Normalization"), "Architecture documents P18001-P18400 boundary"),
    validationItem("scanner.fixtures", "scanner", allPass(context.scannerRows), "Scanner fixtures pass"),
    validationItem("scanner.no_offenders", "scanner", context.boundary.offender_count === 0, "No guarded generator check-mode offenders remain"),
    validationItem("source.trust_delta_visible", "source", context.boundary.source_trust_delta_available_now, "P18000 source summary is available or rebuilt"),
    validationItem("authority.closed", "authority", protectedBoundaryClosed(context.boundary), "Protected authority remains closed"),
    validationItem("freeze.ready", "freeze", context.boundary.ready_for_p18401_handoff, "P18401 handoff gate is ready only for no-write policy scanner recovery"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "check_mode_guard_normalization",
    generated_at: generatedAt,
    scanner_scope: "src/*.mjs guarded generators with options.write !== false and --check",
    protected_authority: "closed",
    review_authority: "Claude review evidence allowed; final approval disallowed",
  };
}

function buildSummary({ scan, fixtureRows, boundary, validation }) {
  return {
    check_mode_guard_status: validation.valid && boundary.ready_for_p18401_handoff ? READY_STATUS : BLOCKED_STATUS,
    guarded_generator_count: scan.guarded_generator_count,
    check_branch_count: scan.check_branch_count,
    offender_count: scan.offender_count,
    scanner_fixture_passed_now: allPass(fixtureRows),
    source_trust_debt_count: boundary.source_trust_debt_count,
    source_unresolved_finding_count: boundary.source_unresolved_finding_count,
    source_full_suite_debt_present_now: boundary.source_full_suite_debt_present_now,
    ready_for_p18401_handoff: validation.valid && boundary.ready_for_p18401_handoff,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Check-Mode Guard Normalization",
    "",
    `Status: ${result.summary.check_mode_guard_status}`,
    `Program: ${result.program_range}`,
    `Guarded generators: ${result.summary.guarded_generator_count}`,
    `No-write offenders: ${result.summary.offender_count}`,
    `Scanner fixtures passed: ${result.summary.scanner_fixture_passed_now}`,
    `Ready for P18401 handoff: ${result.summary.ready_for_p18401_handoff}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.check_mode_guard_file_rows.map((rowItem) => `<tr><td>${escapeHtml(rowItem.file_path)}</td><td>${escapeHtml(rowItem.check_branch_count)}</td><td>${escapeHtml(rowItem.current_verdict)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Check-Mode Guard Normalization</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7f9; color: #1d2433; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 24px; line-height: 1.2; margin: 0 0 12px; }
    table { border-collapse: collapse; width: 100%; background: #fff; border: 1px solid #d9dee8; }
    th, td { text-align: left; border-bottom: 1px solid #e6e9ef; padding: 8px 10px; font-size: 13px; }
    th { background: #f0f3f8; color: #364152; }
    .notice { border-left: 3px solid #2563eb; background: #eef4ff; padding: 10px 12px; border-radius: 4px; }
  </style>
</head>
<body>
  <main>
    <h1>Hermes Check-Mode Guard Normalization</h1>
    <p class="notice">This plane recovers no-write validation evidence. It does not create execution, write authority, connector mutation, production PASS, enterprise trust, or final approval.</p>
    <table><thead><tr><th>File</th><th>Check Branches</th><th>Verdict</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP18000(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildTrustDeltaLedger({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.trust_delta_ledger", built);
}

async function readJsonSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    const text = await readFile(resolved, "utf8");
    return { path: resolved, available: true, text, data: JSON.parse(text) };
  } catch (error) {
    return { path: resolved, available: false, text: "", data: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    const text = await readFile(resolved, "utf8");
    return { path: resolved, available: true, text };
  } catch (error) {
    return { path: resolved, available: false, text: "", error: error.message };
  }
}

function normalizeInlineJsonSource(label, value) {
  if (value && typeof value === "object") return { path: label, available: true, data: value };
  return { path: label, available: false, data: null, error: "Inline source unavailable" };
}

function normalizeInputs(options) {
  const defaults = DEFAULT_CHECK_MODE_GUARD_NORMALIZATION_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_trust_delta_ledger_path: path.resolve(repoRoot, options.sourceTrustDeltaLedgerPath ?? defaults.sourceTrustDeltaLedgerPath),
    src_dir: path.resolve(repoRoot, options.srcDir ?? defaults.srcDir),
  };
}

function parseArgs(argv) {
  const args = { write: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") {
      args.outDir = argv[index + 1];
      index += 1;
    } else if (arg === "--source") {
      args.sourceTrustDeltaLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--src-dir") {
      args.srcDir = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--source FILE] [--src-dir DIR]`);
}

async function listMjsFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const filePath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await listMjsFiles(filePath));
    else if (entry.isFile() && entry.name.endsWith(".mjs")) files.push(filePath);
  }
  return files.sort();
}

function row(rowId, label, observed, evidenceRef, generatedAt, extras = {}) {
  return {
    row_id: rowId,
    label,
    observed,
    current_verdict: observed ? "pass" : "blocked",
    block_reason: observed ? null : `${label} is missing or blocked.`,
    evidence_ref: evidenceRef,
    generated_at: generatedAt,
    ...extras,
  };
}

function validationItem(itemId, category, ok, message, evidenceRef = itemId) {
  return { item_id: itemId, category, ok, message, evidence_ref: evidenceRef };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => !item.ok).map((item) => ({ path: item.item_id, message: item.message }));
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function allPass(rows) {
  return Array.isArray(rows) && rows.length > 0 && rows.every((item) => item.current_verdict === "pass");
}

function rowPass(rows, rowId) {
  return rows.find((item) => item.row_id === rowId)?.current_verdict === "pass";
}

function hasScript(packageJson, scriptName) {
  return Boolean(packageJson?.scripts?.[scriptName]);
}

function protectedBoundaryClosed(boundary) {
  return [
    "deployment_allowed_now",
    "release_approval_allowed_now",
    "production_pass_enabled",
    "enterprise_pass_enabled",
    "enterprise_trust_claim_allowed_now",
    "human_gate_bypass_allowed_now",
    "independent_review_bypass_allowed_now",
    "runtime_execution_allowed_now",
    "write_action_allowed_now",
    "protected_action_allowed_now",
    "connector_write_enabled",
    "external_service_mutation_allowed_now",
    "secret_read_allowed_now",
    "raw_source_exposure_allowed",
    "reviewer_mutation_allowed_now",
    "final_automated_approval_allowed",
  ].every((key) => boundary[key] === false);
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, [key]: rows };
}

function serializableResult(result) {
  const { markdown, html, ...serializable } = result;
  return serializable;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
