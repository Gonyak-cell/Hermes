import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_RELEASE_NOTE_ARTIFACT_OUT_DIR = "artifacts/release-note-artifact/latest";
export const DEFAULT_RELEASE_NOTE_ARTIFACT_INPUTS = {
  repoRoot: ".",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  prDraftArtifactPath: "artifacts/pr-draft-artifact/latest/pr-draft-artifact.json",
  canonicalTestMatrixPath: "artifacts/canonical-test-matrix/latest/canonical-test-matrix.json",
  devProtectedScanPath: "artifacts/dev-protected-scan/latest/dev-protected-scan.json",
};

const CONTRACT_ID = "release-note-artifact.v1";
const PACK_ID = "personal-dev";
const CAPABILITY_ID = "personal_dev.codex.worktree_patch";
const NOTE_AUTHORITY = "harness_control_plane";
const SOURCE_OF_TRUTH = "validated_pr_draft_test_protected_scan_and_human_gated_merge_candidate";
const DESKTOP_SURFACE_POLICY = "read_only_release_note_review_surface";
const REQUIRED_SECTION_TYPES = ["highlights", "changes", "tests", "risks", "rollback", "human_review"];

export async function runReleaseNoteArtifact(options = {}) {
  const result = await buildReleaseNoteArtifact(options);
  if (options.write !== false) await writeReleaseNoteArtifact(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Release note artifact validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildReleaseNoteArtifact(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RELEASE_NOTE_ARTIFACT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const repoRoot = path.resolve(inputs.repo_root);
  const packageJson = await readJsonOrError(path.resolve(repoRoot, inputs.package_path));
  const roadmapText = await readTextOrError(path.resolve(repoRoot, inputs.roadmap_path));
  const prDraftArtifact = await readJsonOrError(inputs.pr_draft_artifact_path);
  const canonicalTestMatrix = await readJsonOrError(inputs.canonical_test_matrix_path);
  const devProtectedScan = await readJsonOrError(inputs.dev_protected_scan_path);
  const prDraft = prDraftArtifact.value ?? {};
  const canonicalMatrix = canonicalTestMatrix.value ?? {};
  const protectedScan = devProtectedScan.value ?? {};
  const changeRecords = buildChangeRecords({ prDraft, generatedAt });
  const sections = buildReleaseNoteSections({ prDraft, canonicalMatrix, protectedScan, changeRecords, generatedAt });
  const markdown = renderReleaseNoteMarkdown({ sections, generatedAt });
  const outputArtifacts = buildOutputArtifacts({ prDraft, markdown, generatedAt });
  const gateBindings = buildGateBindings({ prDraft, canonicalMatrix, protectedScan, outputArtifacts, generatedAt });
  const desktopBoundary = buildDesktopBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    prDraftArtifact: prDraft,
    prDraftArtifactError: prDraftArtifact.error,
    canonicalTestMatrix: canonicalMatrix,
    canonicalTestMatrixError: canonicalTestMatrix.error,
    devProtectedScan: protectedScan,
    devProtectedScanError: devProtectedScan.error,
    changeRecords,
    sections,
    outputArtifacts,
    gateBindings,
    desktopBoundary,
  });
  const validationItems = checkpoints.map(({ checkpoint_id: checkpointId, status, message, ...rest }) => ({
    path: checkpointId,
    checkpoint_id: checkpointId,
    check_id: checkpointId,
    status,
    message,
    ...rest,
  }));
  const validation = summarizeValidation(validationItems);
  const summary = summarizeReleaseNoteArtifact({
    prDraftArtifact: prDraft,
    canonicalTestMatrix: canonicalMatrix,
    devProtectedScan: protectedScan,
    changeRecords,
    sections,
    outputArtifacts,
    gateBindings,
    desktopBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    release_note_artifact_id: `release-note-artifact.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    release_note_artifact_status: summary.release_note_artifact_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts({ packageJson, roadmapText, prDraftArtifact, canonicalTestMatrix, devProtectedScan }),
    release_note_contract: buildContract(generatedAt),
    source_pr_draft_artifact: buildSourcePrDraftArtifact(prDraft),
    source_canonical_test_matrix: buildSourceCanonicalTestMatrix(canonicalMatrix),
    source_dev_protected_scan: buildSourceDevProtectedScan(protectedScan),
    release_note_output_artifacts: outputArtifacts,
    release_note_change_records: changeRecords,
    release_note_sections: sections,
    release_note_gate_bindings: gateBindings,
    release_note_desktop_boundary: desktopBoundary,
    release_note_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown,
    summary_markdown: renderSummaryMarkdown(result),
  };
}

export async function writeReleaseNoteArtifact(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableReleaseNoteArtifact(result);
  await writeJson(path.join(outDir, "release-note-artifact.json"), serializable);
  await writeFile(path.join(outDir, "release-note.md"), result.markdown, "utf8");
  await writeJson(path.join(outDir, "release-note-output-artifacts.json"), {
    schema_version: "release-note-output-artifacts.v1",
    generated_at: result.generated_at,
    release_note_output_artifact_count: result.release_note_output_artifacts.length,
    release_note_output_artifacts: result.release_note_output_artifacts,
  });
  await writeJson(path.join(outDir, "release-note-change-records.json"), {
    schema_version: "release-note-change-records.v1",
    generated_at: result.generated_at,
    release_note_change_record_count: result.release_note_change_records.length,
    release_note_change_records: result.release_note_change_records,
  });
  await writeJson(path.join(outDir, "release-note-sections.json"), {
    schema_version: "release-note-sections.v1",
    generated_at: result.generated_at,
    release_note_section_count: result.release_note_sections.length,
    release_note_sections: result.release_note_sections,
  });
  await writeJson(path.join(outDir, "release-note-gate-bindings.json"), {
    schema_version: "release-note-gate-bindings.v1",
    generated_at: result.generated_at,
    release_note_gate_binding_count: result.release_note_gate_bindings.length,
    release_note_gate_bindings: result.release_note_gate_bindings,
  });
  await writeJson(path.join(outDir, "release-note-desktop-boundary.json"), {
    schema_version: "release-note-desktop-boundary-artifact.v1",
    generated_at: result.generated_at,
    release_note_desktop_boundary: result.release_note_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "release-note-validation-report.v1",
    generated_at: result.generated_at,
    release_note_artifact_id: result.release_note_artifact_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.summary_markdown, "utf8");
}

export async function runReleaseNoteArtifactCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runReleaseNoteArtifact(args);
    console.log(`Release note artifact ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.release_note_artifact_status}`);
    console.log(`Output artifacts: ${result.summary.release_note_output_artifact_count}`);
    console.log(`Sections: ${result.summary.release_note_section_count}`);
    console.log(`Change records: ${result.summary.release_note_change_record_count}`);
    console.log(`Gate bindings: ${result.summary.release_note_gate_binding_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildContract(generatedAt) {
  return {
    schema_version: "release-note-contract-definition.v1",
    contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    note_authority: NOTE_AUTHORITY,
    source_of_truth: SOURCE_OF_TRUTH,
    merged_change_basis_rule: "release_note_is_drafted_from_validated_pr_draft_as_a_human_gated_merge_candidate_not_an_executed_merge",
    section_rule: "highlights_changes_tests_risks_rollback_and_human_review_sections_are_required",
    output_artifact_rule: "release_note_markdown_is_stored_as_draft_output_artifact_with_content_hash",
    execution_rule: "release_note_generation_does_not_merge_release_push_call_github_apply_patches_or_mutate_files_outside_the_artifact_directory",
    desktop_companion_rule: "desktop_companion_reads_release_note_sections_change_records_gate_bindings_and_validation_only",
    human_review_rule: "final_release_notes_merge_release_and_client_facing_publication_remain_human_gated",
    created_at: generatedAt,
  };
}

function buildSafeHandling() {
  return {
    legal_advice: "not_provided",
    client_facing_output: "not_generated",
    human_review_required: true,
    release_note_artifact_generated: true,
    release_note_publication_performed: false,
    merge_performed: false,
    release_performed: false,
    github_api_called: false,
    branch_push_performed: false,
    command_execution_performed: false,
    patch_application_performed: false,
    git_command_executed: false,
    filesystem_mutation_performed_outside_artifact_dir: false,
    external_agent_invocation_performed: false,
    protected_mutation_performed: false,
    raw_secret_material_exposed: false,
    provider_key_exposed: false,
  };
}

function buildSourcePrDraftArtifact(artifact) {
  return {
    schema_version: "source-pr-draft-artifact-for-release-note.v1",
    pr_draft_artifact_id: artifact.pr_draft_artifact_id ?? null,
    pr_draft_artifact_status: artifact.summary?.pr_draft_artifact_status ?? artifact.pr_draft_artifact_status ?? "unknown",
    output_artifact_count: artifact.summary?.pr_draft_output_artifact_count ?? artifact.pr_draft_output_artifacts?.length ?? 0,
    section_count: artifact.summary?.pr_draft_section_count ?? artifact.pr_draft_sections?.length ?? 0,
    test_evidence_count: artifact.summary?.test_evidence_count ?? artifact.pr_draft_test_evidence?.length ?? 0,
    passed_test_evidence_count: artifact.summary?.passed_test_evidence_count ?? 0,
    risk_count: artifact.summary?.risk_count ?? artifact.pr_draft_risks?.length ?? 0,
    rollback_step_count: artifact.summary?.rollback_step_count ?? artifact.pr_draft_rollback_plan?.length ?? 0,
    merge_performed: artifact.summary?.merge_performed ?? false,
    release_performed: artifact.summary?.release_performed ?? false,
    validation_error_count: artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0,
    source_hash: hashObject(artifact),
  };
}

function buildSourceCanonicalTestMatrix(artifact) {
  return {
    schema_version: "source-canonical-test-matrix-for-release-note.v1",
    canonical_test_matrix_id: artifact.canonical_test_matrix_id ?? null,
    canonical_test_matrix_status: artifact.summary?.canonical_test_matrix_status ?? artifact.canonical_test_matrix_status ?? "unknown",
    required_dimension_count: artifact.summary?.required_dimension_count ?? 0,
    passed_required_dimension_count: artifact.summary?.passed_required_dimension_count ?? 0,
    failed_dimension_count: artifact.summary?.failed_dimension_count ?? 0,
    validation_error_count: artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0,
    source_hash: hashObject(artifact),
  };
}

function buildSourceDevProtectedScan(artifact) {
  return {
    schema_version: "source-dev-protected-scan-for-release-note.v1",
    dev_protected_scan_id: artifact.dev_protected_scan_id ?? null,
    dev_protected_scan_status: artifact.summary?.dev_protected_scan_status ?? artifact.dev_protected_scan_status ?? "unknown",
    protected_candidate_count: artifact.summary?.protected_candidate_count ?? 0,
    blocked_before_approval_count: artifact.summary?.blocked_before_approval_count ?? 0,
    raw_secret_material_exposed: artifact.summary?.raw_secret_material_exposed ?? false,
    provider_key_exposed: artifact.summary?.provider_key_exposed ?? false,
    validation_error_count: artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0,
    source_hash: hashObject(artifact),
  };
}

function buildChangeRecords({ prDraft, generatedAt }) {
  const outputArtifact = prDraft.pr_draft_output_artifacts?.[0] ?? {};
  const summarySection = prDraft.pr_draft_sections?.find((section) => section.section_type === "summary");
  return [{
    schema_version: "release-note-change-record.v1",
    release_note_change_record_id: "release-note-change.personal-dev.p226",
    generated_at: generatedAt,
    change_record_status: "draft_from_human_gated_merge_candidate",
    merged_change_basis: "validated_pr_draft_pending_human_merge_approval",
    merge_performed: false,
    release_performed: false,
    source_pr_draft_output_artifact_id: outputArtifact.output_artifact_id ?? null,
    source_pr_draft_content_hash: outputArtifact.content_hash ?? null,
    source_summary_lines: summarySection?.content_lines ?? [],
    change_summary: "Validated personal-dev PR draft candidate with summary, tests, risks, and rollback prepared for human review.",
    human_review_required: true,
    change_hash: hashObject({ outputArtifact, summarySection }),
  }];
}

function buildReleaseNoteSections({ prDraft, canonicalMatrix, protectedScan, changeRecords, generatedAt }) {
  const prSections = new Map((prDraft.pr_draft_sections ?? []).map((section) => [section.section_type, section]));
  const tests = prDraft.pr_draft_test_evidence ?? [];
  const risks = prDraft.pr_draft_risks ?? [];
  const rollback = prDraft.pr_draft_rollback_plan ?? [];
  return [
    section("highlights", "Highlights", changeRecords.map((record) => record.change_summary), generatedAt),
    section("changes", "Changes", prSections.get("summary")?.content_lines ?? ["Validated PR draft change candidate."], generatedAt),
    section("tests", "Tests", tests.map((test) => `${test.test_dimension}: ${test.test_evidence_status}`), generatedAt),
    section("risks", "Risks", risks.map((risk) => `${risk.risk_key}: ${risk.risk_summary}`), generatedAt),
    section("rollback", "Rollback", rollback.map((step) => step.instruction), generatedAt),
    section("human_review", "Human Review", [
      `Merge performed: false`,
      `Release performed: false`,
      `Required tests passed: ${canonicalMatrix.summary?.passed_required_dimension_count ?? 0}/${canonicalMatrix.summary?.required_dimension_count ?? 0}`,
      `Protected candidates blocked before approval: ${protectedScan.summary?.blocked_before_approval_count ?? 0}`,
      "Final release note publication remains blocked until explicit human approval.",
    ], generatedAt),
  ];
}

function section(sectionType, title, contentLines, generatedAt) {
  return {
    schema_version: "release-note-section.v1",
    release_note_section_id: `release-note-section.${sectionType}`,
    generated_at: generatedAt,
    section_type: sectionType,
    section_status: "draft_ready_for_human_review",
    title,
    content_lines: contentLines.length > 0 ? contentLines : ["No content available from source artifact."],
    content_hash: hashObject({ sectionType, title, contentLines }),
    human_review_required: true,
  };
}

function buildOutputArtifacts({ prDraft, markdown, generatedAt }) {
  const prOutput = prDraft.pr_draft_output_artifacts?.[0] ?? {};
  return [{
    schema_version: "output-artifact.v2",
    output_artifact_id: "output.personal_dev.p226.release_note",
    source_output_artifact_id: prOutput.output_artifact_id ?? null,
    source_id: "release_note_artifact",
    source_label: "Release Note Artifact",
    domain_pack: "personal-dev",
    capability_id: CAPABILITY_ID,
    workflow_run_id: prOutput.workflow_run_id ?? "workflow-run.personal_dev.p226.release_note",
    tenant_id: prOutput.tenant_id ?? "tenant.personal.jws",
    matter_id: prOutput.matter_id ?? "matter.personal_dev.hermes",
    artifact_type: "release_note",
    artifact_uri: "artifacts/release-note-artifact/latest/release-note.md",
    content_hash: hashText(markdown),
    hash_algorithm: "sha256",
    hash_status: "present",
    output_status: "draft",
    delivery_state: "blocked_pending_approval",
    delivery_state_after_receipt: "ready_for_delivery",
    approval_id: "approval.personal_dev.p226.release_note.human_review",
    approval_status: "pending",
    approval_request_ids: ["approval.personal_dev.p226.release_note.human_review"],
    approval_request_count: 1,
    delivery_action_ids: ["delivery.personal_dev.p226.release_note"],
    delivery_action_count: 1,
    delivery_receipt_ids: [],
    delivery_receipt_count: 0,
    blocking_gate_ids: ["human_approval_gate"],
    blocking_gate_count: 1,
    citation_count: 0,
    created_by_run_id: "agent-run.personal_dev.p226.release_note",
    created_at: generatedAt,
    recorded_at: generatedAt,
    approval_separation_status: "approval_required_not_applied",
    delivery_separation_status: "separate_delivery_action_declared",
    receipt_separation_status: "receipt_required_before_delivery",
    event_id: "event.output.rendered.personal_dev.p226.release_note",
    policy_snapshot_id: prOutput.policy_snapshot_id ?? "policy.default.personal_dev.v1",
    metadata: {
      title: "Hermes Personal Dev release note draft",
      merged_change_basis: "validated_pr_draft_pending_human_merge_approval",
      source_pr_draft_output_artifact_id: prOutput.output_artifact_id ?? null,
      required_sections: REQUIRED_SECTION_TYPES,
    },
  }];
}

function buildGateBindings({ prDraft, canonicalMatrix, protectedScan, outputArtifacts, generatedAt }) {
  const outputArtifact = outputArtifacts[0];
  return [
    gateBinding("pr_draft_artifact", prDraft.pr_draft_artifact_id, prDraft.summary?.pr_draft_artifact_status, outputArtifact.output_artifact_id, generatedAt),
    gateBinding("canonical_test_matrix", canonicalMatrix.canonical_test_matrix_id, canonicalMatrix.summary?.canonical_test_matrix_status, outputArtifact.output_artifact_id, generatedAt),
    gateBinding("dev_protected_scan", protectedScan.dev_protected_scan_id, protectedScan.summary?.dev_protected_scan_status, outputArtifact.output_artifact_id, generatedAt),
  ];
}

function gateBinding(sourceType, sourceId, sourceStatus, outputArtifactId, generatedAt) {
  return {
    schema_version: "release-note-gate-binding.v1",
    release_note_gate_binding_id: `release-note-gate-binding.${sourceType}`,
    generated_at: generatedAt,
    source_type: sourceType,
    source_id: sourceId ?? null,
    source_status: sourceStatus ?? "unknown",
    output_artifact_id: outputArtifactId,
    release_note_binding_status: "bound_to_release_note_draft",
    release_note_publication_allowed: false,
    merge_allowed: false,
    release_allowed: false,
    human_review_required: true,
    binding_hash: hashObject({ sourceType, sourceId, sourceStatus, outputArtifactId }),
  };
}

function buildDesktopBoundary(generatedAt) {
  return {
    schema_version: "release-note-desktop-boundary.v1",
    boundary_id: "release-note-desktop-boundary.personal-dev",
    generated_at: generatedAt,
    boundary_status: "enforced",
    surface_policy: DESKTOP_SURFACE_POLICY,
    visible_collections: ["release_note_output_artifacts", "release_note_change_records", "release_note_sections", "release_note_gate_bindings", "validation_items"],
    read_only: true,
    mutation_allowed: false,
    command_execution_allowed: false,
    release_note_publication_allowed: false,
    github_api_allowed: false,
    branch_push_allowed: false,
    merge_allowed: false,
    release_allowed: false,
    patch_application_allowed: false,
    git_command_allowed: false,
    filesystem_mutation_allowed: false,
    protected_file_write_allowed: false,
    secret_material_read_allowed: false,
    production_config_write_allowed: false,
    external_agent_invocation_allowed: false,
    source_of_truth: false,
    raw_secret_material_exposed: false,
    provider_key_exposed: false,
    human_review_required: true,
  };
}

function buildCheckpoints({
  packageJson,
  roadmapText,
  prDraftArtifact,
  prDraftArtifactError,
  canonicalTestMatrix,
  canonicalTestMatrixError,
  devProtectedScan,
  devProtectedScanError,
  changeRecords,
  sections,
  outputArtifacts,
  gateBindings,
  desktopBoundary,
}) {
  return [
    checkpoint("package_script_registered", Boolean(packageJson?.scripts?.["personal-dev:release-note"]), "package.json exposes personal-dev:release-note."),
    checkpoint("roadmap_slot_declared", String(roadmapText ?? "").includes("P226") && String(roadmapText ?? "").includes("release note generator"), "Final completion ledger declares P226 release note generator."),
    checkpoint("pr_draft_artifact_complete", !prDraftArtifactError && prDraftArtifact.summary?.pr_draft_artifact_status === "complete" && prDraftArtifact.summary?.validation_error_count === 0, "PR Draft Artifact is complete before release note generation."),
    checkpoint("canonical_test_matrix_complete", !canonicalTestMatrixError && canonicalTestMatrix.summary?.canonical_test_matrix_status === "complete" && canonicalTestMatrix.summary?.passed_required_dimension_count === canonicalTestMatrix.summary?.required_dimension_count && canonicalTestMatrix.summary?.validation_error_count === 0, "Canonical Test Matrix is complete before release note generation."),
    checkpoint("dev_protected_scan_complete", !devProtectedScanError && devProtectedScan.summary?.dev_protected_scan_status === "complete" && devProtectedScan.summary?.blocked_before_approval_count === devProtectedScan.summary?.protected_candidate_count && devProtectedScan.summary?.validation_error_count === 0, "Dev Protected Scan is complete before release note generation."),
    checkpoint("merged_change_basis_declared", changeRecords.length >= 1 && changeRecords.every((record) => record.merged_change_basis === "validated_pr_draft_pending_human_merge_approval" && record.merge_performed === false && record.release_performed === false), "Release note declares validated merge-candidate basis without executing merge or release."),
    checkpoint("release_note_output_artifact_stored", outputArtifacts.length === 1 && outputArtifacts.every((artifact) => artifact.schema_version === "output-artifact.v2" && artifact.artifact_type === "release_note" && artifact.hash_status === "present" && artifact.output_status === "draft" && artifact.delivery_state === "blocked_pending_approval"), "Release note is stored as draft OutputArtifact v2 blocked pending approval."),
    checkpoint("release_note_sections_present", REQUIRED_SECTION_TYPES.every((sectionType) => sections.some((sectionItem) => sectionItem.section_type === sectionType && sectionItem.section_status === "draft_ready_for_human_review")), "Release note includes highlights, changes, tests, risks, rollback, and human review sections."),
    checkpoint("gate_bindings_preserve_human_review", gateBindings.length === 3 && gateBindings.every((binding) => binding.release_note_binding_status === "bound_to_release_note_draft" && binding.release_note_publication_allowed === false && binding.merge_allowed === false && binding.release_allowed === false), "Release note gate bindings preserve human review before publication, merge, or release."),
    checkpoint("desktop_boundary_read_only", desktopBoundary.read_only === true && desktopBoundary.release_note_publication_allowed === false && desktopBoundary.merge_allowed === false && desktopBoundary.release_allowed === false && desktopBoundary.source_of_truth === false, "Desktop release note boundary is read-only and not source of truth."),
  ];
}

function summarizeReleaseNoteArtifact({
  prDraftArtifact,
  canonicalTestMatrix,
  devProtectedScan,
  changeRecords,
  sections,
  outputArtifacts,
  gateBindings,
  desktopBoundary,
  checkpoints,
  validation,
}) {
  return {
    release_note_artifact_status: validation.valid ? "complete" : "blocked",
    release_note_artifact_contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    note_authority: NOTE_AUTHORITY,
    source_of_truth: SOURCE_OF_TRUTH,
    source_pr_draft_artifact_status: prDraftArtifact.summary?.pr_draft_artifact_status ?? "unknown",
    source_canonical_test_matrix_status: canonicalTestMatrix.summary?.canonical_test_matrix_status ?? "unknown",
    source_dev_protected_scan_status: devProtectedScan.summary?.dev_protected_scan_status ?? "unknown",
    source_pr_draft_output_artifact_count: prDraftArtifact.summary?.pr_draft_output_artifact_count ?? 0,
    source_pr_draft_section_count: prDraftArtifact.summary?.pr_draft_section_count ?? 0,
    source_passed_test_evidence_count: prDraftArtifact.summary?.passed_test_evidence_count ?? 0,
    source_required_test_count: canonicalTestMatrix.summary?.required_dimension_count ?? 0,
    source_passed_required_test_count: canonicalTestMatrix.summary?.passed_required_dimension_count ?? 0,
    source_protected_candidate_count: devProtectedScan.summary?.protected_candidate_count ?? 0,
    source_blocked_before_approval_count: devProtectedScan.summary?.blocked_before_approval_count ?? 0,
    release_note_output_artifact_count: outputArtifacts.length,
    output_artifact_v2_count: outputArtifacts.filter((artifact) => artifact.schema_version === "output-artifact.v2").length,
    output_artifact_hash_present_count: outputArtifacts.filter((artifact) => artifact.hash_status === "present").length,
    output_artifact_draft_count: outputArtifacts.filter((artifact) => artifact.output_status === "draft").length,
    output_artifact_blocked_pending_approval_count: outputArtifacts.filter((artifact) => artifact.delivery_state === "blocked_pending_approval").length,
    output_artifact_pending_approval_count: outputArtifacts.filter((artifact) => artifact.approval_status === "pending").length,
    release_note_change_record_count: changeRecords.length,
    merged_change_basis_count: changeRecords.filter((record) => record.merged_change_basis === "validated_pr_draft_pending_human_merge_approval").length,
    merge_performed: false,
    release_performed: false,
    release_note_publication_performed: false,
    release_note_section_count: sections.length,
    highlights_section_present: sections.some((sectionItem) => sectionItem.section_type === "highlights"),
    changes_section_present: sections.some((sectionItem) => sectionItem.section_type === "changes"),
    tests_section_present: sections.some((sectionItem) => sectionItem.section_type === "tests"),
    risks_section_present: sections.some((sectionItem) => sectionItem.section_type === "risks"),
    rollback_section_present: sections.some((sectionItem) => sectionItem.section_type === "rollback"),
    human_review_section_present: sections.some((sectionItem) => sectionItem.section_type === "human_review"),
    ready_section_count: sections.filter((sectionItem) => sectionItem.section_status === "draft_ready_for_human_review").length,
    release_note_gate_binding_count: gateBindings.length,
    bound_release_note_gate_binding_count: gateBindings.filter((binding) => binding.release_note_binding_status === "bound_to_release_note_draft").length,
    publication_allowed_count: gateBindings.filter((binding) => binding.release_note_publication_allowed).length,
    merge_allowed_count: gateBindings.filter((binding) => binding.merge_allowed).length,
    release_allowed_count: gateBindings.filter((binding) => binding.release_allowed).length,
    github_api_called: false,
    branch_push_performed: false,
    patch_application_performed_count: 0,
    git_command_executed_count: 0,
    filesystem_mutation_performed_count: 0,
    protected_mutation_performed_count: 0,
    raw_secret_material_exposed: false,
    provider_key_exposed: false,
    human_review_required: true,
    desktop_surface_policy: desktopBoundary.surface_policy,
    desktop_read_only: desktopBoundary.read_only,
    desktop_mutation_allowed: desktopBoundary.mutation_allowed,
    desktop_command_execution_allowed: desktopBoundary.command_execution_allowed,
    desktop_release_note_publication_allowed: desktopBoundary.release_note_publication_allowed,
    desktop_github_api_allowed: desktopBoundary.github_api_allowed,
    desktop_branch_push_allowed: desktopBoundary.branch_push_allowed,
    desktop_merge_allowed: desktopBoundary.merge_allowed,
    desktop_release_allowed: desktopBoundary.release_allowed,
    desktop_patch_application_allowed: desktopBoundary.patch_application_allowed,
    desktop_git_command_allowed: desktopBoundary.git_command_allowed,
    desktop_filesystem_mutation_allowed: desktopBoundary.filesystem_mutation_allowed,
    desktop_protected_file_write_allowed: desktopBoundary.protected_file_write_allowed,
    desktop_secret_material_read_allowed: desktopBoundary.secret_material_read_allowed,
    desktop_production_config_write_allowed: desktopBoundary.production_config_write_allowed,
    desktop_source_of_truth: desktopBoundary.source_of_truth,
    checkpoint_count: checkpoints.length,
    passed_checkpoint_count: checkpoints.filter((checkpointItem) => checkpointItem.status === "passed").length,
    failed_checkpoint_count: checkpoints.filter((checkpointItem) => checkpointItem.status !== "passed").length,
    validation_item_count: checkpoints.length,
    validation_error_count: validation.errors.length,
    by_section_type: countBy(sections, "section_type"),
    by_binding_status: countBy(gateBindings, "release_note_binding_status"),
  };
}

function buildSourceContracts({ packageJson, roadmapText, prDraftArtifact, canonicalTestMatrix, devProtectedScan }) {
  return [
    sourceContract("package_json", "package.json", packageJson),
    sourceContract("final_completion_ledger", "docs/final-completion-phase-ledger.md", roadmapText),
    sourceContract("pr_draft_artifact", "artifacts/pr-draft-artifact/latest/pr-draft-artifact.json", prDraftArtifact),
    sourceContract("canonical_test_matrix", "artifacts/canonical-test-matrix/latest/canonical-test-matrix.json", canonicalTestMatrix),
    sourceContract("dev_protected_scan", "artifacts/dev-protected-scan/latest/dev-protected-scan.json", devProtectedScan),
  ];
}

function sourceContract(sourceId, sourcePath, readResult) {
  const value = readResult.value ?? readResult;
  return {
    schema_version: "release-note-source-contract.v1",
    source_id: sourceId,
    source_path: sourcePath,
    source_status: readResult.error ? "missing" : "available",
    error: readResult.error ?? null,
    source_hash: hashObject(value ?? {}),
  };
}

function checkpoint(checkpointId, condition, message) {
  return {
    schema_version: "release-note-checkpoint.v1",
    checkpoint_id: checkpointId,
    status: condition ? "passed" : "failed",
    message,
  };
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status !== "passed")
    .map((item) => ({
      path: item.path,
      message: item.message,
      status: item.status,
    }));
  return {
    schema_version: "release-note-validation.v1",
    valid: errors.length === 0,
    errors,
  };
}

function renderReleaseNoteMarkdown({ sections, generatedAt }) {
  const lines = [];
  lines.push("# Release Note Draft: Hermes Personal Dev validated change");
  lines.push("");
  lines.push(`Generated: ${generatedAt}`);
  for (const sectionItem of sections) {
    lines.push("");
    lines.push(`## ${sectionItem.title}`);
    for (const line of sectionItem.content_lines) lines.push(`- ${line}`);
  }
  lines.push("");
  lines.push("This release note is a draft. Merge, release, publication, protected writes, production config changes, credential changes, and client-facing outputs remain blocked until explicit human approval.");
  return `${lines.join("\n")}\n`;
}

function renderSummaryMarkdown(result) {
  const lines = [];
  lines.push("# Release Note Artifact");
  lines.push("");
  lines.push(`Status: ${result.summary.release_note_artifact_status}`);
  lines.push(`Output artifacts: ${result.summary.release_note_output_artifact_count}`);
  lines.push(`Sections: ${result.summary.release_note_section_count}`);
  lines.push(`Change records: ${result.summary.release_note_change_record_count}`);
  lines.push(`Gate bindings: ${result.summary.release_note_gate_binding_count}`);
  lines.push(`Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("Human review note: release note publication, merge, release, protected writes, credential changes, production config changes, and client-facing outputs remain blocked until explicit human approval.");
  return `${lines.join("\n")}\n`;
}

function serializableReleaseNoteArtifact(result) {
  const { markdown: _markdown, summary_markdown: _summaryMarkdown, output_dir: _outputDir, ...rest } = result;
  return rest;
}

function normalizeInputs(options) {
  return {
    repo_root: options.repoRoot ?? DEFAULT_RELEASE_NOTE_ARTIFACT_INPUTS.repoRoot,
    package_path: options.packagePath ?? DEFAULT_RELEASE_NOTE_ARTIFACT_INPUTS.packagePath,
    roadmap_path: options.roadmapPath ?? DEFAULT_RELEASE_NOTE_ARTIFACT_INPUTS.roadmapPath,
    pr_draft_artifact_path: path.resolve(options.prDraftArtifactPath ?? DEFAULT_RELEASE_NOTE_ARTIFACT_INPUTS.prDraftArtifactPath),
    canonical_test_matrix_path: path.resolve(options.canonicalTestMatrixPath ?? DEFAULT_RELEASE_NOTE_ARTIFACT_INPUTS.canonicalTestMatrixPath),
    dev_protected_scan_path: path.resolve(options.devProtectedScanPath ?? DEFAULT_RELEASE_NOTE_ARTIFACT_INPUTS.devProtectedScanPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--repo-root") parsed.repoRoot = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--pr-draft-artifact") parsed.prDraftArtifactPath = argv[++index];
    else if (arg === "--canonical-test-matrix") parsed.canonicalTestMatrixPath = argv[++index];
    else if (arg === "--dev-protected-scan") parsed.devProtectedScanPath = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/release-note-artifact.mjs [options]

Options:
  --check                         Fail when validation does not pass
  --no-write                      Build without writing artifacts
  --out-dir <path>                Output directory
  --repo-root <path>              Repository root
  --package <path>                package.json path relative to repo root
  --roadmap <path>                final completion ledger path relative to repo root
  --pr-draft-artifact <path>      pr-draft-artifact.json path
  --canonical-test-matrix <path>  canonical-test-matrix.json path
  --dev-protected-scan <path>     dev-protected-scan.json path`);
}

async function readJsonOrError(filePath) {
  try {
    return { value: JSON.parse(await readFile(filePath, "utf8")) };
  } catch (error) {
    return { value: null, error: `${error.name}: ${error.message}` };
  }
}

async function readTextOrError(filePath) {
  try {
    return { value: await readFile(filePath, "utf8") };
  } catch (error) {
    return { value: "", error: `${error.name}: ${error.message}` };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function hashObject(value) {
  return hashText(JSON.stringify(value ?? null));
}

function hashText(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function dateStamp(value) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
