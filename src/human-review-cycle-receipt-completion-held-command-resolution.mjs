import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_HELD_COMMAND_RESOLUTION_OUT_DIR = "artifacts/human-review-cycle-receipt-completion-held-command-resolution/latest";
export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_HELD_COMMAND_RESOLUTION_INPUTS = {
  baselinePath: "artifacts/human-review-cycle-receipt-completion-baseline/latest/human-review-cycle-receipt-completion-baseline.json",
  manualCommandReceiptPackPath: "artifacts/human-review-cycle-receipt-completion-manual-command-receipt-pack/latest/human-review-cycle-receipt-completion-manual-command-receipt-pack.json",
  commandQueuePath: "artifacts/human-review-cycle-receipt-completion-command-queue/latest/human-review-cycle-receipt-completion-command-queue.json",
};

export async function runHumanReviewCycleReceiptCompletionHeldCommandResolution(options = {}) {
  const result = await buildHumanReviewCycleReceiptCompletionHeldCommandResolution(options);
  if (options.write !== false) await writeHumanReviewCycleReceiptCompletionHeldCommandResolution(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review cycle receipt completion held command resolution failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewCycleReceiptCompletionHeldCommandResolution(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_HELD_COMMAND_RESOLUTION_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const baselinePath = path.resolve(options.baselinePath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_HELD_COMMAND_RESOLUTION_INPUTS.baselinePath);
  const manualCommandReceiptPackPath = path.resolve(options.manualCommandReceiptPackPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_HELD_COMMAND_RESOLUTION_INPUTS.manualCommandReceiptPackPath);
  const commandQueuePath = path.resolve(options.commandQueuePath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_HELD_COMMAND_RESOLUTION_INPUTS.commandQueuePath);
  const baselineResult = await readJsonOrError(baselinePath);
  const manualPackResult = await readJsonOrError(manualCommandReceiptPackPath);
  const commandQueueResult = await readJsonOrError(commandQueuePath);
  const sources = [
    buildSource("human_review_cycle_receipt_completion_baseline", "Human Review Cycle Receipt Completion Baseline", baselinePath, baselineResult),
    buildSource("human_review_cycle_receipt_completion_manual_command_receipt_pack", "Human Review Cycle Receipt Completion Manual Command Receipt Pack", manualCommandReceiptPackPath, manualPackResult),
    buildSource("human_review_cycle_receipt_completion_command_queue", "Human Review Cycle Receipt Completion Command Queue", commandQueuePath, commandQueueResult),
  ];
  const heldCommandBlockers = (baselineResult.value?.blocker_inventory ?? []).filter((blocker) => blocker.blocker_type === "held_command");
  const manualPackNonReceiptBlockers = manualPackResult.value?.non_receipt_blockers ?? [];
  const heldCommandItems = commandQueueResult.value?.held_command_items ?? [];
  const resolutionPlans = buildResolutionPlans({
    heldCommandBlockers,
    manualPackNonReceiptBlockers,
    heldCommandItems,
  });
  const actorResolutionPlans = buildActorResolutionPlans({ resolutionPlans, outputDir });
  const validation = validateHeldCommandResolution({
    sources,
    baseline: baselineResult.value,
    manualPack: manualPackResult.value,
    commandQueue: commandQueueResult.value,
    heldCommandBlockers,
    manualPackNonReceiptBlockers,
    heldCommandItems,
    resolutionPlans,
    actorResolutionPlans,
  });
  const resolutionStatus = deriveResolutionStatus(validation, resolutionPlans);
  const resolution = {
    schema_version: "human-review-cycle-receipt-completion-held-command-resolution.v1",
    generated_at: generatedAt,
    resolution_id: `human-review-cycle-receipt-completion-held-command-resolution.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    resolution_status: resolutionStatus,
    safe_handling: {
      auto_execute_allowed: false,
      resolution_plan_only: true,
      source_artifact_mutation_allowed: false,
      commands_executed: false,
      protected_actions_executed: false,
    },
    sources,
    summary: summarizeResolution({
      baseline: baselineResult.value,
      manualPack: manualPackResult.value,
      commandQueue: commandQueueResult.value,
      heldCommandBlockers,
      manualPackNonReceiptBlockers,
      heldCommandItems,
      resolutionPlans,
      actorResolutionPlans,
      validation,
      resolutionStatus,
    }),
    resolution_plans: resolutionPlans,
    actor_resolution_plans: actorResolutionPlans,
    validation,
  };

  return {
    ...resolution,
    markdown: renderResolutionMarkdown(resolution),
  };
}

export async function writeHumanReviewCycleReceiptCompletionHeldCommandResolution(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-cycle-receipt-completion-held-command-resolution.json"), serializableResolution(result));
  await writeJson(path.join(outDir, "resolution-plans.json"), {
    generated_at: result.generated_at,
    count: result.resolution_plans.length,
    resolution_plans: result.resolution_plans,
  });
  await writeJson(path.join(outDir, "actor-resolution-plans.json"), {
    generated_at: result.generated_at,
    count: result.actor_resolution_plans.length,
    actor_resolution_plans: result.actor_resolution_plans,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  for (const actorPlan of result.actor_resolution_plans) {
    const actorDir = path.join(outDir, "actors", actorPlan.required_actor);
    const plans = result.resolution_plans.filter((plan) => plan.required_actor === actorPlan.required_actor);
    await mkdir(actorDir, { recursive: true });
    await writeJson(path.join(actorDir, "held-command-resolution-plan.json"), {
      generated_at: result.generated_at,
      required_actor: actorPlan.required_actor,
      resolution_status: actorPlan.resolution_status,
      held_command_count: actorPlan.held_command_count,
      protected_held_command_count: actorPlan.protected_held_command_count,
      manual_input_held_command_count: actorPlan.manual_input_held_command_count,
      resolution_plans: plans,
    });
    await writeFile(path.join(actorDir, "README.md"), renderActorResolutionMarkdown(actorPlan, plans), "utf8");
  }
}

export async function runHumanReviewCycleReceiptCompletionHeldCommandResolutionCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewCycleReceiptCompletionHeldCommandResolution(args);
    console.log(`Human review cycle receipt completion held command resolution written to ${result.output_dir}`);
    console.log(`Resolution status: ${result.resolution_status}`);
    console.log(`Resolution plans: ${result.summary.resolution_plan_count}`);
    console.log(`Actor plans: ${result.summary.actor_resolution_plan_count}`);
    console.log(`Protected resolutions: ${result.summary.protected_resolution_count}`);
    console.log(`Missing unblock conditions: ${result.summary.missing_unblock_condition_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildResolutionPlans({ heldCommandBlockers, manualPackNonReceiptBlockers, heldCommandItems }) {
  const manualPackBlockersBySource = new Map(manualPackNonReceiptBlockers.map((blocker) => [blocker.source_reconciliation_item_id, blocker]));
  const heldItemsById = new Map(heldCommandItems.map((item) => [item.held_command_id, item]));
  const heldItemsByCommandGate = new Map(heldCommandItems.map((item) => [item.command_gate_id, item]));
  return heldCommandBlockers.map((blocker, index) => {
    const manualPackBlocker = manualPackBlockersBySource.get(blocker.source_reconciliation_item_id);
    const heldItem = heldItemsById.get(blocker.source_ref) ?? heldItemsByCommandGate.get(blocker.command_gate_id);
    const requiresExplicitApproval = Boolean(blocker.protected_hold || heldItem?.requires_explicit_human_approval);
    const commandKind = blocker.command_kind ?? heldItem?.command_kind ?? "unknown";
    const stepKey = blocker.step_key ?? heldItem?.step_key ?? "unknown";
    const unblockCondition = buildUnblockCondition({ blocker, heldItem, commandKind, stepKey, requiresExplicitApproval });
    const followOnAction = buildFollowOnAction({ blocker, heldItem, commandKind, stepKey, requiresExplicitApproval });
    return {
      resolution_plan_id: `human-review-cycle-receipt-completion-held-command-resolution.plan.${String(index + 1).padStart(2, "0")}.${slugify(blocker.command_gate_id ?? stepKey)}`,
      blocker_id: blocker.blocker_id,
      source_reconciliation_item_id: blocker.source_reconciliation_item_id,
      source_manual_pack_blocker_id: manualPackBlocker?.blocker_id ?? null,
      source_held_command_id: heldItem?.held_command_id ?? blocker.source_ref ?? null,
      required_actor: blocker.required_actor ?? (requiresExplicitApproval ? "authorized_operator" : "human_reviewer"),
      priority: blocker.priority ?? heldItem?.priority ?? (requiresExplicitApproval ? "critical" : "high"),
      resolution_status: requiresExplicitApproval ? "waiting_for_explicit_human_approval" : "waiting_for_manual_input",
      blocker_status: blocker.blocker_status ?? null,
      hold_status: heldItem?.hold_status ?? (requiresExplicitApproval ? "requires_explicit_human_approval" : "held_until_manual_input"),
      queue_item_id: blocker.queue_item_id ?? null,
      command_gate_id: blocker.command_gate_id ?? heldItem?.command_gate_id ?? null,
      runbook_step_id: blocker.runbook_step_id ?? heldItem?.runbook_step_id ?? null,
      step_key: stepKey,
      command_kind: commandKind,
      command: blocker.command ?? heldItem?.command ?? "",
      requires_explicit_human_approval: requiresExplicitApproval,
      unblock_condition: unblockCondition,
      follow_on_action: followOnAction,
      source_refs: {
        baseline_blocker_id: blocker.blocker_id,
        reconciliation_item_id: blocker.source_reconciliation_item_id,
        manual_pack_blocker_id: manualPackBlocker?.blocker_id ?? null,
        held_command_id: heldItem?.held_command_id ?? blocker.source_ref ?? null,
        command_gate_id: blocker.command_gate_id ?? heldItem?.command_gate_id ?? null,
      },
      safe_handling: {
        auto_execute_allowed: false,
        resolution_plan_only: true,
        commands_executed: false,
        protected_actions_executed: false,
      },
    };
  });
}

function buildActorResolutionPlans({ resolutionPlans, outputDir }) {
  return Object.entries(groupBy(resolutionPlans, (plan) => plan.required_actor))
    .map(([requiredActor, plans]) => ({
      actor_resolution_plan_id: `human-review-cycle-receipt-completion-held-command-resolution.actor.${slugify(requiredActor)}`,
      required_actor: requiredActor,
      resolution_status: plans.some((plan) => plan.requires_explicit_human_approval) ? "waiting_for_explicit_human_approval" : "waiting_for_manual_input",
      priority: highestPriority(plans),
      held_command_count: plans.length,
      protected_held_command_count: plans.filter((plan) => plan.requires_explicit_human_approval).length,
      manual_input_held_command_count: plans.filter((plan) => !plan.requires_explicit_human_approval).length,
      plan_path: path.join(outputDir, "actors", requiredActor, "held-command-resolution-plan.json"),
      readme_path: path.join(outputDir, "actors", requiredActor, "README.md"),
      resolution_plan_ids: plans.map((plan) => plan.resolution_plan_id),
      command_gate_ids: unique(plans.map((plan) => plan.command_gate_id)),
      unblock_conditions: plans.map((plan) => plan.unblock_condition),
      follow_on_actions: plans.map((plan) => plan.follow_on_action),
      commands_to_run_after_unblocked: plans.map((plan) => plan.follow_on_action.command).filter(Boolean),
      safe_handling: {
        auto_execute_allowed: false,
        resolution_plan_only: true,
        commands_executed: false,
        protected_actions_executed: false,
      },
    }))
    .sort(compareActorPlans);
}

function buildUnblockCondition({ commandKind, stepKey, requiresExplicitApproval }) {
  if (requiresExplicitApproval) {
    return condition("explicit_human_approval_recorded", "explicit_human_approval", "An authorized operator must record explicit approval before protected application can be run.", "approval_receipt", "human_review_decision_register_or_equivalent");
  }
  if (commandKind === "post_input_merge" || stepKey === "rerun_correction_merge") {
    return condition("manual_command_receipts_saved", "manual_receipt_input", "Manual command receipt input must be completed in the actor receipt input file.", "completed_receipt_input", "human_review_cycle_receipt_completion_manual_command_receipt_pack");
  }
  if (commandKind === "post_input_validation" || stepKey === "rerun_correction_validation") {
    return condition("manual_receipt_workspace_merge_completed", "manual_receipt_merge", "Manual command receipt input must be merged before validation can be rerun.", "merged_receipt_input", "human_review_cycle_receipt_completion_command_receipt_workspace_merge");
  }
  if (commandKind === "post_input_field_audit" || stepKey === "rerun_receipt_field_audit") {
    return condition("manual_receipt_validation_completed", "manual_receipt_validation", "Manual command receipt workspace validation must be completed before field audit refresh.", "validated_command_receipts", "human_review_cycle_receipt_completion_command_receipt_workspace_validation");
  }
  return condition("manual_input_completed", "manual_input", "The required manual input must be completed before this held command can run.", "manual_input", "human_review_cycle_receipt_completion_readiness");
}

function buildFollowOnAction({ blocker, heldItem, commandKind, stepKey, requiresExplicitApproval }) {
  const command = blocker.command ?? heldItem?.command ?? "";
  const actionId = requiresExplicitApproval ? "run_protected_application_after_approval" : `run_${slugify(commandKind || stepKey)}_after_unblocked`;
  return {
    action_id: actionId,
    action_type: requiresExplicitApproval ? "protected_application_after_approval" : "manual_refresh_after_unblock",
    description: requiresExplicitApproval
      ? "After explicit approval is recorded, run the protected application command manually and capture its receipt."
      : "After the unblock condition is satisfied, run the held command manually and capture the resulting receipt or refreshed artifact.",
    command,
    allowed_after: requiresExplicitApproval ? "explicit_human_approval_recorded" : "unblock_condition_satisfied",
    expected_artifact: expectedArtifactForCommand(commandKind, stepKey),
    manual_only: true,
    protected_action: requiresExplicitApproval,
  };
}

function condition(conditionId, conditionType, description, requiredInput, sourceStage) {
  return {
    condition_id: conditionId,
    condition_type: conditionType,
    description,
    required_input: requiredInput,
    source_stage: sourceStage,
  };
}

function expectedArtifactForCommand(commandKind, stepKey) {
  const key = commandKind || stepKey;
  const expected = {
    post_input_merge: "artifacts/human-review-cycle-receipt-completion-command-receipt-workspace-merge/latest/receipt-input.json",
    post_input_validation: "artifacts/human-review-cycle-receipt-completion-command-receipt-workspace-validation/latest/human-review-cycle-receipt-completion-command-receipt-validation.json",
    post_input_field_audit: "artifacts/human-review-cycle-receipt-field-audit/latest/human-review-cycle-receipt-field-audit.json",
    protected_application: "artifacts/control-plane-human-gate-receipt-application/latest/control-plane-human-gate-receipt-application.json",
    rerun_correction_merge: "artifacts/human-review-cycle-receipt-completion-command-receipt-workspace-merge/latest/receipt-input.json",
    rerun_correction_validation: "artifacts/human-review-cycle-receipt-completion-command-receipt-workspace-validation/latest/human-review-cycle-receipt-completion-command-receipt-validation.json",
    rerun_receipt_field_audit: "artifacts/human-review-cycle-receipt-field-audit/latest/human-review-cycle-receipt-field-audit.json",
    apply_human_gate_receipts_after_explicit_approval: "artifacts/control-plane-human-gate-receipt-application/latest/control-plane-human-gate-receipt-application.json",
  };
  return expected[key] ?? null;
}

function validateHeldCommandResolution({ sources, baseline, manualPack, commandQueue, heldCommandBlockers, manualPackNonReceiptBlockers, heldCommandItems, resolutionPlans, actorResolutionPlans }) {
  const errors = [];
  for (const source of sources) {
    if (!source.available) errors.push({ path: `sources.${source.source_id}`, message: `${source.label} unavailable: ${source.error}` });
  }
  if (baseline?.validation && !baseline.validation.valid) {
    errors.push({ path: "human_review_cycle_receipt_completion_baseline.validation", message: "Baseline source is not valid." });
  }
  if (manualPack?.validation && !manualPack.validation.valid) {
    errors.push({ path: "human_review_cycle_receipt_completion_manual_command_receipt_pack.validation", message: "Manual command receipt pack source is not valid." });
  }
  if (commandQueue?.validation && !commandQueue.validation.valid) {
    errors.push({ path: "human_review_cycle_receipt_completion_command_queue.validation", message: "Command queue source is not valid." });
  }
  if ((baseline?.summary?.held_command_count ?? 0) !== resolutionPlans.length) {
    errors.push({ path: "resolution_plans", message: "Resolution plan count must match baseline held command count." });
  }
  if (heldCommandBlockers.length !== resolutionPlans.length) {
    errors.push({ path: "blocker_inventory.held_command", message: "Every held command blocker must have one resolution plan." });
  }
  if ((manualPack?.summary?.non_receipt_blocker_count ?? manualPackNonReceiptBlockers.length) !== resolutionPlans.length) {
    errors.push({ path: "manual_command_receipt_pack.non_receipt_blockers", message: "Manual command receipt pack non-receipt blocker count must match resolution plans." });
  }
  if ((commandQueue?.summary?.held_command_item_count ?? heldCommandItems.length) !== resolutionPlans.length) {
    errors.push({ path: "command_queue.held_command_items", message: "Command queue held item count must match resolution plans." });
  }
  for (const plan of resolutionPlans) {
    if (!plan.required_actor) {
      errors.push({ path: `resolution_plans.${plan.resolution_plan_id}.required_actor`, message: "Held command resolution plan must include required actor." });
    }
    if (!plan.unblock_condition?.condition_id || !plan.unblock_condition?.description) {
      errors.push({ path: `resolution_plans.${plan.resolution_plan_id}.unblock_condition`, message: "Held command resolution plan must include an unblock condition." });
    }
    if (!plan.follow_on_action?.action_id || !plan.follow_on_action?.command) {
      errors.push({ path: `resolution_plans.${plan.resolution_plan_id}.follow_on_action`, message: "Held command resolution plan must include a follow-on action and command." });
    }
    if (plan.requires_explicit_human_approval && plan.unblock_condition.condition_type !== "explicit_human_approval") {
      errors.push({ path: `resolution_plans.${plan.resolution_plan_id}.unblock_condition.condition_type`, message: "Protected held commands require explicit human approval as the unblock condition." });
    }
    if (plan.safe_handling.auto_execute_allowed || plan.safe_handling.commands_executed || plan.safe_handling.protected_actions_executed) {
      errors.push({ path: `resolution_plans.${plan.resolution_plan_id}.safe_handling`, message: "Resolution plans must not execute commands or protected actions." });
    }
  }
  for (const actorPlan of actorResolutionPlans) {
    if (!actorPlan.required_actor) {
      errors.push({ path: `actor_resolution_plans.${actorPlan.actor_resolution_plan_id}.required_actor`, message: "Actor resolution plan must include required actor." });
    }
    if (actorPlan.held_command_count !== actorPlan.resolution_plan_ids.length) {
      errors.push({ path: `actor_resolution_plans.${actorPlan.actor_resolution_plan_id}.resolution_plan_ids`, message: "Actor resolution plan ids must cover each held command." });
    }
    if (actorPlan.safe_handling.auto_execute_allowed || actorPlan.safe_handling.commands_executed || actorPlan.safe_handling.protected_actions_executed) {
      errors.push({ path: `actor_resolution_plans.${actorPlan.actor_resolution_plan_id}.safe_handling`, message: "Actor resolution plans must remain non-executing." });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function deriveResolutionStatus(validation, resolutionPlans) {
  if (!validation.valid) return "blocked";
  if (resolutionPlans.length === 0) return "no_held_commands";
  return "ready_for_actor_resolution";
}

function summarizeResolution({ baseline, manualPack, commandQueue, heldCommandBlockers, manualPackNonReceiptBlockers, heldCommandItems, resolutionPlans, actorResolutionPlans, validation, resolutionStatus }) {
  return {
    resolution_status: resolutionStatus,
    source_baseline_status: baseline?.baseline_status ?? null,
    source_pack_status: manualPack?.pack_status ?? null,
    source_queue_status: commandQueue?.queue_status ?? null,
    resolution_plan_count: resolutionPlans.length,
    held_command_blocker_count: heldCommandBlockers.length,
    source_held_command_count: baseline?.summary?.held_command_count ?? heldCommandBlockers.length,
    manual_pack_non_receipt_blocker_count: manualPackNonReceiptBlockers.length,
    command_queue_held_item_count: heldCommandItems.length,
    protected_resolution_count: resolutionPlans.filter((plan) => plan.requires_explicit_human_approval).length,
    manual_input_resolution_count: resolutionPlans.filter((plan) => !plan.requires_explicit_human_approval).length,
    actor_resolution_plan_count: actorResolutionPlans.length,
    unblock_condition_count: resolutionPlans.filter((plan) => Boolean(plan.unblock_condition?.condition_id)).length,
    follow_on_action_count: resolutionPlans.filter((plan) => Boolean(plan.follow_on_action?.action_id)).length,
    missing_required_actor_count: resolutionPlans.filter((plan) => !plan.required_actor).length,
    missing_unblock_condition_count: resolutionPlans.filter((plan) => !plan.unblock_condition?.condition_id || !plan.unblock_condition?.description).length,
    missing_follow_on_action_count: resolutionPlans.filter((plan) => !plan.follow_on_action?.action_id || !plan.follow_on_action?.command).length,
    validation_error_count: validation.errors.length,
    refresh_command_executed_by_harness_count: 0,
    protected_action_executed_count: 0,
    by_required_actor: countBy(resolutionPlans, "required_actor"),
    by_resolution_status: countBy(resolutionPlans, "resolution_status"),
    by_command_kind: countBy(resolutionPlans, "command_kind"),
  };
}

function renderResolutionMarkdown(resolution) {
  const lines = [];
  lines.push("# Human Review Cycle Receipt Completion Held Command Resolution");
  lines.push("");
  lines.push(`Generated: ${resolution.generated_at}`);
  lines.push(`Resolution status: ${resolution.resolution_status}`);
  lines.push("");
  lines.push(`- Resolution plans: ${resolution.summary.resolution_plan_count}`);
  lines.push(`- Actor plans: ${resolution.summary.actor_resolution_plan_count}`);
  lines.push(`- Manual input resolutions: ${resolution.summary.manual_input_resolution_count}`);
  lines.push(`- Protected approval resolutions: ${resolution.summary.protected_resolution_count}`);
  lines.push(`- Missing unblock conditions: ${resolution.summary.missing_unblock_condition_count}`);
  lines.push(`- Missing follow-on actions: ${resolution.summary.missing_follow_on_action_count}`);
  lines.push("");
  lines.push("## Actor Resolution Plans");
  lines.push("");
  for (const actorPlan of resolution.actor_resolution_plans) {
    lines.push(`- ${actorPlan.required_actor}: ${actorPlan.held_command_count} held command(s), ${actorPlan.protected_held_command_count} protected.`);
  }
  if (resolution.actor_resolution_plans.length === 0) lines.push("- No held command actor resolution plans.");
  lines.push("");
  lines.push("## Held Commands");
  lines.push("");
  for (const plan of resolution.resolution_plans) {
    lines.push(`- ${plan.step_key}: ${plan.unblock_condition.condition_id} -> ${plan.follow_on_action.command} (${plan.required_actor})`);
  }
  return `${lines.join("\n")}\n`;
}

function renderActorResolutionMarkdown(actorPlan, plans) {
  const lines = [];
  lines.push(`# Held Command Resolution Plan: ${actorPlan.required_actor}`);
  lines.push("");
  lines.push(`Resolution status: ${actorPlan.resolution_status}`);
  lines.push(`Held commands: ${actorPlan.held_command_count}`);
  lines.push(`Protected held commands: ${actorPlan.protected_held_command_count}`);
  lines.push("");
  lines.push("Resolution steps:");
  for (const plan of plans) {
    lines.push(`- ${plan.step_key}: unblock via ${plan.unblock_condition.condition_id}; then ${plan.follow_on_action.command}`);
  }
  return `${lines.join("\n")}\n`;
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

function serializableResolution(result) {
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

function compareActorPlans(left, right) {
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  return (order[left.priority] ?? 99) - (order[right.priority] ?? 99) || left.required_actor.localeCompare(right.required_actor);
}

function parseArgs(argv) {
  const parsed = {
    baselinePath: DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_HELD_COMMAND_RESOLUTION_INPUTS.baselinePath,
    manualCommandReceiptPackPath: DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_HELD_COMMAND_RESOLUTION_INPUTS.manualCommandReceiptPackPath,
    commandQueuePath: DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_HELD_COMMAND_RESOLUTION_INPUTS.commandQueuePath,
    outDir: DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_HELD_COMMAND_RESOLUTION_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--baseline") parsed.baselinePath = argv[++index];
    else if (arg === "--manual-command-receipt-pack") parsed.manualCommandReceiptPackPath = argv[++index];
    else if (arg === "--command-queue") parsed.commandQueuePath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-cycle-receipt-completion-held-command-resolution.mjs [options]

Options:
  --baseline <path>                     receipt completion baseline artifact path.
  --manual-command-receipt-pack <path>  manual command receipt pack artifact path.
  --command-queue <path>                command queue artifact path.
  --out-dir <path>                      output directory.
  --run-at <iso>                        fixed generated_at timestamp.
  --check                               fail when held command resolution validation has errors.
  --help                                show this help.
`);
}
