import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_LDD_VDR_INVENTORY_OUT_DIR = "artifacts/ldd-vdr-inventory/latest";
export const DEFAULT_LDD_VDR_INVENTORY_INPUTS = {
  matterFiles: [
    "examples/project-alpha-matter.json",
    "examples/project-beta-litigation-matter.json",
  ],
  matterDocumentIndexPath: "artifacts/matter-document-index/latest/matter-document-index.json",
  matterTaskBoardPath: "artifacts/matter-task-board/latest/matter-task-board.json",
  resourceVersionLedgerPath: "artifacts/resource-version-ledger/latest/resource-version-ledger.json",
  lawFirmPackManifestPath: "artifacts/law-firm-pack-manifest/latest/law-firm-pack-manifest.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "ldd-vdr-inventory.v1";
const SOURCE_OF_TRUTH = "matter_source_register_vdr_requests_documents_and_resource_version_ledger";
const MISSING_STATUSES = new Set(["missing", "requested"]);
const RECEIVED_STATUSES = new Set(["received", "in-review", "approved", "delivered"]);

export async function runLddVdrInventory(options = {}) {
  const result = await buildLddVdrInventory(options);
  if (options.write !== false) await writeLddVdrInventory(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`LDD VDR inventory validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildLddVdrInventory(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_LDD_VDR_INVENTORY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const matterReads = sourceReads.filter((source) => source.source_kind === "matter_file");
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);

  const context = {
    generatedAt,
    matterReads,
    matterDocumentIndex: sourceById.matter_document_index,
    matterTaskBoard: sourceById.matter_task_board,
    resourceVersionLedger: sourceById.resource_version_ledger,
    lawFirmPackManifest: sourceById.law_firm_pack_manifest,
  };
  const batches = buildVdrBatches(context);
  const folders = buildVdrFolderRecords(context, batches);
  const files = buildVdrFileRecords(context, batches);
  const versions = buildVdrVersionRecords(context, files);
  const missingData = buildVdrMissingDataRecords(context, batches);
  const matterSummaries = buildMatterSummaries({ batches, folders, files, versions, missingData, generatedAt });
  const desktopBoundary = buildDesktopBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    sourceReads,
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    batches,
    folders,
    files,
    versions,
    missingData,
    matterSummaries,
    desktopBoundary,
  });
  const validationItems = checkpoints.map(({ checkpoint_id: checkpointId, status, message, ...rest }) => ({
    path: checkpointId,
    check_id: checkpointId,
    status,
    message,
    ...rest,
  }));
  const validation = summarizeValidation(validationItems);
  const summary = summarizeLddVdrInventory({
    sourceReads,
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    batches,
    folders,
    files,
    versions,
    missingData,
    matterSummaries,
    desktopBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    ldd_vdr_inventory_id: `ldd-vdr-inventory.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    ldd_vdr_inventory_status: summary.ldd_vdr_inventory_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    ldd_vdr_inventory_contract: buildContract(generatedAt),
    ldd_vdr_batches: batches,
    ldd_vdr_folder_records: folders,
    ldd_vdr_file_records: files,
    ldd_vdr_version_records: versions,
    ldd_vdr_missing_data_records: missingData,
    ldd_vdr_matter_summaries: matterSummaries,
    ldd_vdr_inventory_desktop_boundary: desktopBoundary,
    ldd_vdr_inventory_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderLddVdrInventoryMarkdown(result),
  };
}

export async function writeLddVdrInventory(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableLddVdrInventory(result);
  await writeJson(path.join(outDir, "ldd-vdr-inventory.json"), serializable);
  await writeJson(path.join(outDir, "ldd-vdr-batches.json"), {
    schema_version: "ldd-vdr-batches.v1",
    generated_at: result.generated_at,
    batch_count: result.ldd_vdr_batches.length,
    ldd_vdr_batches: result.ldd_vdr_batches,
  });
  await writeJson(path.join(outDir, "ldd-vdr-folders.json"), {
    schema_version: "ldd-vdr-folders.v1",
    generated_at: result.generated_at,
    folder_record_count: result.ldd_vdr_folder_records.length,
    ldd_vdr_folder_records: result.ldd_vdr_folder_records,
  });
  await writeJson(path.join(outDir, "ldd-vdr-files.json"), {
    schema_version: "ldd-vdr-files.v1",
    generated_at: result.generated_at,
    file_record_count: result.ldd_vdr_file_records.length,
    ldd_vdr_file_records: result.ldd_vdr_file_records,
  });
  await writeJson(path.join(outDir, "ldd-vdr-versions.json"), {
    schema_version: "ldd-vdr-versions.v1",
    generated_at: result.generated_at,
    version_record_count: result.ldd_vdr_version_records.length,
    ldd_vdr_version_records: result.ldd_vdr_version_records,
  });
  await writeJson(path.join(outDir, "ldd-vdr-missing-data.json"), {
    schema_version: "ldd-vdr-missing-data.v1",
    generated_at: result.generated_at,
    missing_data_record_count: result.ldd_vdr_missing_data_records.length,
    ldd_vdr_missing_data_records: result.ldd_vdr_missing_data_records,
  });
  await writeJson(path.join(outDir, "ldd-vdr-matter-summaries.json"), {
    schema_version: "ldd-vdr-matter-summaries.v1",
    generated_at: result.generated_at,
    matter_summary_count: result.ldd_vdr_matter_summaries.length,
    ldd_vdr_matter_summaries: result.ldd_vdr_matter_summaries,
  });
  await writeJson(path.join(outDir, "ldd-vdr-inventory-boundary.json"), {
    schema_version: "ldd-vdr-inventory-boundary-artifact.v1",
    generated_at: result.generated_at,
    ldd_vdr_inventory_desktop_boundary: result.ldd_vdr_inventory_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "ldd-vdr-inventory-validation-report.v1",
    generated_at: result.generated_at,
    ldd_vdr_inventory_id: result.ldd_vdr_inventory_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runLddVdrInventoryCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runLddVdrInventory(args);
    console.log(`LDD VDR inventory ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.ldd_vdr_inventory_status}`);
    console.log(`Batches: ${result.summary.batch_count}`);
    console.log(`Folders/files/versions: ${result.summary.folder_record_count}/${result.summary.file_record_count}/${result.summary.version_record_count}`);
    console.log(`Missing data records: ${result.summary.missing_data_record_count}`);
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
    schema_version: "ldd-vdr-inventory-contract.v1",
    contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    batch_rule: "each VDR source register or VDR request set is grouped into a matter-scoped batch",
    folder_rule: "folder rows are deterministic issue/status groupings and do not assert that an external VDR folder was opened",
    file_rule: "file rows are source metadata projections only and are not legal conclusions",
    version_rule: "version rows bind file rows to deterministic version keys and existing resource version ledger context when available",
    missing_data_rule: "requested or missing materials are recorded as diligence follow-up candidates and not treated as factual non-existence",
    attorney_review_rule: "all VDR inventory rows remain internal operational context pending attorney or human review before client-facing use",
    desktop_companion_rule: "Desktop views are read-only projections and are not the source of truth",
    mutation_policy: "no matter data write, task state write, workflow transition, runtime execution, delivery execution, protected action, legal advice, or client-facing output is performed",
    created_at: generatedAt,
  };
}

function buildVdrBatches({ matterReads, generatedAt }) {
  const batches = [];
  for (const matterRead of matterReads) {
    const matter = matterRead.value;
    if (!matter?.matter_id) continue;
    const vdrSources = (matter.source_register ?? []).filter((source) => source.system === "vdr");
    const vdrRequests = matter.deal_control?.vdr_requests ?? [];
    if (vdrSources.length === 0 && vdrRequests.length === 0) continue;
    const sources = vdrSources.length > 0 ? vdrSources : [{
      id: "derived-vdr-requests",
      system: "vdr",
      source_type: "derived-from-vdr-requests",
      access_tier: matter.confidentiality?.level ?? "client-confidential",
      status: "active",
      retention: matter.confidentiality?.retention ?? null,
    }];
    for (const source of sources) {
      const batchId = `ldd-vdr-batch.${slug(matter.matter_id)}.${slug(source.id)}`;
      batches.push({
        schema_version: "ldd-vdr-batch.v1",
        ldd_vdr_batch_id: batchId,
        matter_id: matter.matter_id,
        matter_title: matter.title ?? matter.matter_id,
        client: matter.client ?? null,
        practice_area: matter.practice_area ?? "unknown",
        matter_stage: matter.matter_profile?.matter_stage ?? "unknown",
        source_register_id: source.id,
        source_system: source.system ?? "vdr",
        source_type: source.source_type ?? "unknown",
        source_status: source.status ?? "unknown",
        classification: source.access_tier ?? matter.confidentiality?.level ?? "client-confidential",
        retention: source.retention ?? matter.confidentiality?.retention ?? null,
        batch_status: "inventory_attention_required",
        inventory_scope: "matter_vdr_metadata_and_known_diligence_requests",
        attorney_review_required: true,
        human_review_required: true,
        client_facing_ready: false,
        legal_advice_provided: false,
        client_facing_output_generated: false,
        matter_data_write_allowed: false,
        task_state_write_allowed: false,
        workflow_transition_allowed: false,
        runtime_execution_allowed: false,
        delivery_execution_allowed: false,
        protected_action_allowed: false,
        created_at: generatedAt,
      });
    }
  }
  return batches.sort((a, b) => a.ldd_vdr_batch_id.localeCompare(b.ldd_vdr_batch_id));
}

function buildVdrFolderRecords({ matterReads }, batches) {
  const matterById = mapMatterReads(matterReads);
  const records = [];
  for (const batch of batches) {
    const matter = matterById.get(batch.matter_id);
    const groups = buildIssueGroups(matter);
    for (const group of groups) {
      const folderId = `ldd-vdr-folder.${slug(batch.ldd_vdr_batch_id)}.${slug(group.issue)}`;
      records.push({
        schema_version: "ldd-vdr-folder-record.v1",
        ldd_vdr_folder_record_id: folderId,
        ldd_vdr_batch_id: batch.ldd_vdr_batch_id,
        matter_id: batch.matter_id,
        folder_key: group.issue,
        folder_path: `/${batch.matter_id}/VDR/${group.issue}`,
        folder_status: group.missing_count > 0 ? "attention_required" : "ready_for_review",
        document_count: group.document_count,
        received_file_count: group.received_count,
        missing_data_count: group.missing_count,
        source_register_id: batch.source_register_id,
        source_system: batch.source_system,
        classification: batch.classification,
        attorney_review_required: true,
        human_review_required: true,
        created_at: batch.created_at,
      });
    }
  }
  return records.sort((a, b) => a.ldd_vdr_folder_record_id.localeCompare(b.ldd_vdr_folder_record_id));
}

function buildVdrFileRecords({ matterReads }, batches) {
  const matterById = mapMatterReads(matterReads);
  const records = [];
  for (const batch of batches) {
    const matter = matterById.get(batch.matter_id);
    for (const document of matter?.documents ?? []) {
      const status = document.status ?? "unknown";
      if (!RECEIVED_STATUSES.has(status)) continue;
      const issue = normalizeIssue(document.issue);
      records.push(fileRecord({
        batch,
        sourceRecordId: document.id,
        title: document.title ?? document.id,
        documentType: document.type ?? "document",
        documentStatus: status,
        folderKey: issue,
        sourceCollection: "matter.documents",
        sourceKind: "matter_file_document",
        issue,
      }));
    }
    for (const evidence of matter?.litigation_control?.evidence ?? []) {
      const status = evidence.status ?? "unknown";
      if (!RECEIVED_STATUSES.has(status)) continue;
      const issue = "litigation-evidence";
      records.push(fileRecord({
        batch,
        sourceRecordId: evidence.id,
        title: evidence.title ?? evidence.id,
        documentType: evidence.type ?? "evidence",
        documentStatus: status,
        folderKey: issue,
        sourceCollection: "litigation_control.evidence",
        sourceKind: "matter_file_evidence",
        issue,
      }));
    }
  }
  return uniqueBy(records, "ldd_vdr_file_record_id").sort((a, b) => a.ldd_vdr_file_record_id.localeCompare(b.ldd_vdr_file_record_id));
}

function fileRecord({ batch, sourceRecordId, title, documentType, documentStatus, folderKey, sourceCollection, sourceKind, issue }) {
  const fileId = `ldd-vdr-file.${slug(batch.ldd_vdr_batch_id)}.${slug(sourceRecordId)}`;
  const hashInput = `${batch.matter_id}|${sourceCollection}|${sourceRecordId}|${title}|${documentStatus}`;
  return {
    schema_version: "ldd-vdr-file-record.v1",
    ldd_vdr_file_record_id: fileId,
    ldd_vdr_batch_id: batch.ldd_vdr_batch_id,
    matter_id: batch.matter_id,
    folder_key: folderKey,
    folder_path: `/${batch.matter_id}/VDR/${folderKey}`,
    source_record_id: sourceRecordId,
    source_collection: sourceCollection,
    source_kind: sourceKind,
    file_title: title,
    document_type: documentType,
    document_status: documentStatus,
    inventory_file_status: "ready_for_attorney_review",
    version_count: 1,
    content_hash: `sha256:${sha256(hashInput)}`,
    issue,
    classification: batch.classification,
    attorney_review_required: true,
    human_review_required: true,
    client_facing_ready: false,
    legal_advice_provided: false,
    client_facing_output_generated: false,
    created_at: batch.created_at,
  };
}

function buildVdrVersionRecords({ resourceVersionLedger }, fileRecords) {
  const resourceVersions = resourceVersionLedger?.version_ledger_catalog?.version_families ?? [];
  return fileRecords.map((file, index) => {
    const family = resourceVersions[index % Math.max(resourceVersions.length, 1)];
    const versionId = `${file.ldd_vdr_file_record_id}.v1`;
    return {
      schema_version: "ldd-vdr-version-record.v1",
      ldd_vdr_version_record_id: versionId,
      ldd_vdr_file_record_id: file.ldd_vdr_file_record_id,
      ldd_vdr_batch_id: file.ldd_vdr_batch_id,
      matter_id: file.matter_id,
      version_label: "v1",
      version_status: "current",
      content_hash: file.content_hash,
      resource_version_family_id: family?.version_family_id ?? null,
      resource_version_ledger_bound: Boolean(family),
      captured_at: file.created_at,
      attorney_review_required: true,
      human_review_required: true,
      created_at: file.created_at,
    };
  }).sort((a, b) => a.ldd_vdr_version_record_id.localeCompare(b.ldd_vdr_version_record_id));
}

function buildVdrMissingDataRecords({ matterReads }, batches) {
  const matterById = mapMatterReads(matterReads);
  const records = [];
  for (const batch of batches) {
    const matter = matterById.get(batch.matter_id);
    for (const request of matter?.deal_control?.vdr_requests ?? []) {
      if (!MISSING_STATUSES.has(request.status ?? "unknown")) continue;
      records.push(missingDataRecord({
        batch,
        sourceRecordId: request.id,
        title: request.title ?? request.id,
        status: request.status ?? "requested",
        owner: request.owner ?? null,
        due: request.due ?? null,
        issue: normalizeIssue(request.issue),
        sourceCollection: "deal_control.vdr_requests",
      }));
    }
    for (const document of matter?.documents ?? []) {
      if (!MISSING_STATUSES.has(document.status ?? "unknown")) continue;
      records.push(missingDataRecord({
        batch,
        sourceRecordId: document.id,
        title: document.title ?? document.id,
        status: document.status ?? "missing",
        owner: matter.matter_profile?.responsible_partner ?? matter.review_workflow?.default_reviewer ?? null,
        due: null,
        issue: normalizeIssue(document.issue),
        sourceCollection: "matter.documents",
      }));
    }
  }
  return uniqueBy(records, "ldd_vdr_missing_data_record_id").sort((a, b) => a.ldd_vdr_missing_data_record_id.localeCompare(b.ldd_vdr_missing_data_record_id));
}

function missingDataRecord({ batch, sourceRecordId, title, status, owner, due, issue, sourceCollection }) {
  return {
    schema_version: "ldd-vdr-missing-data-record.v1",
    ldd_vdr_missing_data_record_id: `ldd-vdr-missing.${slug(batch.ldd_vdr_batch_id)}.${slug(sourceCollection)}.${slug(sourceRecordId)}`,
    ldd_vdr_batch_id: batch.ldd_vdr_batch_id,
    matter_id: batch.matter_id,
    folder_key: issue,
    folder_path: `/${batch.matter_id}/VDR/${issue}`,
    source_record_id: sourceRecordId,
    source_collection: sourceCollection,
    missing_title: title,
    missing_status: status,
    missing_data_status: "follow_up_required",
    owner,
    due,
    issue,
    classification: batch.classification,
    absence_not_factual_nonexistence: true,
    rfi_candidate: true,
    attorney_review_required: true,
    human_review_required: true,
    client_facing_ready: false,
    legal_advice_provided: false,
    client_facing_output_generated: false,
    created_at: batch.created_at,
  };
}

function buildIssueGroups(matter) {
  const byIssue = new Map();
  const ensure = (issue) => {
    const key = normalizeIssue(issue);
    if (!byIssue.has(key)) {
      byIssue.set(key, { issue: key, document_count: 0, received_count: 0, missing_count: 0 });
    }
    return byIssue.get(key);
  };
  ensure("root");
  for (const document of matter?.documents ?? []) {
    const group = ensure(document.issue);
    group.document_count += 1;
    if (MISSING_STATUSES.has(document.status ?? "unknown")) group.missing_count += 1;
    if (RECEIVED_STATUSES.has(document.status ?? "unknown")) group.received_count += 1;
  }
  for (const request of matter?.deal_control?.vdr_requests ?? []) {
    const group = ensure(request.issue);
    group.document_count += 1;
    if (MISSING_STATUSES.has(request.status ?? "unknown")) group.missing_count += 1;
    if (RECEIVED_STATUSES.has(request.status ?? "unknown")) group.received_count += 1;
  }
  return [...byIssue.values()].sort((a, b) => a.issue.localeCompare(b.issue));
}

function buildMatterSummaries({ batches, folders, files, versions, missingData, generatedAt }) {
  const matterIds = [...new Set(batches.map((batch) => batch.matter_id))].sort();
  return matterIds.map((matterId) => {
    const matterBatches = batches.filter((batch) => batch.matter_id === matterId);
    const matterFolders = folders.filter((folder) => folder.matter_id === matterId);
    const matterFiles = files.filter((file) => file.matter_id === matterId);
    const matterVersions = versions.filter((version) => version.matter_id === matterId);
    const matterMissing = missingData.filter((record) => record.matter_id === matterId);
    return {
      schema_version: "ldd-vdr-matter-summary.v1",
      ldd_vdr_matter_summary_id: `ldd-vdr-matter-summary.${slug(matterId)}`,
      matter_id: matterId,
      ldd_vdr_matter_status: matterMissing.length > 0 ? "attention_required" : "ready_for_review",
      batch_count: matterBatches.length,
      folder_record_count: matterFolders.length,
      file_record_count: matterFiles.length,
      version_record_count: matterVersions.length,
      missing_data_record_count: matterMissing.length,
      rfi_candidate_count: matterMissing.filter((record) => record.rfi_candidate).length,
      attorney_review_required: true,
      human_review_required: true,
      client_facing_ready: false,
      created_at: generatedAt,
    };
  });
}

function buildCheckpoints({ sourceReads, packageJson, roadmapText, batches, folders, files, versions, missingData, matterSummaries, desktopBoundary }) {
  const sourceStatuses = sourceReads.map((source) => checkpoint(
    `source.${source.source_id}`,
    source.status === "complete",
    source.status === "complete" ? `${source.source_id} source loaded.` : `${source.source_id} source missing: ${source.error}`,
  ));
  return [
    ...sourceStatuses,
    checkpoint("package.script", Boolean(packageJson?.scripts?.["law-firm:vdr-inventory"]), "package.json exposes law-firm:vdr-inventory."),
    checkpoint("roadmap.p240", String(roadmapText ?? "").includes("P240"), "roadmap/ledger keeps P240 visible."),
    checkpoint("batch.count", batches.length > 0, `${batches.length} VDR batch(es) found.`),
    checkpoint("folder.count", folders.length > 0, `${folders.length} VDR folder row(s) built.`),
    checkpoint("file.count", files.length > 0, `${files.length} VDR file row(s) built.`),
    checkpoint("version.count", versions.length === files.length && versions.length > 0, `${versions.length} VDR version row(s) built.`),
    checkpoint("missing.count", missingData.length > 0, `${missingData.length} missing/requested data row(s) built.`),
    checkpoint("matter.summary.count", matterSummaries.length > 0, `${matterSummaries.length} matter summary row(s) built.`),
    checkpoint("matter.boundary", everyMatterScoped([...batches, ...folders, ...files, ...versions, ...missingData, ...matterSummaries]), "Every VDR inventory row is matter_id scoped."),
    checkpoint("review.gate", [...batches, ...folders, ...files, ...versions, ...missingData, ...matterSummaries].every((item) => item.attorney_review_required === true && item.human_review_required === true), "Every VDR inventory row remains attorney/human-review gated."),
    checkpoint("no.client.output", [...batches, ...files, ...missingData].every((item) => item.client_facing_ready === false && item.client_facing_output_generated === false), "No client-facing VDR output is generated."),
    checkpoint("desktop.boundary", desktopBoundary.boundary_status === "enforced" && desktopBoundary.read_only === true && desktopBoundary.desktop_mutation_allowed === false, "Desktop boundary is read-only."),
  ];
}

function summarizeLddVdrInventory({ sourceReads, batches, folders, files, versions, missingData, matterSummaries, desktopBoundary, checkpoints, validation }) {
  const failedCheckpointCount = checkpoints.filter((item) => item.status !== "passed").length;
  const sourceStatus = (sourceId) => sourceReads.find((source) => source.source_id === sourceId)?.status ?? "missing";
  return {
    ldd_vdr_inventory_status: validation.valid ? "complete" : "blocked",
    ldd_vdr_inventory_contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    source_matter_file_count: sourceReads.filter((source) => source.source_kind === "matter_file").length,
    source_matter_document_index_status: sourceStatus("matter_document_index"),
    source_matter_task_board_status: sourceStatus("matter_task_board"),
    source_resource_version_ledger_status: sourceStatus("resource_version_ledger"),
    source_law_firm_pack_manifest_status: sourceStatus("law_firm_pack_manifest"),
    batch_count: batches.length,
    matter_count: matterSummaries.length,
    folder_record_count: folders.length,
    file_record_count: files.length,
    version_record_count: versions.length,
    missing_data_record_count: missingData.length,
    attention_required_batch_count: batches.filter((batch) => batch.batch_status === "inventory_attention_required").length,
    rfi_candidate_count: missingData.filter((record) => record.rfi_candidate).length,
    resource_version_ledger_bound_count: versions.filter((version) => version.resource_version_ledger_bound).length,
    attorney_review_required_batch_count: batches.filter((batch) => batch.attorney_review_required).length,
    attorney_review_required_file_count: files.filter((file) => file.attorney_review_required).length,
    attorney_review_required_missing_data_count: missingData.filter((record) => record.attorney_review_required).length,
    human_review_required_batch_count: batches.filter((batch) => batch.human_review_required).length,
    client_facing_ready_count: [...batches, ...files, ...missingData, ...matterSummaries].filter((item) => item.client_facing_ready === true).length,
    legal_advice_provided: false,
    client_facing_output_generated: false,
    desktop_boundary_status: desktopBoundary.boundary_status,
    desktop_read_only: desktopBoundary.read_only,
    desktop_mutation_allowed: desktopBoundary.desktop_mutation_allowed,
    desktop_source_of_truth: desktopBoundary.desktop_source_of_truth,
    matter_data_write_allowed: desktopBoundary.matter_data_write_allowed,
    task_state_write_allowed: desktopBoundary.task_state_write_allowed,
    workflow_transition_allowed: desktopBoundary.workflow_transition_allowed,
    runtime_execution_allowed: desktopBoundary.runtime_execution_allowed,
    delivery_execution_allowed: desktopBoundary.delivery_execution_allowed,
    protected_action_allowed: desktopBoundary.protected_action_allowed,
    client_facing_output_allowed_without_attorney_review: false,
    validation_item_count: validation.items.length,
    failed_checkpoint_count: failedCheckpointCount,
    validation_error_count: validation.errors.length,
  };
}

function buildSafeHandling() {
  return {
    report_only: true,
    legal_advice_provided: false,
    client_facing_output_generated: false,
    attorney_review_required: true,
    human_review_required: true,
    external_vdr_access_performed: false,
    matter_data_write_allowed: false,
    task_state_write_allowed: false,
    workflow_transition_allowed: false,
    runtime_execution_performed: false,
    delivery_execution_performed: false,
    desktop_mutation_allowed: false,
    desktop_source_of_truth: false,
    protected_mutation_executed: false,
    secret_material_exposed: false,
    provider_key_visible: false,
  };
}

function buildDesktopBoundary(generatedAt) {
  return {
    schema_version: "ldd-vdr-inventory-desktop-boundary.v1",
    boundary_status: "enforced",
    read_only: true,
    desktop_mutation_allowed: false,
    desktop_source_of_truth: false,
    matter_data_write_allowed: false,
    task_state_write_allowed: false,
    workflow_transition_allowed: false,
    runtime_execution_allowed: false,
    delivery_execution_allowed: false,
    protected_action_allowed: false,
    client_facing_output_allowed_without_attorney_review: false,
    generated_at: generatedAt,
  };
}

function buildSourceContracts(sourceReads, packageJson, roadmapText) {
  return {
    source_of_truth: SOURCE_OF_TRUTH,
    sources: sourceReads.map((source) => ({
      source_id: source.source_id,
      source_kind: source.source_kind,
      path: source.path,
      status: source.status,
      schema_version: source.value?.schema_version ?? null,
      error: source.error ?? null,
    })),
    package_script_present: Boolean(packageJson.value?.scripts?.["law-firm:vdr-inventory"]),
    roadmap_p240_present: String(roadmapText.value ?? "").includes("P240"),
  };
}

function renderLddVdrInventoryMarkdown(result) {
  const lines = [
    "# LDD VDR Inventory",
    "",
    `- Status: ${result.summary.ldd_vdr_inventory_status}`,
    `- Batches: ${result.summary.batch_count}`,
    `- Folders: ${result.summary.folder_record_count}`,
    `- Files: ${result.summary.file_record_count}`,
    `- Versions: ${result.summary.version_record_count}`,
    `- Missing/requested data: ${result.summary.missing_data_record_count}`,
    `- RFI candidates: ${result.summary.rfi_candidate_count}`,
    `- Attorney review required: ${result.safe_handling.attorney_review_required}`,
    `- Client-facing output generated: ${result.safe_handling.client_facing_output_generated}`,
    "",
    "## Matter Summaries",
    "",
  ];
  for (const summary of result.ldd_vdr_matter_summaries) {
    lines.push(`- ${summary.matter_id}: ${summary.file_record_count} file(s), ${summary.version_record_count} version(s), ${summary.missing_data_record_count} missing/requested item(s).`);
  }
  lines.push("", "This artifact is an internal operational inventory. Missing VDR materials are follow-up candidates, not factual non-existence findings.");
  return `${lines.join("\n")}\n`;
}

function serializableLddVdrInventory(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function normalizeInputs(options) {
  const defaults = DEFAULT_LDD_VDR_INVENTORY_INPUTS;
  return {
    matter_files: [...(options.matterFiles ?? defaults.matterFiles)].map((item) => path.resolve(item)),
    matter_document_index_path: path.resolve(options.matterDocumentIndexPath ?? defaults.matterDocumentIndexPath),
    matter_task_board_path: path.resolve(options.matterTaskBoardPath ?? defaults.matterTaskBoardPath),
    resource_version_ledger_path: path.resolve(options.resourceVersionLedgerPath ?? defaults.resourceVersionLedgerPath),
    law_firm_pack_manifest_path: path.resolve(options.lawFirmPackManifestPath ?? defaults.lawFirmPackManifestPath),
    package_path: path.resolve(options.packagePath ?? defaults.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? defaults.roadmapPath),
  };
}

async function readSourceArtifacts(inputs) {
  const matterReads = await Promise.all(inputs.matter_files.map(async (matterPath, index) => {
    const read = await readJsonOrError(matterPath);
    return {
      source_id: `matter_file_${index + 1}`,
      source_kind: "matter_file",
      path: matterPath,
      status: read.value ? "complete" : "missing",
      value: read.value,
      error: read.error,
    };
  }));
  const artifactInputs = [
    ["matter_document_index", "artifact", inputs.matter_document_index_path],
    ["matter_task_board", "artifact", inputs.matter_task_board_path],
    ["resource_version_ledger", "artifact", inputs.resource_version_ledger_path],
    ["law_firm_pack_manifest", "artifact", inputs.law_firm_pack_manifest_path],
  ];
  const artifactReads = await Promise.all(artifactInputs.map(async ([sourceId, sourceKind, sourcePath]) => {
    const read = await readJsonOrError(sourcePath);
    return {
      source_id: sourceId,
      source_kind: sourceKind,
      path: sourcePath,
      status: read.value ? "complete" : "missing",
      value: read.value,
      error: read.error,
    };
  }));
  return [...matterReads, ...artifactReads];
}

async function readJsonOrError(filePath) {
  try {
    return { value: JSON.parse(await readFile(filePath, "utf8")), error: null };
  } catch (error) {
    return { value: null, error: error.message };
  }
}

async function readTextOrError(filePath) {
  try {
    return { value: await readFile(filePath, "utf8"), error: null };
  } catch (error) {
    return { value: null, error: error.message };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed").map((item) => ({
    path: item.path,
    message: item.message,
  }));
  return {
    valid: errors.length === 0,
    items,
    errors,
  };
}

function checkpoint(checkpointId, passed, message) {
  return {
    checkpoint_id: checkpointId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function everyMatterScoped(items) {
  return items.every((item) => typeof item.matter_id === "string" && item.matter_id.length > 0);
}

function mapMatterReads(matterReads) {
  return new Map(matterReads.filter((read) => read.value?.matter_id).map((read) => [read.value.matter_id, read.value]));
}

function uniqueBy(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    const value = item[key];
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function normalizeIssue(issue) {
  return slug(issue ?? "general");
}

function slug(value) {
  return String(value ?? "unknown").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "");
}

function parseArgs(argv) {
  const args = { write: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--check") args.check = true;
    else if (arg === "--no-write") args.write = false;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--matter-file") {
      args.matterFiles ??= [];
      args.matterFiles.push(argv[++index]);
    } else if (arg === "--matter-document-index") args.matterDocumentIndexPath = argv[++index];
    else if (arg === "--matter-task-board") args.matterTaskBoardPath = argv[++index];
    else if (arg === "--resource-version-ledger") args.resourceVersionLedgerPath = argv[++index];
    else if (arg === "--law-firm-pack-manifest") args.lawFirmPackManifestPath = argv[++index];
    else if (arg === "--package") args.packagePath = argv[++index];
    else if (arg === "--roadmap") args.roadmapPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/ldd-vdr-inventory.mjs [options]

Options:
  --check                         Fail when validation has errors.
  --no-write                      Build without writing artifacts.
  --out-dir <path>                Output directory.
  --matter-file <path>            Matter JSON file. Can be repeated.
  --matter-document-index <path>  matter-document-index.json path.
  --matter-task-board <path>      matter-task-board.json path.
  --resource-version-ledger <path> resource-version-ledger.json path.
  --law-firm-pack-manifest <path> law-firm-pack-manifest.json path.
  --package <path>                package.json path.
  --roadmap <path>                roadmap or ledger path.
`);
}
