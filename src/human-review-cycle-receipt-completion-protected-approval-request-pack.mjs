import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_PROTECTED_APPROVAL_REQUEST_PACK_OUT_DIR = "artifacts/human-review-cycle-receipt-completion-protected-approval-request-pack/latest";
export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_PROTECTED_APPROVAL_REQUEST_PACK_INPUTS = {
  heldCommandResolutionPath: "artifacts/human-review-cycle-receipt-completion-held-command-resolution/latest/human-review-cycle-receipt-completion-held-command-resolution.json",
};

const REQUIRED_APPROVAL_FIELDS = [
  "decision",
  "approved_by",
  "approved_at",
  "approval_scope",
  "risk_acknowledgement",
  "authorized_commands",
  "notes",
];

export async function runHumanReviewCycleReceiptCompletionProtectedApprovalRequestPack(options = {}) {
  const result = await buildHumanReviewCycleReceiptCompletionProtectedApprovalRequestPack(options);
  if (options.write !== false) await writeHumanReviewCycleReceiptCompletionProtectedApprovalRequestPack(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review cycle receipt completion protected approval request pack failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewCycleReceiptCompletionProtectedApprovalRequestPack(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_PROTECTED_APPROVAL_REQUEST_PACK_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const heldCommandResolutionPath = path.resolve(options.heldCommandResolutionPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_PROTECTED_APPROVAL_REQUEST_PACK_INPUTS.heldCommandResolutionPath);
  const heldCommandResolutionResult = await readJsonOrError(heldCommandResolutionPath);
  const sources = [
    buildSource("human_review_cycle_receipt_completion_held_command_resolution", "Human Review Cycle Receipt Completion Held Command Resolution", heldCommandResolutionPath, heldCommandResolutionResult),
  ];
  const resolutionPlans = heldCommandResolutionResult.value?.resolution_plans ?? [];
  const protectedResolutionPlans = resolutionPlans.filter((plan) => isProtectedApprovalResolution(plan));
  const nonProtectedResolutionPlans = resolutionPlans.filter((plan) => !isProtectedApprovalResolution(plan));
  const approvalRequests = buildApprovalRequests({ protectedResolutionPlans, outputDir });
  const actorApprovalPacks = buildActorApprovalPacks({ approvalRequests, outputDir });
  const validation = validateProtectedApprovalRequestPack({
    sources,
    heldCommandResolution: heldCommandResolutionResult.value,
    protectedResolutionPlans,
    nonProtectedResolutionPlans,
    approvalRequests,
    actorApprovalPacks,
  });
  const packStatus = derivePackStatus(validation, approvalRequests);
  const pack = {
    schema_version: "human-review-cycle-receipt-completion-protected-approval-request-pack.v1",
    generated_at: generatedAt,
    approval_request_pack_id: `human-review-cycle-receipt-completion-protected-approval-request-pack.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    pack_status: packStatus,
    safe_handling: {
      auto_execute_allowed: false,
      approval_request_pack_only: true,
      source_artifact_mutation_allowed: false,
      command_receipt_edits_allowed: false,
      commands_executed: false,
      protected_actions_executed: false,
    },
    sources,
    summary: summarizeProtectedApprovalRequestPack({
      heldCommandResolution: heldCommandResolutionResult.value,
      protectedResolutionPlans,
      nonProtectedResolutionPlans,
      approvalRequests,
      actorApprovalPacks,
      validation,
      packStatus,
    }),
    approval_requests: approvalRequests,
    actor_approval_packs: actorApprovalPacks,
    non_protected_resolution_plan_ids: nonProtectedResolutionPlans.map((plan) => plan.resolution_plan_id),
    validation,
  };

  return {
    ...pack,
    markdown: renderProtectedApprovalRequestPackMarkdown(pack),
  };
}

export async function writeHumanReviewCycleReceiptCompletionProtectedApprovalRequestPack(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-cycle-receipt-completion-protected-approval-request-pack.json"), serializablePack(result));
  await writeJson(path.join(outDir, "approval-requests.json"), {
    generated_at: result.generated_at,
    count: result.approval_requests.length,
    approval_requests: result.approval_requests,
  });
  await writeJson(path.join(outDir, "actor-approval-packs.json"), {
    generated_at: result.generated_at,
    count: result.actor_approval_packs.length,
    actor_approval_packs: result.actor_approval_packs,
  });
  await writeJson(path.join(outDir, "approval-input-template.json"), {
    generated_at: result.generated_at,
    approval_status: result.pack_status === "ready_for_explicit_approval" ? "pending_explicit_approval" : "not_required",
    required_approval_fields: REQUIRED_APPROVAL_FIELDS,
    approval_receipts: result.approval_requests.map((request) => request.approval_receipt_template),
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  for (const actorPack of result.actor_approval_packs) {
    const actorDir = path.join(outDir, "actors", actorPack.required_actor);
    const actorRequests = result.approval_requests.filter((request) => request.required_actor === actorPack.required_actor);
    await mkdir(actorDir, { recursive: true });
    await writeJson(path.join(actorDir, "protected-approval-request-pack.json"), {
      generated_at: result.generated_at,
      required_actor: actorPack.required_actor,
      approval_status: actorPack.approval_status,
      approval_request_count: actorPack.approval_request_count,
      required_approval_fields: actorPack.required_approval_fields,
      approval_requests: actorRequests,
    });
    await writeJson(path.join(actorDir, "approval-input.json"), {
      generated_at: result.generated_at,
      required_actor: actorPack.required_actor,
      approval_status: actorPack.approval_status,
      required_approval_fields: actorPack.required_approval_fields,
      approval_receipts: actorRequests.map((request) => request.approval_receipt_template),
    });
    await writeFile(path.join(actorDir, "README.md"), renderActorApprovalPackMarkdown(actorPack, actorRequests), "utf8");
  }
}

export async function runHumanReviewCycleReceiptCompletionProtectedApprovalRequestPackCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewCycleReceiptCompletionProtectedApprovalRequestPack(args);
    console.log(`Human review cycle receipt completion protected approval request pack written to ${result.output_dir}`);
    console.log(`Pack status: ${result.pack_status}`);
    console.log(`Approval requests: ${result.summary.approval_request_count}`);
    console.log(`Actor approval packs: ${result.summary.actor_approval_pack_count}`);
    console.log(`Pending explicit approvals: ${result.summary.pending_explicit_approval_count}`);
    console.log(`Command receipt mixed count: ${result.summary.command_receipt_mixed_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildApprovalRequests({ protectedResolutionPlans, outputDir }) {
  return protectedResolutionPlans.map((plan, index) => {
    const requestId = `human-review-cycle-receipt-completion-protected-approval-request-pack.request.${String(index + 1).padStart(2, "0")}.${slugify(plan.step_key ?? plan.command_gate_id)}`;
    const requiredActor = plan.required_actor ?? "authorized_operator";
    const targetApprovalInputPath = path.join(outputDir, "actors", requiredActor, "approval-input.json");
    return {
      approval_request_id: requestId,
      source_resolution_plan_id: plan.resolution_plan_id,
      source_held_command_id: plan.source_held_command_id ?? plan.source_refs?.held_command_id ?? null,
      source_reconciliation_item_id: plan.source_reconciliation_item_id ?? plan.source_refs?.reconciliation_item_id ?? null,
      required_actor: requiredActor,
      priority: plan.priority ?? "critical",
      approval_status: "pending_explicit_approval",
      approval_type: "explicit_human_approval",
      protected_action: true,
      requires_explicit_human_approval: true,
      separated_from_command_receipts: true,
      command_gate_id: plan.command_gate_id ?? null,
      runbook_step_id: plan.runbook_step_id ?? null,
      step_key: plan.step_key ?? "unknown",
      command_kind: plan.command_kind ?? "protected_application",
      command: plan.command ?? plan.follow_on_action?.command ?? "",
      unblock_condition: plan.unblock_condition ?? null,
      follow_on_action: plan.follow_on_action ?? null,
      expected_artifact: plan.follow_on_action?.expected_artifact ?? null,
      target_approval_input_path: targetApprovalInputPath,
      required_approval_fields: REQUIRED_APPROVAL_FIELDS,
      approval_receipt_template: buildApprovalReceiptTemplate({ requestId, plan }),
      source_refs: plan.source_refs ?? {},
      safe_handling: {
        auto_execute_allowed: false,
        approval_request_only: true,
        command_receipt_edits_allowed: false,
        commands_executed: false,
        protected_actions_executed: false,
      },
    };
  });
}

function buildApprovalReceiptTemplate({ requestId, plan }) {
  return {
    approval_receipt_id: `${requestId}.receipt`,
    approval_request_id: requestId,
    approval_status: "pending",
    decision: "pending",
    approved_by: "",
    approved_at: "",
    approval_scope: "protected_application",
    risk_acknowledgement: "",
    authorized_commands: [plan.command ?? plan.follow_on_action?.command].filter(Boolean),
    notes: "",
    source_resolution_plan_id: plan.resolution_plan_id,
    source_held_command_id: plan.source_held_command_id ?? plan.source_refs?.held_command_id ?? null,
    protected_action: true,
    safe_handling: {
      approval_receipt_template_only: true,
      commands_executed: false,
      protected_actions_executed: false,
    },
  };
}

function buildActorApprovalPacks({ approvalRequests, outputDir }) {
  return Object.entries(groupBy(approvalRequests, (request) => request.required_actor))
    .map(([requiredActor, requests]) => ({
      actor_approval_pack_id: `human-review-cycle-receipt-completion-protected-approval-request-pack.actor.${slugify(requiredActor)}`,
      required_actor: requiredActor,
      approval_status: "pending_explicit_approval",
      priority: highestPriority(requests),
      approval_request_count: requests.length,
      protected_action_count: requests.filter((request) => request.protected_action).length,
      target_approval_input_path: path.join(outputDir, "actors", requiredActor, "approval-input.json"),
      request_pack_path: path.join(outputDir, "actors", requiredActor, "protected-approval-request-pack.json"),
      readme_path: path.join(outputDir, "actors", requiredActor, "README.md"),
      approval_request_ids: requests.map((request) => request.approval_request_id),
      source_resolution_plan_ids: requests.map((request) => request.source_resolution_plan_id),
      command_gate_ids: unique(requests.map((request) => request.command_gate_id)),
      commands_requiring_approval: unique(requests.map((request) => request.command)),
      expected_artifacts: unique(requests.map((request) => request.expected_artifact)),
      required_approval_fields: REQUIRED_APPROVAL_FIELDS,
      safe_handling: {
        auto_execute_allowed: false,
        approval_request_pack_only: true,
        command_receipt_edits_allowed: false,
        commands_executed: false,
        protected_actions_executed: false,
      },
    }))
    .sort(compareActorPacks);
}

function validateProtectedApprovalRequestPack({ sources, heldCommandResolution, protectedResolutionPlans, nonProtectedResolutionPlans, approvalRequests, actorApprovalPacks }) {
  const errors = [];
  for (const source of sources) {
    if (!source.available) errors.push({ path: `sources.${source.source_id}`, message: `${source.label} unavailable: ${source.error}` });
  }
  if (heldCommandResolution?.validation && !heldCommandResolution.validation.valid) {
    errors.push({ path: "human_review_cycle_receipt_completion_held_command_resolution.validation", message: "Held command resolution source is not valid." });
  }
  if ((heldCommandResolution?.summary?.protected_resolution_count ?? protectedResolutionPlans.length) !== protectedResolutionPlans.length) {
    errors.push({ path: "approval_requests", message: "Approval request count must match held command protected resolution count." });
  }
  if (approvalRequests.length !== protectedResolutionPlans.length) {
    errors.push({ path: "approval_requests", message: "Every protected held command resolution must become one approval request." });
  }
  for (const request of approvalRequests) {
    if (!request.protected_action || !request.requires_explicit_human_approval) {
      errors.push({ path: `approval_requests.${request.approval_request_id}.protected_action`, message: "Protected approval requests must only contain explicit protected actions." });
    }
    if (request.approval_status !== "pending_explicit_approval") {
      errors.push({ path: `approval_requests.${request.approval_request_id}.approval_status`, message: "Protected approval requests must remain pending explicit approval." });
    }
    if (!request.required_actor) {
      errors.push({ path: `approval_requests.${request.approval_request_id}.required_actor`, message: "Protected approval request must include a required actor." });
    }
    if (!request.target_approval_input_path) {
      errors.push({ path: `approval_requests.${request.approval_request_id}.target_approval_input_path`, message: "Protected approval request must include a target approval input path." });
    }
    if (!request.command) {
      errors.push({ path: `approval_requests.${request.approval_request_id}.command`, message: "Protected approval request must include the protected command requiring approval." });
    }
    const missingFields = missingTemplateFields(request.approval_receipt_template, request.required_approval_fields);
    if (missingFields.length > 0) {
      errors.push({ path: `approval_requests.${request.approval_request_id}.approval_receipt_template`, message: `Approval receipt template is missing required field(s): ${missingFields.join(", ")}` });
    }
    if (request.safe_handling.auto_execute_allowed || request.safe_handling.commands_executed || request.safe_handling.protected_actions_executed) {
      errors.push({ path: `approval_requests.${request.approval_request_id}.safe_handling`, message: "Protected approval requests must not execute commands or protected actions." });
    }
  }
  for (const actorPack of actorApprovalPacks) {
    if (!actorPack.required_actor) {
      errors.push({ path: `actor_approval_packs.${actorPack.actor_approval_pack_id}.required_actor`, message: "Actor approval pack must include required actor." });
    }
    if (actorPack.approval_request_count !== actorPack.approval_request_ids.length) {
      errors.push({ path: `actor_approval_packs.${actorPack.actor_approval_pack_id}.approval_request_ids`, message: "Actor approval pack ids must cover each approval request." });
    }
    if (actorPack.protected_action_count !== actorPack.approval_request_count) {
      errors.push({ path: `actor_approval_packs.${actorPack.actor_approval_pack_id}.protected_action_count`, message: "Actor approval packs must only contain protected approval requests." });
    }
    if (!actorPack.target_approval_input_path || actorPack.required_approval_fields.length === 0) {
      errors.push({ path: `actor_approval_packs.${actorPack.actor_approval_pack_id}.target_approval_input_path`, message: "Actor approval pack must include target approval input path and required fields." });
    }
    if (actorPack.safe_handling.auto_execute_allowed || actorPack.safe_handling.commands_executed || actorPack.safe_handling.protected_actions_executed) {
      errors.push({ path: `actor_approval_packs.${actorPack.actor_approval_pack_id}.safe_handling`, message: "Actor approval packs must remain non-executing." });
    }
  }
  if (approvalRequests.some((request) => nonProtectedResolutionPlans.some((plan) => plan.resolution_plan_id === request.source_resolution_plan_id))) {
    errors.push({ path: "approval_requests", message: "Non-protected held command resolutions must not be mixed into protected approval requests." });
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function derivePackStatus(validation, approvalRequests) {
  if (!validation.valid) return "blocked";
  if (approvalRequests.length === 0) return "no_protected_approval_required";
  return "ready_for_explicit_approval";
}

function summarizeProtectedApprovalRequestPack({ heldCommandResolution, protectedResolutionPlans, nonProtectedResolutionPlans, approvalRequests, actorApprovalPacks, validation, packStatus }) {
  const missingTemplateFieldCount = approvalRequests.reduce((total, request) => total + missingTemplateFields(request.approval_receipt_template, request.required_approval_fields).length, 0);
  return {
    pack_status: packStatus,
    source_resolution_status: heldCommandResolution?.resolution_status ?? null,
    source_resolution_plan_count: heldCommandResolution?.summary?.resolution_plan_count ?? protectedResolutionPlans.length + nonProtectedResolutionPlans.length,
    source_protected_resolution_count: heldCommandResolution?.summary?.protected_resolution_count ?? protectedResolutionPlans.length,
    protected_resolution_count: protectedResolutionPlans.length,
    non_protected_resolution_count: nonProtectedResolutionPlans.length,
    approval_request_count: approvalRequests.length,
    actor_approval_pack_count: actorApprovalPacks.length,
    pending_explicit_approval_count: approvalRequests.filter((request) => request.approval_status === "pending_explicit_approval").length,
    protected_action_request_count: approvalRequests.filter((request) => request.protected_action).length,
    command_receipt_mixed_count: approvalRequests.filter((request) => !request.separated_from_command_receipts).length,
    non_protected_request_count: approvalRequests.filter((request) => !request.protected_action || !request.requires_explicit_human_approval).length,
    target_approval_input_path_count: actorApprovalPacks.filter((pack) => Boolean(pack.target_approval_input_path)).length,
    missing_target_approval_input_path_count: actorApprovalPacks.filter((pack) => !pack.target_approval_input_path).length,
    required_approval_field_count: REQUIRED_APPROVAL_FIELDS.length,
    missing_required_approval_field_count: missingTemplateFieldCount,
    validation_error_count: validation.errors.length,
    refresh_command_executed_by_harness_count: 0,
    protected_action_executed_count: 0,
    by_required_actor: countBy(approvalRequests, "required_actor"),
    by_approval_status: countBy(approvalRequests, "approval_status"),
    by_command_kind: countBy(approvalRequests, "command_kind"),
  };
}

function renderProtectedApprovalRequestPackMarkdown(pack) {
  const lines = [];
  lines.push("# Human Review Cycle Receipt Completion Protected Approval Request Pack");
  lines.push("");
  lines.push(`Generated: ${pack.generated_at}`);
  lines.push(`Pack status: ${pack.pack_status}`);
  lines.push("");
  lines.push(`- Approval requests: ${pack.summary.approval_request_count}`);
  lines.push(`- Actor approval packs: ${pack.summary.actor_approval_pack_count}`);
  lines.push(`- Pending explicit approvals: ${pack.summary.pending_explicit_approval_count}`);
  lines.push(`- Command receipt mixed count: ${pack.summary.command_receipt_mixed_count}`);
  lines.push(`- Missing required approval fields: ${pack.summary.missing_required_approval_field_count}`);
  lines.push("");
  lines.push("## Actor Approval Packs");
  lines.push("");
  for (const actorPack of pack.actor_approval_packs) {
    lines.push(`- ${actorPack.required_actor}: ${actorPack.approval_request_count} approval request(s), input ${actorPack.target_approval_input_path}`);
  }
  if (pack.actor_approval_packs.length === 0) lines.push("- No protected approval requests.");
  lines.push("");
  lines.push("## Protected Approval Requests");
  lines.push("");
  for (const request of pack.approval_requests) {
    lines.push(`- ${request.step_key}: ${request.approval_status}; ${request.command} (${request.required_actor})`);
  }
  return `${lines.join("\n")}\n`;
}

function renderActorApprovalPackMarkdown(actorPack, requests) {
  const lines = [];
  lines.push(`# Protected Approval Request Pack: ${actorPack.required_actor}`);
  lines.push("");
  lines.push(`Approval status: ${actorPack.approval_status}`);
  lines.push(`Approval requests: ${actorPack.approval_request_count}`);
  lines.push(`Target approval input: ${actorPack.target_approval_input_path}`);
  lines.push("");
  lines.push("Required approval fields:");
  for (const field of actorPack.required_approval_fields) lines.push(`- ${field}`);
  lines.push("");
  lines.push("Requests:");
  for (const request of requests) lines.push(`- ${request.step_key}: approve before running ${request.command}`);
  return `${lines.join("\n")}\n`;
}

function isProtectedApprovalResolution(plan) {
  return Boolean(plan?.requires_explicit_human_approval || plan?.follow_on_action?.protected_action || plan?.resolution_status === "waiting_for_explicit_human_approval");
}

function missingTemplateFields(template, fields) {
  return fields.filter((field) => !Object.prototype.hasOwnProperty.call(template ?? {}, field));
}

function buildSource(sourceId, label, sourcePath, result) {
  return {
    source_id: sourceId,
    label,
    path: sourcePath,
    available: result.ok,
    schema_version: result.value?.schema_version ?? null,
    generated_at: result.value?.generated_at ?? null,
    summary: result.value?.summary ?? null,
    error: result.ok ? null : result.error,
  };
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

function serializablePack(result) {
  const { markdown, ...artifact } = result;
  return artifact;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

function slugify(value) {
  return String(value ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
}

function unique(items) {
  return [...new Set(items.filter((item) => item !== undefined && item !== null && item !== ""))];
}

function countBy(items, field) {
  return items.reduce((counts, item) => {
    const key = item[field] ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function groupBy(items, selector) {
  return items.reduce((groups, item) => {
    const key = selector(item);
    groups[key] ??= [];
    groups[key].push(item);
    return groups;
  }, {});
}

function highestPriority(items) {
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...items].sort((left, right) => (order[left.priority] ?? 99) - (order[right.priority] ?? 99))[0]?.priority ?? "medium";
}

function compareActorPacks(left, right) {
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  return (order[left.priority] ?? 99) - (order[right.priority] ?? 99) || left.required_actor.localeCompare(right.required_actor);
}

function parseArgs(argv) {
  const parsed = {
    heldCommandResolutionPath: DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_PROTECTED_APPROVAL_REQUEST_PACK_INPUTS.heldCommandResolutionPath,
    outDir: DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_PROTECTED_APPROVAL_REQUEST_PACK_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--held-command-resolution") parsed.heldCommandResolutionPath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-cycle-receipt-completion-protected-approval-request-pack.mjs [options]

Options:
  --held-command-resolution <path>      held command resolution artifact path.
  --out-dir <path>                      output directory.
  --run-at <iso>                        fixed generated_at timestamp.
  --check                               fail when protected approval request pack validation has errors.
  --help                                show this help.
`);
}
