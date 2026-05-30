import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_POLICY_SNAPSHOT_LEDGER_OUT_DIR = "artifacts/policy-snapshots/latest";
export const DEFAULT_POLICY_SNAPSHOT_MATRIX_CATALOG = "artifacts/policy-matrix/latest/policy-matrix-catalog.json";

export const DEFAULT_POLICY_SNAPSHOT_SOURCES = [
  {
    source_id: "vertical_slice",
    label: "First Vertical Slice",
    slice_path: "artifacts/vertical-slice/latest/vertical-slice.json",
    event_ledger_path: "artifacts/vertical-slice/latest/event-ledger.json",
  },
  {
    source_id: "law_firm_ldd_slice",
    label: "Law Firm LDD Slice",
    slice_path: "artifacts/law-firm-ldd-slice/latest/law-firm-ldd-slice.json",
    event_ledger_path: "artifacts/law-firm-ldd-slice/latest/event-ledger.json",
  },
  {
    source_id: "personal_dev_slice",
    label: "Personal Dev Slice",
    slice_path: "artifacts/personal-dev-slice/latest/personal-dev-slice.json",
    event_ledger_path: "artifacts/personal-dev-slice/latest/event-ledger.json",
  },
  {
    source_id: "creative_document_slice",
    label: "Creative Document Slice",
    slice_path: "artifacts/creative-document-slice/latest/creative-document-slice.json",
    event_ledger_path: "artifacts/creative-document-slice/latest/event-ledger.json",
  },
];

export async function runPolicySnapshotLedger(options = {}) {
  const result = await buildPolicySnapshotLedger(options);
  if (options.write !== false) await writePolicySnapshotLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Policy snapshot ledger validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPolicySnapshotLedger(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_POLICY_SNAPSHOT_LEDGER_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const matrixCatalogPath = path.resolve(options.matrixCatalogPath ?? DEFAULT_POLICY_SNAPSHOT_MATRIX_CATALOG);
  const matrixResult = await readJsonOrError(matrixCatalogPath);
  const sourceDefinitions = normalizeSourceDefinitions(options.sources ?? buildSourceDefinitionsFromOptions(options));
  const sources = await readPolicySnapshotSources(sourceDefinitions);
  const snapshotInstances = sources.flatMap(extractSnapshotInstances);
  const usageRecords = sources.flatMap(extractUsageRecords);
  const snapshots = buildCanonicalSnapshots(snapshotInstances);
  const policyDecisions = buildPolicyDecisions(snapshots, matrixResult.value);
  const validation = validatePolicySnapshotLedger({ matrixResult, sources, snapshots, usageRecords, policyDecisions });
  const ledger = {
    schema_version: "policy-snapshot-ledger.v1",
    generated_at: generatedAt,
    ledger_id: `policy-snapshot-ledger.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    policy_matrix_catalog_path: matrixCatalogPath,
    ledger_status: validation.valid ? "valid" : "blocked",
    summary: summarizePolicySnapshotLedger({
      sources,
      snapshotInstances,
      snapshots,
      usageRecords,
      policyDecisions,
      validation,
    }),
    sources: sources.map(({ slice: _slice, event_ledger: _eventLedger, ...source }) => source),
    policy_snapshots: snapshots,
    snapshot_instances: snapshotInstances,
    policy_decisions: policyDecisions,
    usage_records: usageRecords,
    validation,
  };

  return {
    ...ledger,
    markdown: renderPolicySnapshotLedgerMarkdown(ledger),
  };
}

export async function writePolicySnapshotLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "policy-snapshot-ledger.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    ledger_id: result.ledger_id,
    output_dir: result.output_dir,
    policy_matrix_catalog_path: result.policy_matrix_catalog_path,
    ledger_status: result.ledger_status,
    summary: result.summary,
    sources: result.sources,
    policy_snapshots: result.policy_snapshots,
    snapshot_instances: result.snapshot_instances,
    policy_decisions: result.policy_decisions,
    usage_records: result.usage_records,
    validation: result.validation,
  });
  await writeJson(path.join(outDir, "policy-snapshot-usages.json"), {
    generated_at: result.generated_at,
    count: result.usage_records.length,
    usage_records: result.usage_records,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPolicySnapshotLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runPolicySnapshotLedger(args);
    console.log(`Policy snapshot ledger ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Ledger status: ${result.ledger_status}`);
    console.log(`Policy snapshots: ${result.summary.policy_snapshot_count}`);
    console.log(`Workflow usages: ${result.summary.workflow_usage_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function normalizeSourceDefinitions(sources) {
  return sources.map((source) => ({
    source_id: source.source_id,
    label: source.label,
    slice_path: path.resolve(source.slice_path),
    event_ledger_path: path.resolve(source.event_ledger_path),
  }));
}

function buildSourceDefinitionsFromOptions(options) {
  const overrides = new Map();
  setSourceOverride(overrides, "vertical_slice", options.verticalSlicePath, options.verticalLedgerPath);
  setSourceOverride(overrides, "law_firm_ldd_slice", options.lawFirmSlicePath, options.lawFirmLedgerPath);
  setSourceOverride(overrides, "personal_dev_slice", options.personalDevSlicePath, options.personalDevLedgerPath);
  setSourceOverride(overrides, "creative_document_slice", options.creativeDocumentSlicePath, options.creativeDocumentLedgerPath);

  return DEFAULT_POLICY_SNAPSHOT_SOURCES
    .filter((source) => overrides.get(source.source_id)?.enabled !== false)
    .map((source) => {
      const override = overrides.get(source.source_id) ?? {};
      return {
        ...source,
        slice_path: override.slice_path ?? source.slice_path,
        event_ledger_path: override.event_ledger_path ?? source.event_ledger_path,
      };
    });
}

function setSourceOverride(overrides, sourceId, slicePath, ledgerPath) {
  if (slicePath === undefined && ledgerPath === undefined) return;
  overrides.set(sourceId, {
    enabled: slicePath !== false,
    slice_path: slicePath === false ? undefined : slicePath,
    event_ledger_path: ledgerPath,
  });
}

async function readPolicySnapshotSources(sourceDefinitions) {
  const sources = [];
  for (const source of sourceDefinitions) {
    const sliceResult = await readJsonOrError(source.slice_path);
    const ledgerResult = await readJsonOrError(source.event_ledger_path);
    const slice = sliceResult.value;
    const eventLedger = ledgerResult.value;
    const available = sliceResult.ok && ledgerResult.ok;
    const errors = [
      sliceResult.ok ? null : `slice:${sliceResult.error}`,
      ledgerResult.ok ? null : `event_ledger:${ledgerResult.error}`,
    ].filter(Boolean);
    sources.push({
      source_id: source.source_id,
      label: source.label,
      slice_path: source.slice_path,
      event_ledger_path: source.event_ledger_path,
      available,
      schema_version: slice?.schema_version ?? null,
      generated_at: slice?.generated_at ?? null,
      event_ledger_generated_at: eventLedger?.generated_at ?? null,
      policy_snapshot_count: slice?.identity_policy?.policy_snapshots?.length ?? 0,
      workflow_usage_count: slice?.workflow_runtime?.workflow_runs?.filter((run) => run.policy_snapshot_id)?.length ?? 0,
      event_reference_count: eventLedger?.events?.filter((event) => event.policy_snapshot_id)?.length ?? 0,
      run_ledger_reference_count: eventLedger?.run_ledgers?.filter((runLedger) => runLedger.policy_snapshot_id)?.length ?? 0,
      error: errors.length > 0 ? errors.join("; ") : null,
      slice,
      event_ledger: eventLedger,
    });
  }
  return sources;
}

function extractSnapshotInstances(source) {
  if (!source.available) return [];
  return (source.slice.identity_policy?.policy_snapshots ?? []).map((snapshot, index) => {
    const bodyHash = snapshotBodyHash(snapshot);
    return {
      snapshot_instance_id: `policy-snapshot-instance.${source.source_id}.${slugify(snapshot.id)}.${bodyHash.slice(0, 10)}`,
      source_id: source.source_id,
      source_label: source.label,
      source_schema_version: source.schema_version,
      source_generated_at: source.generated_at,
      policy_snapshot_id: snapshot.id,
      tenant_id: snapshot.tenant_id,
      created_at: snapshot.created_at,
      body_hash: bodyHash,
      default_classification: snapshot.classification_rules?.default_classification ?? null,
      max_input_classification: snapshot.classification_rules?.max_input_classification ?? snapshot.classification_rules?.default_classification ?? null,
      runtime_classifications: Object.keys(snapshot.runtime_permissions ?? {}).sort(),
      model_permission_keys: Object.keys(snapshot.model_permissions ?? {}).sort(),
      output_permission_keys: Object.keys(snapshot.output_permissions ?? {}).sort(),
      approval_rule_keys: Object.keys(snapshot.approval_rules ?? {}).sort(),
      snapshot_index: index,
      metadata: snapshot.metadata ?? {},
      snapshot,
    };
  });
}

function buildCanonicalSnapshots(instances) {
  return [...groupBy(instances, "policy_snapshot_id").entries()].map(([snapshotId, grouped]) => {
    const bodyHashes = unique(grouped.map((item) => item.body_hash));
    const first = grouped.slice().sort((left, right) => left.created_at.localeCompare(right.created_at))[0];
    const latest = grouped.slice().sort((left, right) => right.created_at.localeCompare(left.created_at))[0];
    return {
      policy_snapshot_id: snapshotId,
      tenant_id: first.tenant_id,
      source_ids: unique(grouped.map((item) => item.source_id)),
      source_count: unique(grouped.map((item) => item.source_id)).length,
      instance_count: grouped.length,
      created_at_first: first.created_at,
      created_at_latest: latest.created_at,
      body_hash: first.body_hash,
      conflicting_body_hashes: bodyHashes,
      conflict: bodyHashes.length > 1,
      default_classification: first.default_classification,
      max_input_classification: first.max_input_classification,
      runtime_classifications: unique(grouped.flatMap((item) => item.runtime_classifications)),
      model_permission_keys: unique(grouped.flatMap((item) => item.model_permission_keys)),
      output_permission_keys: unique(grouped.flatMap((item) => item.output_permission_keys)),
      approval_rule_keys: unique(grouped.flatMap((item) => item.approval_rule_keys)),
      metadata: first.metadata,
      snapshot: snapshotBody(first.snapshot),
    };
  }).sort((left, right) => left.policy_snapshot_id.localeCompare(right.policy_snapshot_id));
}

function extractUsageRecords(source) {
  if (!source.available) return [];
  const declaredSnapshotIds = new Set((source.slice.identity_policy?.policy_snapshots ?? []).map((snapshot) => snapshot.id));
  const workflowUsages = (source.slice.workflow_runtime?.workflow_runs ?? [])
    .filter((run) => run.policy_snapshot_id)
    .map((run) => ({
      usage_id: `policy-usage.${source.source_id}.workflow.${slugify(run.id)}`,
      usage_type: "workflow_run",
      source_id: source.source_id,
      source_label: source.label,
      policy_snapshot_id: run.policy_snapshot_id,
      snapshot_declared_in_source: declaredSnapshotIds.has(run.policy_snapshot_id),
      workflow_run_id: run.id,
      event_id: null,
      run_ledger_id: null,
      tenant_id: run.tenant_id,
      matter_id: run.matter_id,
      capability_id: run.capability_id,
      status: run.status,
      occurred_at: run.created_at,
      metadata: {},
    }));
  const eventUsages = (source.event_ledger.events ?? [])
    .filter((event) => event.policy_snapshot_id)
    .map((event) => ({
      usage_id: `policy-usage.${source.source_id}.event.${slugify(event.id)}`,
      usage_type: "event",
      source_id: source.source_id,
      source_label: source.label,
      policy_snapshot_id: event.policy_snapshot_id,
      snapshot_declared_in_source: declaredSnapshotIds.has(event.policy_snapshot_id),
      workflow_run_id: event.correlation_id ?? null,
      event_id: event.id,
      run_ledger_id: null,
      tenant_id: event.tenant_id,
      matter_id: null,
      capability_id: null,
      status: event.type,
      occurred_at: event.time,
      metadata: {
        subject_type: event.subject?.subject_type ?? null,
        subject_id: event.subject?.subject_id ?? null,
      },
    }));
  const runLedgerUsages = (source.event_ledger.run_ledgers ?? [])
    .filter((runLedger) => runLedger.policy_snapshot_id)
    .map((runLedger) => ({
      usage_id: `policy-usage.${source.source_id}.run_ledger.${slugify(runLedger.id)}`,
      usage_type: "run_ledger",
      source_id: source.source_id,
      source_label: source.label,
      policy_snapshot_id: runLedger.policy_snapshot_id,
      snapshot_declared_in_source: declaredSnapshotIds.has(runLedger.policy_snapshot_id),
      workflow_run_id: runLedger.workflow_run_id,
      event_id: null,
      run_ledger_id: runLedger.id,
      tenant_id: runLedger.tenant_id,
      matter_id: null,
      capability_id: null,
      status: runLedger.status,
      occurred_at: runLedger.created_at ?? runLedger.updated_at,
      metadata: {
        agent_run_count: runLedger.agent_run_ids?.length ?? 0,
      },
    }));
  return [...workflowUsages, ...eventUsages, ...runLedgerUsages];
}

function buildPolicyDecisions(snapshots, matrixCatalog) {
  const modelRules = new Map((matrixCatalog?.model_rules ?? []).map((rule) => [rule.classification, rule]));
  const runtimeRules = new Map((matrixCatalog?.runtime_rules ?? []).map((rule) => [rule.classification, rule]));
  return snapshots.map((snapshot) => {
    const classification = snapshot.default_classification ?? "unknown";
    const modelRule = modelRules.get(classification) ?? null;
    const runtimeRule = runtimeRules.get(classification) ?? null;
    const snapshotAllowedRuntimes = snapshot.snapshot.runtime_permissions?.[classification] ?? [];
    const forbiddenRuntimeViolations = snapshotAllowedRuntimes.filter((runtimeId) => (runtimeRule?.forbidden_runtimes ?? []).includes(runtimeId));
    const expectedExternalPolicy = modelRule?.external_model_policy ?? null;
    const snapshotExternalPolicy = snapshot.snapshot.model_permissions?.[externalModelKeyFor(classification)] ?? null;
    const externalModelAligned = !snapshotExternalPolicy || !expectedExternalPolicy || snapshotExternalPolicy === expectedExternalPolicy;
    const decisionStatus = forbiddenRuntimeViolations.length === 0 && externalModelAligned ? "passed" : "blocked";
    return {
      decision_id: `policy-decision.${slugify(snapshot.policy_snapshot_id)}.${slugify(classification)}`,
      policy_snapshot_id: snapshot.policy_snapshot_id,
      tenant_id: snapshot.tenant_id,
      classification,
      source_ids: snapshot.source_ids,
      decision_status: decisionStatus,
      external_model_policy: expectedExternalPolicy,
      snapshot_external_model_policy: snapshotExternalPolicy,
      external_model_aligned: externalModelAligned,
      local_model_policy: modelRule?.local_model_policy ?? null,
      redaction_policy: modelRule?.redaction_policy ?? null,
      approval_required: Boolean(modelRule?.approval_required || snapshot.approval_rule_keys.length > 0),
      allowed_runtimes: runtimeRule?.allowed_runtimes ?? [],
      restricted_runtimes: runtimeRule?.restricted_runtimes ?? [],
      forbidden_runtimes: runtimeRule?.forbidden_runtimes ?? [],
      snapshot_allowed_runtimes: snapshotAllowedRuntimes,
      forbidden_runtime_violations: forbiddenRuntimeViolations,
      required_gates: runtimeRule?.required_gates ?? [],
      output_permission_keys: snapshot.output_permission_keys,
      approval_rule_keys: snapshot.approval_rule_keys,
      metadata: {},
    };
  });
}

function validatePolicySnapshotLedger({ matrixResult, sources, snapshots, usageRecords, policyDecisions }) {
  const errors = [];
  if (!matrixResult.ok) {
    errors.push({ path: "policy_matrix_catalog", message: `Policy matrix catalog is unavailable: ${matrixResult.error}` });
  } else if (matrixResult.value.policy_status !== "valid") {
    errors.push({ path: "policy_matrix_catalog.policy_status", message: `Policy matrix catalog is ${matrixResult.value.policy_status}` });
  }
  for (const source of sources) {
    if (!source.available) {
      errors.push({ path: `sources.${source.source_id}`, message: source.error ?? "source unavailable" });
    }
  }
  for (const snapshot of snapshots) {
    if (snapshot.conflict) {
      errors.push({ path: `policy_snapshots.${snapshot.policy_snapshot_id}`, message: "Policy snapshot id has conflicting rule bodies" });
    }
  }
  for (const usage of usageRecords) {
    if (!usage.snapshot_declared_in_source) {
      errors.push({ path: `usage_records.${usage.usage_id}`, message: `Policy snapshot ${usage.policy_snapshot_id} is referenced but not declared in ${usage.source_id}` });
    }
  }
  for (const decision of policyDecisions) {
    if (decision.forbidden_runtime_violations.length > 0) {
      errors.push({
        path: `policy_decisions.${decision.decision_id}.forbidden_runtime_violations`,
        message: `${decision.policy_snapshot_id} allows forbidden runtime(s): ${decision.forbidden_runtime_violations.join(", ")}`,
      });
    }
    if (!decision.external_model_aligned) {
      errors.push({
        path: `policy_decisions.${decision.decision_id}.external_model_policy`,
        message: `${decision.policy_snapshot_id} has ${decision.snapshot_external_model_policy}, expected ${decision.external_model_policy}`,
      });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizePolicySnapshotLedger({ sources, snapshotInstances, snapshots, usageRecords, policyDecisions, validation }) {
  return {
    source_count: sources.length,
    available_source_count: sources.filter((source) => source.available).length,
    missing_source_count: sources.filter((source) => !source.available).length,
    snapshot_instance_count: snapshotInstances.length,
    policy_snapshot_count: snapshots.length,
    duplicate_snapshot_instance_count: Math.max(0, snapshotInstances.length - snapshots.length),
    conflicting_snapshot_count: snapshots.filter((snapshot) => snapshot.conflict).length,
    policy_decision_count: policyDecisions.length,
    workflow_usage_count: usageRecords.filter((usage) => usage.usage_type === "workflow_run").length,
    event_reference_count: usageRecords.filter((usage) => usage.usage_type === "event").length,
    run_ledger_reference_count: usageRecords.filter((usage) => usage.usage_type === "run_ledger").length,
    missing_snapshot_reference_count: usageRecords.filter((usage) => !usage.snapshot_declared_in_source).length,
    external_model_forbidden_count: policyDecisions.filter((decision) => decision.external_model_policy === "forbidden").length,
    external_model_approval_required_count: policyDecisions.filter((decision) => decision.external_model_policy === "approval_required").length,
    approval_required_decision_count: policyDecisions.filter((decision) => decision.approval_required).length,
    runtime_violation_count: policyDecisions.reduce((sum, decision) => sum + decision.forbidden_runtime_violations.length, 0),
    validation_error_count: validation.errors.length,
    by_source: countBy(snapshotInstances, "source_id"),
    by_tenant: countBy(snapshots, "tenant_id"),
    by_default_classification: countBy(snapshots, "default_classification"),
    by_external_model_policy: countBy(policyDecisions, "external_model_policy"),
    by_usage_type: countBy(usageRecords, "usage_type"),
  };
}

function renderPolicySnapshotLedgerMarkdown(ledger) {
  const lines = [];
  lines.push("# Policy Snapshot Ledger");
  lines.push("");
  lines.push(`Generated: ${ledger.generated_at}`);
  lines.push(`Ledger status: ${ledger.ledger_status}`);
  lines.push("");
  lines.push(`- Policy snapshots: ${ledger.summary.policy_snapshot_count}`);
  lines.push(`- Snapshot instances: ${ledger.summary.snapshot_instance_count}`);
  lines.push(`- Workflow usages: ${ledger.summary.workflow_usage_count}`);
  lines.push(`- Event references: ${ledger.summary.event_reference_count}`);
  lines.push(`- Runtime violations: ${ledger.summary.runtime_violation_count}`);
  lines.push(`- Validation errors: ${ledger.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Snapshots");
  lines.push("");
  for (const snapshot of ledger.policy_snapshots) {
    lines.push(`- ${snapshot.policy_snapshot_id}: ${snapshot.default_classification}, sources=${snapshot.source_ids.join(", ")}`);
  }
  if (ledger.policy_snapshots.length === 0) lines.push("- No policy snapshots found.");
  if (ledger.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    lines.push("");
    for (const error of ledger.validation.errors) {
      lines.push(`- ${error.path}: ${error.message}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

async function readJsonOrError(filePath) {
  try {
    return {
      ok: true,
      value: JSON.parse(await readFile(filePath, "utf8")),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      value: null,
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

function snapshotBody(snapshot) {
  return {
    id: snapshot.id,
    tenant_id: snapshot.tenant_id,
    classification_rules: snapshot.classification_rules ?? {},
    runtime_permissions: snapshot.runtime_permissions ?? {},
    model_permissions: snapshot.model_permissions ?? {},
    output_permissions: snapshot.output_permissions ?? {},
    approval_rules: snapshot.approval_rules ?? {},
    metadata: snapshot.metadata ?? {},
  };
}

function snapshotBodyHash(snapshot) {
  return sha256(stableStringify(snapshotRuleBody(snapshot)));
}

function snapshotRuleBody(snapshot) {
  return {
    classification_rules: snapshot.classification_rules ?? {},
    runtime_permissions: snapshot.runtime_permissions ?? {},
    model_permissions: snapshot.model_permissions ?? {},
    output_permissions: snapshot.output_permissions ?? {},
    approval_rules: snapshot.approval_rules ?? {},
    metadata: snapshot.metadata ?? {},
  };
}

function externalModelKeyFor(classification) {
  const prefix = String(classification).split("_")[0];
  return `external_model_for_${prefix}`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function groupBy(items, key) {
  const groups = new Map();
  for (const item of items) {
    const value = item[key];
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(item);
  }
  return groups;
}

function countBy(items, key) {
  return Object.fromEntries(
    [...items.reduce((counts, item) => {
      const value = item[key] ?? "unknown";
      counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map()).entries()].sort(([left], [right]) => String(left).localeCompare(String(right))),
  );
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null))].sort((left, right) => String(left).localeCompare(String(right)));
}

function slugify(value) {
  return String(value ?? "unknown").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "unknown";
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_POLICY_SNAPSHOT_LEDGER_OUT_DIR,
    matrixCatalogPath: DEFAULT_POLICY_SNAPSHOT_MATRIX_CATALOG,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--policy-matrix-catalog" || arg === "--matrix-catalog") parsed.matrixCatalogPath = argv[++index];
    else if (arg === "--vertical-slice") parsed.verticalSlicePath = argv[++index];
    else if (arg === "--vertical-ledger") parsed.verticalLedgerPath = argv[++index];
    else if (arg === "--no-vertical-slice") parsed.verticalSlicePath = false;
    else if (arg === "--law-firm-slice") parsed.lawFirmSlicePath = argv[++index];
    else if (arg === "--law-firm-ledger") parsed.lawFirmLedgerPath = argv[++index];
    else if (arg === "--no-law-firm-slice") parsed.lawFirmSlicePath = false;
    else if (arg === "--personal-dev-slice") parsed.personalDevSlicePath = argv[++index];
    else if (arg === "--personal-dev-ledger") parsed.personalDevLedgerPath = argv[++index];
    else if (arg === "--no-personal-dev-slice") parsed.personalDevSlicePath = false;
    else if (arg === "--creative-document-slice") parsed.creativeDocumentSlicePath = argv[++index];
    else if (arg === "--creative-document-ledger") parsed.creativeDocumentLedgerPath = argv[++index];
    else if (arg === "--no-creative-document-slice") parsed.creativeDocumentSlicePath = false;
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/policy-snapshot-ledger.mjs [options]

Options:
  --policy-matrix-catalog <path> policy-matrix-catalog.json path.
  --out-dir <folder>            Output directory.
  --vertical-slice <path>       vertical-slice.json path.
  --vertical-ledger <path>      vertical slice event-ledger.json path.
  --no-vertical-slice           Exclude first vertical slice.
  --law-firm-slice <path>       law-firm-ldd-slice.json path.
  --law-firm-ledger <path>      law firm event-ledger.json path.
  --no-law-firm-slice           Exclude law-firm slice.
  --personal-dev-slice <path>   personal-dev-slice.json path.
  --personal-dev-ledger <path>  personal-dev event-ledger.json path.
  --no-personal-dev-slice       Exclude personal-dev slice.
  --creative-document-slice <path>
                                 creative-document-slice.json path.
  --creative-document-ledger <path>
                                 creative-document event-ledger.json path.
  --no-creative-document-slice  Exclude creative-document slice.
  --run-at <iso>                Deterministic generated_at timestamp.
  --check                       Exit non-zero when the ledger is invalid.
  -h, --help                    Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
