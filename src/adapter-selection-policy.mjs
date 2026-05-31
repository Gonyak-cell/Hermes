import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_ADAPTER_SELECTION_POLICY_OUT_DIR = "artifacts/adapter-selection-policy/latest";

export const DEFAULT_ADAPTER_SELECTION_POLICY = {
  schema_version: "adapter-selection-policy.v1",
  policy_id: "adapter-selection-policy.safe-local-first.v1",
  policy_status: "active",
  generated_at: null,
  default_review_status: "needs_review",
  invariants: {
    trading_pack_untouched: true,
    external_service_default_allowed: false,
    network_default_allowed: false,
    client_facing_output_allowed: false,
    human_review_required: true,
    preserve_existing_deterministic_fallbacks: true,
  },
  document_chains: [
    chain("pdf", {
      primary: "liteparse_local",
      sidecars: [],
      fallbacks: ["paddleocr_local", "pdf_pdftotext_probe", "pdf_header_probe", "manual_review"],
      classification_limit: ["P0_PUBLIC", "P1_INTERNAL", "P2_CLIENT_CONFIDENTIAL", "P3_PRIVILEGED"],
      rationale: "PDF extraction benefits from page/bbox structure; keep pdftotext/header as deterministic fallbacks.",
    }),
    chain("png", {
      primary: "liteparse_local",
      sidecars: [],
      fallbacks: ["paddleocr_local", "manual_review"],
      classification_limit: ["P0_PUBLIC", "P1_INTERNAL", "P2_CLIENT_CONFIDENTIAL", "P3_PRIVILEGED"],
      rationale: "Images require local structure/OCR parsing before evidence review.",
    }),
    chain("jpg", {
      primary: "liteparse_local",
      sidecars: [],
      fallbacks: ["paddleocr_local", "manual_review"],
      classification_limit: ["P0_PUBLIC", "P1_INTERNAL", "P2_CLIENT_CONFIDENTIAL", "P3_PRIVILEGED"],
      rationale: "Images require local structure/OCR parsing before evidence review.",
    }),
    chain("jpeg", {
      primary: "liteparse_local",
      sidecars: [],
      fallbacks: ["paddleocr_local", "manual_review"],
      classification_limit: ["P0_PUBLIC", "P1_INTERNAL", "P2_CLIENT_CONFIDENTIAL", "P3_PRIVILEGED"],
      rationale: "Images require local structure/OCR parsing before evidence review.",
    }),
    chain("webp", {
      primary: "liteparse_local",
      sidecars: [],
      fallbacks: ["paddleocr_local", "manual_review"],
      classification_limit: ["P0_PUBLIC", "P1_INTERNAL", "P2_CLIENT_CONFIDENTIAL", "P3_PRIVILEGED"],
      rationale: "Images require local structure/OCR parsing before evidence review.",
    }),
    chain("docx", {
      primary: "docx_word_xml_probe",
      sidecars: ["liteparse_layout_sidecar"],
      fallbacks: ["manual_review"],
      classification_limit: ["P0_PUBLIC", "P1_INTERNAL", "P2_CLIENT_CONFIDENTIAL", "P3_PRIVILEGED"],
      rationale: "OpenXML remains deterministic primary; LiteParse may add layout metadata only.",
    }),
    chain("pptx", {
      primary: "pptx_open_xml_probe",
      sidecars: ["liteparse_layout_sidecar"],
      fallbacks: ["manual_review"],
      classification_limit: ["P0_PUBLIC", "P1_INTERNAL", "P2_CLIENT_CONFIDENTIAL", "P3_PRIVILEGED"],
      rationale: "OpenXML remains deterministic primary; LiteParse may add slide layout metadata only.",
    }),
    chain("xlsx", {
      primary: "xlsx_open_xml_probe",
      sidecars: ["liteparse_layout_sidecar"],
      fallbacks: ["manual_review"],
      classification_limit: ["P0_PUBLIC", "P1_INTERNAL", "P2_CLIENT_CONFIDENTIAL", "P3_PRIVILEGED"],
      rationale: "OpenXML remains deterministic primary; LiteParse may add workbook layout metadata only.",
    }),
  ],
  public_web_policy: {
    connector_id: "connector.public_web.v2",
    allowed_classifications: ["P0_PUBLIC", "P1_INTERNAL"],
    url_allowlist_required: true,
    query_based_crawling_allowed: false,
    authenticated_profile_allowed: false,
    proxy_escalation_allowed: false,
    private_network_targets_allowed: false,
    external_service_allowed: false,
    cloud_crawl4ai_allowed: false,
    output_status: "pending_review",
  },
};

const REQUIRED_ADAPTER_FIELDS = [
  "classification_limit",
  "network_access_allowed",
  "external_service_allowed",
  "model_download_allowed",
  "local_command_required",
  "fallback_on_missing_command",
  "human_review_required",
  "output_status",
];

export function buildAdapterSelectionPolicy(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const policy = structuredClone(DEFAULT_ADAPTER_SELECTION_POLICY);
  policy.generated_at = generatedAt;
  policy.policy_hash = hashValue({
    document_chains: policy.document_chains,
    public_web_policy: policy.public_web_policy,
    invariants: policy.invariants,
  });
  const validationItems = validateAdapterSelectionPolicy(policy);
  const validation = summarizeValidation(validationItems);
  return {
    schema_version: "adapter-selection-policy-report.v1",
    generated_at: generatedAt,
    output_dir: path.resolve(options.outDir ?? DEFAULT_ADAPTER_SELECTION_POLICY_OUT_DIR),
    adapter_selection_policy: policy,
    validation_items: validationItems,
    validation,
    summary: {
      adapter_selection_policy_status: validation.valid ? "complete" : "blocked",
      policy_id: policy.policy_id,
      chain_count: policy.document_chains.length,
      public_web_allowed_classification_count: policy.public_web_policy.allowed_classifications.length,
      validation_error_count: validation.errors.length,
      trading_pack_untouched: policy.invariants.trading_pack_untouched,
      promoted_primary_count: policy.document_chains.filter((item) => item.primary_adapter_id === "liteparse_local").length,
      deterministic_office_primary_count: policy.document_chains.filter((item) => /^(docx|pptx|xlsx)$/.test(item.extension) && item.primary_adapter_id.endsWith("_probe")).length,
    },
    markdown: renderAdapterSelectionPolicyMarkdown(policy, validation),
  };
}

export async function runAdapterSelectionPolicy(options = {}) {
  const result = buildAdapterSelectionPolicy(options);
  if (options.write !== false) await writeAdapterSelectionPolicy(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Adapter selection policy validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function writeAdapterSelectionPolicy(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "adapter-selection-policy.json"), result.adapter_selection_policy);
  await writeJson(path.join(outDir, "adapter-selection-policy-report.json"), serializable(result));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "adapter-selection-policy-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export function selectAdapterChain(extension, options = {}) {
  const normalized = normalizeExtension(extension);
  const policy = options.policy ?? DEFAULT_ADAPTER_SELECTION_POLICY;
  return policy.document_chains.find((item) => item.extension === normalized) ?? null;
}

export function isStructuredAdapterExtension(extension) {
  return Boolean(selectAdapterChain(extension));
}

export function isPublicWebClassificationAllowed(classification, options = {}) {
  const policy = options.policy ?? DEFAULT_ADAPTER_SELECTION_POLICY;
  return policy.public_web_policy.allowed_classifications.includes(classification);
}

export function validateAdapterSelectionPolicy(policy = DEFAULT_ADAPTER_SELECTION_POLICY) {
  const items = [];
  const seen = new Set();
  for (const docChain of policy.document_chains ?? []) {
    const prefix = `document_chains.${docChain.extension}`;
    pushCheck(items, prefix, "unique_extension", !seen.has(docChain.extension), "Each extension must have one adapter chain.");
    seen.add(docChain.extension);
    pushCheck(items, prefix, "primary_declared", Boolean(docChain.primary_adapter_id), "Primary adapter must be declared.");
    pushCheck(items, prefix, "fallbacks_declared", Array.isArray(docChain.fallback_adapter_ids), "Fallback adapters must be declared.");
    pushCheck(items, prefix, "required_fields", REQUIRED_ADAPTER_FIELDS.every((field) => Object.hasOwn(docChain, field)), "Adapter chain must declare required safety fields.");
    pushCheck(items, prefix, "local_only", docChain.network_access_allowed === false && docChain.external_service_allowed === false, "Document adapter chains must be local-only by default.");
    pushCheck(items, prefix, "review_required", docChain.human_review_required === true && docChain.output_status === "pending_review", "Document adapter outputs must require review and remain pending.");
  }
  const officeChains = (policy.document_chains ?? []).filter((item) => ["docx", "pptx", "xlsx"].includes(item.extension));
  pushCheck(items, "office.primary", "openxml_preserved", officeChains.every((item) => item.primary_adapter_id.endsWith("_probe") && item.sidecar_adapter_ids.includes("liteparse_layout_sidecar")), "Office OpenXML primary paths must be preserved with LiteParse sidecar only.");
  const promoted = (policy.document_chains ?? []).filter((item) => ["pdf", "png", "jpg", "jpeg", "webp"].includes(item.extension));
  pushCheck(items, "pdf_image.primary", "liteparse_promoted", promoted.every((item) => item.primary_adapter_id === "liteparse_local"), "PDF and image chains must promote LiteParse as primary candidate.");
  pushCheck(items, "pdf_image.fallback", "paddleocr_fallback", promoted.every((item) => item.fallback_adapter_ids.includes("paddleocr_local")), "PDF and image chains must include PaddleOCR fallback.");
  pushCheck(items, "public_web.policy", "limited_classifications", JSON.stringify(policy.public_web_policy.allowed_classifications) === JSON.stringify(["P0_PUBLIC", "P1_INTERNAL"]), "Public web connector must be limited to P0/P1.");
  pushCheck(items, "public_web.policy", "allowlist_required", policy.public_web_policy.url_allowlist_required === true && policy.public_web_policy.query_based_crawling_allowed === false, "Public web connector must require URL allowlist and forbid query crawling.");
  pushCheck(items, "trading_pack", "untouched", policy.invariants?.trading_pack_untouched === true, "Trading Pack must remain untouched by this integration.");
  return items;
}

export async function runAdapterSelectionPolicyCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runAdapterSelectionPolicy(args);
    console.log(`Adapter selection policy ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.adapter_selection_policy_status}`);
    console.log(`Chains: ${result.summary.chain_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function chain(extension, options) {
  return {
    schema_version: "adapter-selection-chain.v1",
    extension,
    primary_adapter_id: options.primary,
    sidecar_adapter_ids: options.sidecars,
    fallback_adapter_ids: options.fallbacks,
    classification_limit: options.classification_limit,
    network_access_allowed: false,
    external_service_allowed: false,
    model_download_allowed: false,
    local_command_required: ["liteparse_local", "paddleocr_local"].includes(options.primary),
    fallback_on_missing_command: true,
    human_review_required: true,
    output_status: "pending_review",
    rationale: options.rationale,
  };
}

function normalizeExtension(extension) {
  return String(extension ?? "").replace(/^\./, "").toLowerCase();
}

function pushCheck(items, pathValue, checkId, passed, message) {
  items.push({
    check_id: checkId,
    path: pathValue,
    status: passed ? "passed" : "failed",
    message,
  });
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed").map((item) => ({
    path: `${item.path}.${item.check_id}`,
    message: item.message,
  }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function renderAdapterSelectionPolicyMarkdown(policy, validation) {
  const lines = [];
  lines.push("# Adapter Selection Policy");
  lines.push("");
  lines.push(`Generated: ${policy.generated_at}`);
  lines.push(`Status: ${validation.valid ? "complete" : "blocked"}`);
  lines.push("");
  lines.push("## Chains");
  lines.push("");
  for (const chainRow of policy.document_chains) {
    lines.push(`- ${chainRow.extension}: primary ${chainRow.primary_adapter_id}; sidecar ${chainRow.sidecar_adapter_ids.join(", ") || "none"}; fallback ${chainRow.fallback_adapter_ids.join(", ")}`);
  }
  lines.push("");
  lines.push("## Public Web");
  lines.push("");
  lines.push(`- Classifications: ${policy.public_web_policy.allowed_classifications.join(", ")}`);
  lines.push(`- URL allowlist required: ${policy.public_web_policy.url_allowlist_required}`);
  lines.push("");
  lines.push("Human review note: adapter outputs remain internal, pending review, and not client-facing.");
  if (validation.errors.length) {
    lines.push("");
    lines.push("## Validation Errors");
    for (const error of validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_ADAPTER_SELECTION_POLICY_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else if (arg === "--no-write") parsed.write = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/adapter-selection-policy.mjs [options]

Options:
  --out-dir <folder>   Output directory.
  --run-at <iso>       Deterministic generated_at timestamp.
  --check              Validate only, do not write artifacts.
  --no-write           Build without writing artifacts.
  -h, --help           Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function serializable(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runAdapterSelectionPolicyCli();
}
