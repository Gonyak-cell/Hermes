import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseKakaoTalkExport } from "./kakao-parser.mjs";

export const DEFAULT_KAKAOTALK_IMPORT_BOUNDARY_OUT_DIR = "artifacts/kakaotalk-import-boundary/latest";
export const DEFAULT_KAKAOTALK_IMPORT_BOUNDARY_INPUTS = {
  connectorContractV2Path: "artifacts/connector-contract-v2/latest/connector-contract-v2.json",
  outlookEmailConnectorPath: "artifacts/outlook-email-connector/latest/outlook-email-connector.json",
  exportInputs: ["examples/kakaotalk-import-boundary"],
  attachmentManifestPath: "examples/kakaotalk-import-boundary/attachments.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
  finalLedgerPath: "docs/final-completion-phase-ledger.md",
  controlPlaneLoopPath: "src/control-plane-loop.mjs",
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiPath: "src/review-api.mjs",
};

const CONNECTOR_ID = "connector.kakaotalk_export.v2";
const CONNECTOR_PHASE = "P271";
const DEFAULT_TENANT_ID = "tenant.hermes.kakaotalk.demo";
const DEFAULT_MATTER_ID = "matter.kakaotalk.demo";
const DEFAULT_POLICY_SNAPSHOT_ID = "policy.kakaotalk_import_boundary.default.v1";
const DEFAULT_EXPORT_ID = "kakaotalk-export.alpha.demo";
const DEFAULT_CHAT_ROOM_ID = "kakaotalk-room.project-alpha";

export async function runKakaoTalkImportBoundary(options = {}) {
  const result = await buildKakaoTalkImportBoundary(options);
  if (options.write !== false) await writeKakaoTalkImportBoundary(result, result.output_dir);
  if (options.check && (!result.validation.valid || result.summary.kakaotalk_import_boundary_status !== "complete")) {
    const error = new Error(`KakaoTalk import boundary validation failed with ${result.validation.errors.length} error(s); status=${result.summary.kakaotalk_import_boundary_status}.`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildKakaoTalkImportBoundary(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_KAKAOTALK_IMPORT_BOUNDARY_OUT_DIR);
  const connectorContractPath = path.resolve(options.connectorContractV2Path ?? DEFAULT_KAKAOTALK_IMPORT_BOUNDARY_INPUTS.connectorContractV2Path);
  const outlookEmailConnectorPath = path.resolve(options.outlookEmailConnectorPath ?? DEFAULT_KAKAOTALK_IMPORT_BOUNDARY_INPUTS.outlookEmailConnectorPath);
  const exportInputs = normalizeInputPaths(options.exportInputs ?? DEFAULT_KAKAOTALK_IMPORT_BOUNDARY_INPUTS.exportInputs);
  const attachmentManifestPath = path.resolve(options.attachmentManifestPath ?? DEFAULT_KAKAOTALK_IMPORT_BOUNDARY_INPUTS.attachmentManifestPath);
  const connectorContract = await readJsonWithRetry(connectorContractPath);
  const outlookEmailConnector = await readJsonWithRetry(outlookEmailConnectorPath);
  const attachmentManifest = await readJsonWithRetry(attachmentManifestPath);
  const kakaoContract = pickKakaoTalkConnectorContract(connectorContract);
  const sourceId = options.sourceId ?? kakaoContract.source_contract?.source_id ?? "source.kakaotalk_export.v2";
  const tenantId = options.tenantId ?? attachmentManifest.tenant_id ?? DEFAULT_TENANT_ID;
  const matterId = options.matterId ?? attachmentManifest.matter_id ?? DEFAULT_MATTER_ID;
  const policySnapshotId = options.policySnapshotId ?? attachmentManifest.policy_snapshot_id ?? DEFAULT_POLICY_SNAPSHOT_ID;
  const exportId = options.exportId ?? attachmentManifest.export_id ?? DEFAULT_EXPORT_ID;
  const chatRoomId = options.chatRoomId ?? attachmentManifest.chat_room_id ?? DEFAULT_CHAT_ROOM_ID;
  const exportItems = await readKakaoExportInputs(exportInputs, {
    sourceId,
    tenantId,
    matterId,
    policySnapshotId,
    exportId,
    chatRoomId,
    generatedAt,
  });
  const connectorContractBinding = buildConnectorContractBinding(kakaoContract, connectorContract, sourceId, generatedAt);
  const sourceBinding = buildSourceBinding(kakaoContract, { sourceId, tenantId, matterId, policySnapshotId, exportInputs, attachmentManifestPath, generatedAt });
  const authBoundary = buildAuthBoundary(kakaoContract.auth_boundary, generatedAt);
  const messageRecords = buildMessageRecords(exportItems, {
    generatedAt,
    connectorId: CONNECTOR_ID,
    sourceId,
    tenantId,
    matterId,
    policySnapshotId,
  });
  const attachmentRecords = buildAttachmentRecords(messageRecords, attachmentManifest.attachment_exports ?? [], generatedAt);
  const conversationRecords = buildConversationRecords(messageRecords, attachmentRecords, generatedAt);
  const cursorState = buildCursorState(kakaoContract.cursor_contract, messageRecords, {
    generatedAt,
    sourceId,
    tenantId,
    matterId,
  });
  const boundary = buildBoundary(generatedAt);
  const docsAndCode = await readDocsAndCode(options);
  const validationItems = validateKakaoTalkImportBoundary({
    connectorContract,
    outlookEmailConnector,
    kakaoContract,
    connectorContractBinding,
    sourceBinding,
    authBoundary,
    messageRecords,
    attachmentRecords,
    conversationRecords,
    cursorState,
    boundary,
    docsAndCode,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeKakaoTalkImportBoundary({
    outlookEmailConnector,
    authBoundary,
    messageRecords,
    attachmentRecords,
    conversationRecords,
    cursorState,
    boundary,
    validation,
    sourceId,
  });

  const result = {
    schema_version: "kakaotalk-import-boundary.v1",
    generated_at: generatedAt,
    kakaotalk_import_boundary_id: `kakaotalk-import-boundary.${dateStamp(generatedAt)}`,
    connector_id: CONNECTOR_ID,
    connector_status: summary.kakaotalk_import_boundary_status,
    output_dir: outputDir,
    inputs: {
      connector_contract_v2_path: connectorContractPath,
      outlook_email_connector_path: outlookEmailConnectorPath,
      export_inputs: exportInputs,
      attachment_manifest_path: attachmentManifestPath,
    },
    connector_contract_binding: connectorContractBinding,
    source_binding: sourceBinding,
    auth_boundary: authBoundary,
    kakaotalk_message_records: messageRecords,
    kakaotalk_attachment_records: attachmentRecords,
    kakaotalk_conversation_records: conversationRecords,
    cursor_state: cursorState,
    kakaotalk_import_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };

  return {
    ...result,
    markdown: renderKakaoTalkImportBoundaryMarkdown(result),
  };
}

export async function writeKakaoTalkImportBoundary(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableKakaoTalkImportBoundary(result);
  await writeJson(path.join(outDir, "kakaotalk-import-boundary.json"), serializable);
  await writeJson(path.join(outDir, "kakaotalk-message-records.json"), {
    generated_at: result.generated_at,
    message_record_count: result.kakaotalk_message_records.length,
    kakaotalk_message_records: result.kakaotalk_message_records,
  });
  await writeJson(path.join(outDir, "kakaotalk-attachment-records.json"), {
    generated_at: result.generated_at,
    attachment_record_count: result.kakaotalk_attachment_records.length,
    kakaotalk_attachment_records: result.kakaotalk_attachment_records,
  });
  await writeJson(path.join(outDir, "kakaotalk-conversation-records.json"), {
    generated_at: result.generated_at,
    conversation_record_count: result.kakaotalk_conversation_records.length,
    kakaotalk_conversation_records: result.kakaotalk_conversation_records,
  });
  await writeJson(path.join(outDir, "cursor-state.json"), result.cursor_state);
  await writeJson(path.join(outDir, "auth-boundary.json"), result.auth_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    kakaotalk_import_boundary_id: result.kakaotalk_import_boundary_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runKakaoTalkImportBoundaryCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runKakaoTalkImportBoundary(args);
    console.log(`KakaoTalk import boundary ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.kakaotalk_import_boundary_status}`);
    console.log(`Messages: ${result.summary.message_count}`);
    console.log(`Attachments: ${result.summary.attachment_count}`);
    console.log(`Conversations: ${result.summary.conversation_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function pickKakaoTalkConnectorContract(connectorContract) {
  const byConnectorId = (items = []) => items.find((item) => item.connector_id === CONNECTOR_ID) ?? null;
  return {
    definition: byConnectorId(connectorContract.connector_definitions),
    source_contract: byConnectorId(connectorContract.connector_source_contracts),
    cursor_contract: byConnectorId(connectorContract.connector_cursor_contracts),
    external_id_contract: byConnectorId(connectorContract.connector_external_id_contracts),
    auth_boundary: byConnectorId(connectorContract.connector_auth_boundaries),
  };
}

function buildConnectorContractBinding(kakaoContract, connectorContract, sourceId, generatedAt) {
  return {
    schema_version: "kakaotalk-import-contract-binding.v1",
    binding_status: kakaoContract.definition?.connector_status === "contracted" ? "bound" : "attention",
    connector_id: CONNECTOR_ID,
    source_id: sourceId,
    source_system: "kakaotalk",
    connector_family: "kakaotalk_export",
    phase_slot: CONNECTOR_PHASE,
    connector_contract_version: connectorContract.schema_version,
    interface_schema_version: connectorContract.connector_interface_schema?.schema_version ?? null,
    source_contract_status: kakaoContract.source_contract?.source_contract_status ?? "unknown",
    cursor_contract_status: kakaoContract.cursor_contract?.cursor_contract_status ?? "unknown",
    external_id_contract_status: kakaoContract.external_id_contract?.external_id_contract_status ?? "unknown",
    auth_boundary_status: kakaoContract.auth_boundary?.auth_boundary_status ?? "unknown",
    generated_at: generatedAt,
  };
}

function buildSourceBinding(kakaoContract, context) {
  return {
    schema_version: "kakaotalk-import-source-binding.v1",
    source_binding_status: kakaoContract.source_contract?.source_contract_status === "contracted" ? "bound" : "attention",
    connector_id: CONNECTOR_ID,
    source_id: context.sourceId,
    source_system: "kakaotalk",
    source_kind: "export_file",
    tenant_id: context.tenantId,
    matter_id: context.matterId,
    policy_snapshot_id: context.policySnapshotId,
    source_inputs: context.exportInputs,
    attachment_manifest_path: context.attachmentManifestPath,
    source_id_strategy: kakaoContract.source_contract?.source_id_strategy ?? "deterministic_connector_source_id",
    tenant_id_required: true,
    matter_id_required: true,
    classification_required: true,
    policy_snapshot_required: true,
    source_uri_template: kakaoContract.source_contract?.source_uri_template ?? "kakaotalk://{tenant_id}/{export_id}/{line_number}",
    resource_id_template: kakaoContract.source_contract?.resource_id_template ?? "resource.kakaotalk_export.{external_id_hash}",
    generated_at: context.generatedAt,
  };
}

function buildAuthBoundary(authContract, generatedAt) {
  return {
    schema_version: "kakaotalk-import-auth-boundary.v1",
    auth_boundary_id: authContract?.auth_boundary_id ?? "auth.kakaotalk_export.v2",
    auth_boundary_status: authContract?.auth_boundary_status ?? "unknown",
    auth_mode: authContract?.auth_mode ?? "operator_provided_export",
    credential_ref_required: false,
    credential_reference_only: true,
    credential_material_read: false,
    raw_secret_material_allowed: false,
    least_privilege_scopes: authContract?.least_privilege_scopes ?? ["export.file.read"],
    external_network_access_required_for_runtime: false,
    external_network_access_performed: false,
    kakaotalk_app_execution_performed: false,
    connector_execution_performed: true,
    local_export_read_performed: true,
    read_operations_allowed: true,
    write_operations_allowed: false,
    source_mutation_performed: false,
    protected_action_allowed: false,
    delivery_execution_allowed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_required_for_resource_projection: true,
    generated_at: generatedAt,
  };
}

async function readKakaoExportInputs(inputPaths, context) {
  const items = [];
  for (const inputPath of inputPaths) {
    items.push(...(await readKakaoExportInputPath(inputPath, context)));
  }
  return items.sort((a, b) => a.source_path.localeCompare(b.source_path) || a.source_line_number - b.source_line_number);
}

async function readKakaoExportInputPath(inputPath, context) {
  const absolutePath = path.resolve(inputPath);
  const info = await stat(absolutePath);
  if (info.isDirectory()) {
    const entries = await readdir(absolutePath);
    const results = [];
    for (const entry of entries.sort()) {
      const childPath = path.join(absolutePath, entry);
      const childInfo = await stat(childPath);
      if (childInfo.isDirectory()) {
        results.push(...(await readKakaoExportInputPath(childPath, context)));
      } else if (/\.txt$/i.test(entry)) {
        results.push(...(await readKakaoExportInputPath(childPath, context)));
      }
    }
    return results;
  }

  if (/\.txt$/i.test(absolutePath)) {
    const raw = await readFile(absolutePath, "utf8");
    return parseKakaoExportWithOffsets(raw, absolutePath, context);
  }

  throw new Error(`Unsupported KakaoTalk export input: ${inputPath}`);
}

function parseKakaoExportWithOffsets(raw, inputPath, context) {
  const parserMessages = parseKakaoTalkExport(raw, {
    matterId: context.matterId,
    sourceId: context.sourceId,
  });
  const lines = String(raw ?? "").replace(/\r\n/g, "\n").split("\n");
  const items = [];
  let currentDate = null;
  let lastItem = null;

  lines.forEach((rawLine, index) => {
    const line = rawLine.trimEnd();
    if (!line.trim()) return;

    const dividerDate = parseDateFromText(line);
    if (/[-=]{3,}/.test(line) && dividerDate) {
      currentDate = dividerDate;
      lastItem = null;
      return;
    }

    const parsed = parseBracketLine(line, currentDate) ?? parseColonLine(line) ?? parseCommaLine(line);
    if (parsed) {
      currentDate = parsed.date ?? currentDate;
      const sourceLineNumber = index + 1;
      const messageOrdinal = items.length + 1;
      const exportId = context.exportId;
      const messageId = `${exportId}:line:${sourceLineNumber}`;
      lastItem = {
        source_format: "kakaotalk_txt_export",
        source_path: inputPath,
        tenant_id: context.tenantId,
        matter_id: context.matterId,
        policy_snapshot_id: context.policySnapshotId,
        export_id: exportId,
        chat_room_id: context.chatRoomId,
        message_id: messageId,
        source_line_number: sourceLineNumber,
        line_offset: sourceLineNumber,
        message_ordinal: messageOrdinal,
        message_date: parsed.date ?? currentDate,
        message_time: parsed.time ?? null,
        author: parsed.author,
        text: parsed.text,
        parsed_intake_message_count: parserMessages.length,
        generated_at: context.generatedAt,
      };
      items.push(lastItem);
      return;
    }

    if (lastItem) {
      lastItem.text = `${lastItem.text}\n${line.trim()}`.trim();
    }
  });

  return items.filter((item) => item.message_date && item.text);
}

function parseBracketLine(line, currentDate) {
  const match = line.match(/^\[(?<author>[^\]]+)\]\s*\[(?<ampm>AM|PM|am|pm|오전|오후)?\s*(?<hour>\d{1,2}):(?<minute>\d{2})\]\s*(?<text>.*)$/);
  if (!match || !currentDate) return null;
  return {
    date: currentDate,
    time: normalizeTime(match.groups.hour, match.groups.minute, match.groups.ampm),
    author: match.groups.author.trim(),
    text: match.groups.text.trim(),
  };
}

function parseColonLine(line) {
  const match = line.match(/^(?<date>20\d{2}-\d{1,2}-\d{1,2})\s+(?<hour>\d{1,2}):(?<minute>\d{2})\s+(?<author>[^:]+):\s*(?<text>.*)$/);
  if (!match) return null;
  return {
    date: parseDateFromText(match.groups.date),
    time: normalizeTime(match.groups.hour, match.groups.minute),
    author: match.groups.author.trim(),
    text: match.groups.text.trim(),
  };
}

function parseCommaLine(line) {
  const match = line.match(/^(?<date>20\d{2}\.\s*\d{1,2}\.\s*\d{1,2}\.)\s*(?<ampm>AM|PM|am|pm|오전|오후)?\s*(?<hour>\d{1,2}):(?<minute>\d{2}),\s*(?<author>[^:]+)\s*:\s*(?<text>.*)$/);
  if (!match) return null;
  return {
    date: parseDateFromText(match.groups.date),
    time: normalizeTime(match.groups.hour, match.groups.minute, match.groups.ampm),
    author: match.groups.author.trim(),
    text: match.groups.text.trim(),
  };
}

function buildMessageRecords(exportItems, context) {
  return exportItems.map((item, index) => {
    const externalId = buildExternalId(context.sourceId, item.export_id, item.source_line_number);
    const externalVersionId = buildExternalVersionId(item, externalId);
    const resourceId = `resource.kakaotalk.message.${shortHash(externalId)}`;
    return {
      schema_version: "kakaotalk-message-record.v1",
      message_record_id: `kakaotalk-message.${shortHash(`${externalId}:${index}`)}`,
      connector_id: context.connectorId,
      source_id: context.sourceId,
      tenant_id: item.tenant_id ?? context.tenantId,
      matter_id: item.matter_id ?? context.matterId,
      policy_snapshot_id: item.policy_snapshot_id ?? context.policySnapshotId,
      source_system: "kakaotalk",
      source_format: item.source_format,
      source_path: item.source_path,
      export_id: item.export_id,
      chat_room_id: item.chat_room_id,
      external_id: externalId,
      external_version_id: externalVersionId,
      resource_id: resourceId,
      resource_version_id: `${resourceId}.v.${shortHash(externalVersionId)}`,
      resource_type: "chat_message",
      message_status: "resource_candidate_ready",
      chat_resource_status: "ready",
      resource_projection_status: "ready",
      review_status: "needs_review",
      message_id: item.message_id,
      source_line_number: item.source_line_number,
      line_offset: item.line_offset,
      message_ordinal: item.message_ordinal,
      message_date: item.message_date,
      message_time: item.message_time,
      author: item.author,
      text_preview: previewText(item.text),
      text_hash_sha256: hashValue(item.text),
      classification: "confidential",
      attachment_count: 0,
      idempotency_key: hashValue(`${externalId}:${externalVersionId}`),
      metadata_complete: Boolean(item.message_date && item.author && item.text && item.source_line_number),
      parsed_intake_message_count: item.parsed_intake_message_count,
      human_review_required: true,
      source_mutation_performed: false,
      resource_mutation_performed: false,
      client_facing_output_generated: false,
      audit_trail: buildAuditTrail("kakaotalk_export_message_line", `${item.source_path}:${item.source_line_number}`, context.generatedAt),
      generated_at: context.generatedAt,
    };
  });
}

function buildAttachmentRecords(messageRecords, attachmentExports, generatedAt) {
  const byLine = new Map(messageRecords.map((message) => [message.source_line_number, message]));
  const records = attachmentExports.map((attachment, index) => {
    const message = byLine.get(attachment.message_line);
    const parentExternalId = message?.external_id ?? `missing-message-line:${attachment.message_line}`;
    const externalId = `${parentExternalId}:attachment:${attachment.export_item_id ?? slug(attachment.file_name)}:${index}`;
    const externalVersionId = `${externalId}:version:${shortHash(`${attachment.file_name}:${attachment.size_bytes ?? 0}:${attachment.exported_path ?? ""}`)}`;
    const resourceId = `resource.kakaotalk.attachment.${shortHash(externalId)}`;
    return {
      schema_version: "kakaotalk-attachment-record.v1",
      attachment_record_id: `kakaotalk-attachment.${shortHash(`${externalId}:${index}`)}`,
      message_record_id: message?.message_record_id ?? null,
      connector_id: CONNECTOR_ID,
      source_id: message?.source_id ?? null,
      tenant_id: message?.tenant_id ?? null,
      matter_id: message?.matter_id ?? null,
      policy_snapshot_id: message?.policy_snapshot_id ?? null,
      source_system: "kakaotalk",
      source_format: "operator_attachment_manifest",
      export_id: attachment.export_id ?? message?.export_id ?? DEFAULT_EXPORT_ID,
      chat_room_id: attachment.chat_room_id ?? message?.chat_room_id ?? DEFAULT_CHAT_ROOM_ID,
      parent_message_external_id: message?.external_id ?? null,
      parent_message_resource_id: message?.resource_id ?? null,
      parent_message_line: attachment.message_line,
      attachment_id: attachment.export_item_id ?? `attachment.${shortHash(externalId)}`,
      attachment_name: attachment.file_name,
      attachment_content_type: attachment.content_type ?? "application/octet-stream",
      attachment_size_bytes: attachment.size_bytes ?? 0,
      exported_path: attachment.exported_path ?? null,
      external_id: externalId,
      external_version_id: externalVersionId,
      resource_id: resourceId,
      resource_version_id: `${resourceId}.v.${shortHash(externalVersionId)}`,
      resource_type: "chat_attachment",
      attachment_status: "resource_candidate_ready",
      chat_resource_status: "ready",
      resource_projection_status: "ready",
      content_materialization_status: "operator_export_metadata_only_pending_human_review",
      attachment_content_read_performed: false,
      source_mutation_performed: false,
      resource_mutation_performed: false,
      review_status: "needs_review",
      human_review_required: true,
      audit_trail: buildAuditTrail("kakaotalk_export_attachment_manifest", attachment.exported_path ?? attachment.file_name, generatedAt),
      generated_at: generatedAt,
    };
  });

  const countsByMessage = new Map();
  for (const attachment of records) {
    if (!attachment.message_record_id) continue;
    countsByMessage.set(attachment.message_record_id, (countsByMessage.get(attachment.message_record_id) ?? 0) + 1);
  }
  for (const message of messageRecords) {
    message.attachment_count = countsByMessage.get(message.message_record_id) ?? 0;
  }

  return records;
}

function buildConversationRecords(messageRecords, attachmentRecords, generatedAt) {
  const byRoom = new Map();
  for (const message of messageRecords) {
    if (!byRoom.has(message.chat_room_id)) byRoom.set(message.chat_room_id, []);
    byRoom.get(message.chat_room_id).push(message);
  }
  return [...byRoom.entries()].map(([chatRoomId, messages]) => {
    const sortedMessages = [...messages].sort((a, b) => a.source_line_number - b.source_line_number);
    const roomAttachments = attachmentRecords.filter((attachment) => attachment.chat_room_id === chatRoomId);
    return {
      schema_version: "kakaotalk-conversation-record.v1",
      conversation_record_id: `kakaotalk-conversation.${shortHash(chatRoomId)}`,
      connector_id: CONNECTOR_ID,
      source_id: sortedMessages[0]?.source_id ?? null,
      tenant_id: sortedMessages[0]?.tenant_id ?? null,
      matter_id: sortedMessages[0]?.matter_id ?? null,
      policy_snapshot_id: sortedMessages[0]?.policy_snapshot_id ?? null,
      source_system: "kakaotalk",
      export_id: sortedMessages[0]?.export_id ?? DEFAULT_EXPORT_ID,
      chat_room_id: chatRoomId,
      conversation_status: "complete",
      message_count: sortedMessages.length,
      attachment_count: roomAttachments.length,
      message_record_ids: sortedMessages.map((message) => message.message_record_id),
      attachment_record_ids: roomAttachments.map((attachment) => attachment.attachment_record_id),
      participants: [...new Set(sortedMessages.map((message) => message.author).filter(Boolean))].sort(),
      first_line_number: sortedMessages[0]?.source_line_number ?? null,
      last_line_number: sortedMessages.at(-1)?.source_line_number ?? null,
      first_message_date: sortedMessages[0]?.message_date ?? null,
      last_message_date: sortedMessages.at(-1)?.message_date ?? null,
      resource_projection_status: "ready",
      review_status: "needs_review",
      human_review_required: true,
      source_mutation_performed: false,
      resource_mutation_performed: false,
      audit_trail: buildAuditTrail("kakaotalk_export_conversation", chatRoomId, generatedAt),
      generated_at: generatedAt,
    };
  });
}

function buildCursorState(cursorContract, messageRecords, context) {
  const lastSeen = messageRecords.at(-1) ?? null;
  const cursorPayload = {
    source_id: context.sourceId,
    last_seen_external_id: lastSeen?.external_id ?? null,
    last_line_number: lastSeen?.source_line_number ?? 0,
    message_count: messageRecords.length,
  };
  return {
    schema_version: "kakaotalk-import-cursor-state.v1",
    cursor_id: cursorContract?.cursor_id ?? "cursor.kakaotalk_export.v2",
    cursor_status: "complete",
    cursor_kind: cursorContract?.cursor_kind ?? "export_line_offset_cursor",
    connector_id: CONNECTOR_ID,
    source_id: context.sourceId,
    tenant_id: context.tenantId,
    matter_id: context.matterId,
    queued_count: 0,
    last_seen_external_id: lastSeen?.external_id ?? null,
    last_line_number: lastSeen?.source_line_number ?? 0,
    resume_supported: true,
    cursor_storage_mode: "line_offset_hash_only",
    resume_token_hash: hashValue(JSON.stringify(cursorPayload)),
    raw_export_cursor_material_allowed: false,
    cross_matter_cursor_reuse_allowed: false,
    reset_requires_human_review: true,
    external_network_access_performed: false,
    source_mutation_performed: false,
    updated_at: context.generatedAt,
  };
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "kakaotalk-import-boundary.v1",
    boundary_status: "enforced",
    phase_slot: CONNECTOR_PHASE,
    operator_export_only: true,
    import_boundary_only: true,
    kakaotalk_app_execution_performed: false,
    live_chat_api_execution_performed: false,
    local_export_read_performed: true,
    connector_execution_performed: true,
    source_read_performed: true,
    source_mutation_performed: false,
    external_network_access_performed: false,
    credential_material_read: false,
    raw_secret_material_allowed: false,
    resource_mutation_performed: false,
    artifact_write_performed: true,
    output_delivery_performed: false,
    protected_action_executed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_required: true,
    generated_at: generatedAt,
  };
}

async function readDocsAndCode(options) {
  const inputs = {
    package_path: path.resolve(options.packagePath ?? DEFAULT_KAKAOTALK_IMPORT_BOUNDARY_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_KAKAOTALK_IMPORT_BOUNDARY_INPUTS.roadmapPath),
    final_ledger_path: path.resolve(options.finalLedgerPath ?? DEFAULT_KAKAOTALK_IMPORT_BOUNDARY_INPUTS.finalLedgerPath),
    control_plane_loop_path: path.resolve(options.controlPlaneLoopPath ?? DEFAULT_KAKAOTALK_IMPORT_BOUNDARY_INPUTS.controlPlaneLoopPath),
    review_dashboard_path: path.resolve(options.reviewDashboardPath ?? DEFAULT_KAKAOTALK_IMPORT_BOUNDARY_INPUTS.reviewDashboardPath),
    review_api_path: path.resolve(options.reviewApiPath ?? DEFAULT_KAKAOTALK_IMPORT_BOUNDARY_INPUTS.reviewApiPath),
  };
  return {
    package_json: JSON.parse(await readTextWithRetry(inputs.package_path)),
    roadmap_text: await readTextWithRetry(inputs.roadmap_path),
    final_ledger_text: await readTextWithRetry(inputs.final_ledger_path),
    control_plane_loop_text: await readTextWithRetry(inputs.control_plane_loop_path),
    review_dashboard_text: await readTextWithRetry(inputs.review_dashboard_path),
    review_api_text: await readTextWithRetry(inputs.review_api_path),
  };
}

function validateKakaoTalkImportBoundary({ connectorContract, outlookEmailConnector, kakaoContract, connectorContractBinding, sourceBinding, authBoundary, messageRecords, attachmentRecords, conversationRecords, cursorState, boundary, docsAndCode }) {
  const items = [];
  pushCheck(items, "connector_contract.kakaotalk_export", kakaoContract.definition?.connector_status === "contracted" && kakaoContract.definition?.phase_slot === CONNECTOR_PHASE, "P267 connector contract includes connector.kakaotalk_export.v2 for P271.");
  pushCheck(items, "connector_contract.source", kakaoContract.source_contract?.source_id === sourceBinding.source_id && sourceBinding.source_binding_status === "bound", "KakaoTalk export source_id is bound to the P267 source contract.");
  pushCheck(items, "connector_contract.cursor", kakaoContract.cursor_contract?.cursor_kind === "export_line_offset_cursor" && cursorState.resume_supported === true && cursorState.raw_export_cursor_material_allowed === false, "KakaoTalk import boundary uses resumable export line-offset cursor semantics without raw cursor material.");
  pushCheck(items, "connector_contract.external_id", kakaoContract.external_id_contract?.external_id_contract_status === "contracted" && [...messageRecords, ...attachmentRecords].every((row) => row.external_id && row.external_version_id && row.resource_id && row.resource_version_id), "Every KakaoTalk message and attachment has an external_id/resource projection candidate.");
  pushCheck(items, "connector_contract.auth_boundary", authBoundary.auth_boundary_status === "enforced" && authBoundary.auth_mode === "operator_provided_export" && authBoundary.credential_ref_required === false && authBoundary.raw_secret_material_allowed === false, "KakaoTalk auth boundary is operator-export-only, credential-free, and raw-secret-free.");
  pushCheck(items, "windows_baseline.outlook_email", outlookEmailConnector.summary?.outlook_email_connector_status === "complete" && outlookEmailConnector.summary?.external_network_access_performed === false && outlookEmailConnector.summary?.source_mutation_performed === false, "P270 Outlook Email Connector baseline remains complete and non-mutating before P271.");
  pushCheck(items, "binding.phase", connectorContractBinding.binding_status === "bound" && connectorContractBinding.phase_slot === CONNECTOR_PHASE, "KakaoTalk import boundary binding is attached to P271.");
  pushCheck(items, "messages.present", messageRecords.length > 0 && messageRecords.every((message) => message.message_status === "resource_candidate_ready" && message.resource_type === "chat_message"), "KakaoTalk messages are projected as chat message resource candidates.");
  pushCheck(items, "messages.metadata", messageRecords.every((message) => message.metadata_complete && message.author && message.message_date && message.source_line_number > 0), "KakaoTalk message metadata includes author, date, and source line offsets.");
  pushCheck(items, "attachments.present", attachmentRecords.length > 0 && attachmentRecords.every((attachment) => attachment.attachment_status === "resource_candidate_ready" && attachment.resource_type === "chat_attachment" && attachment.parent_message_resource_id), "KakaoTalk attachments are projected as attachment resource candidates linked to messages.");
  pushCheck(items, "conversations.present", conversationRecords.length > 0 && conversationRecords.every((conversation) => conversation.conversation_status === "complete" && conversation.message_count > 0 && conversation.chat_room_id), "KakaoTalk conversation records group message and attachment membership.");
  pushCheck(items, "resources.review_gate", [...messageRecords, ...attachmentRecords, ...conversationRecords].every((row) => row.review_status === "needs_review" && row.human_review_required), "Message, attachment, and conversation projections remain human-review gated.");
  pushCheck(items, "boundary.no_live_app_or_secret", boundary.kakaotalk_app_execution_performed === false && boundary.external_network_access_performed === false && boundary.credential_material_read === false && authBoundary.raw_secret_material_allowed === false, "KakaoTalk artifact performs no live app/API call, network access, credential read, or raw secret handling.");
  pushCheck(items, "boundary.no_mutation_or_delivery", boundary.source_mutation_performed === false && boundary.resource_mutation_performed === false && boundary.output_delivery_performed === false && boundary.protected_action_executed === false, "KakaoTalk artifact performs no source/resource mutation, delivery, or protected action.");
  pushCheck(items, "boundary.no_legal_or_client_output", boundary.legal_advice_generated === false && boundary.client_facing_output_generated === false && boundary.human_review_required === true, "KakaoTalk artifact produces no legal advice or client-facing output and remains human-review gated.");
  pushCheck(items, "package.script", Boolean(docsAndCode.package_json?.scripts?.["connectors:kakaotalk-import-boundary"]), "package.json registers connectors:kakaotalk-import-boundary.");
  pushCheck(items, "roadmap.slot", typeof docsAndCode.roadmap_text === "string" && docsAndCode.roadmap_text.includes("Phase 271") && docsAndCode.final_ledger_text.includes("P271") && docsAndCode.final_ledger_text.includes("KakaoTalk import boundary"), "Roadmap and final ledger promote P271 KakaoTalk import boundary.");
  pushCheck(items, "loop.bound", docsAndCode.control_plane_loop_text.includes("kakaotalk_import_boundary") && docsAndCode.control_plane_loop_text.includes("connectors:kakaotalk-import-boundary"), "Control-plane loop includes KakaoTalk import boundary.");
  pushCheck(items, "dashboard.bound", docsAndCode.review_dashboard_text.includes("kakaotalk_import_boundary"), "Review Dashboard includes KakaoTalk import boundary.");
  pushCheck(items, "api.bound", docsAndCode.review_api_text.includes("/api/kakaotalk-import-boundary"), "Review API exposes KakaoTalk import boundary routes.");
  pushCheck(items, "contract_source.complete", connectorContract.summary?.connector_contract_status === "complete", "Connector Contract v2 source artifact is complete.");
  return items;
}

function summarizeKakaoTalkImportBoundary({ outlookEmailConnector, authBoundary, messageRecords, attachmentRecords, conversationRecords, cursorState, boundary, validation, sourceId }) {
  const resourceCandidateCount = messageRecords.length + attachmentRecords.length;
  const status = validation.errors.length > 0 ? "attention" : "complete";
  return {
    kakaotalk_import_boundary_status: status,
    connector_id: CONNECTOR_ID,
    source_id: sourceId,
    phase_slot: CONNECTOR_PHASE,
    source_outlook_email_connector_status: outlookEmailConnector.summary?.outlook_email_connector_status ?? "unknown",
    message_count: messageRecords.length,
    attachment_count: attachmentRecords.length,
    conversation_count: conversationRecords.length,
    author_count: new Set(messageRecords.map((message) => message.author).filter(Boolean)).size,
    message_resource_count: messageRecords.filter((message) => message.resource_id).length,
    attachment_resource_count: attachmentRecords.filter((attachment) => attachment.resource_id).length,
    resource_candidate_count: resourceCandidateCount,
    metadata_complete_message_count: messageRecords.filter((message) => message.metadata_complete).length,
    line_offset_count: messageRecords.filter((message) => message.source_line_number > 0).length,
    attachment_parent_link_count: attachmentRecords.filter((attachment) => attachment.parent_message_resource_id).length,
    conversation_message_link_count: conversationRecords.reduce((sum, conversation) => sum + conversation.message_record_ids.length, 0),
    cursor_status: cursorState.cursor_status,
    cursor_kind: cursorState.cursor_kind,
    cursor_resume_supported: cursorState.resume_supported,
    last_line_number: cursorState.last_line_number,
    raw_export_cursor_material_allowed: cursorState.raw_export_cursor_material_allowed,
    auth_boundary_status: authBoundary.auth_boundary_status,
    credential_ref_required: authBoundary.credential_ref_required,
    credential_reference_only: authBoundary.credential_reference_only,
    raw_secret_material_allowed: authBoundary.raw_secret_material_allowed,
    least_privilege_scope_count: authBoundary.least_privilege_scopes.length,
    read_operations_allowed: authBoundary.read_operations_allowed,
    write_operations_allowed: authBoundary.write_operations_allowed,
    external_network_access_required_for_runtime: authBoundary.external_network_access_required_for_runtime,
    operator_export_only: boundary.operator_export_only,
    import_boundary_only: boundary.import_boundary_only,
    local_export_read_performed: boundary.local_export_read_performed,
    kakaotalk_app_execution_performed: boundary.kakaotalk_app_execution_performed,
    live_chat_api_execution_performed: boundary.live_chat_api_execution_performed,
    external_network_access_performed: boundary.external_network_access_performed,
    connector_execution_performed: boundary.connector_execution_performed,
    source_read_performed: boundary.source_read_performed,
    credential_material_read: boundary.credential_material_read,
    source_mutation_performed: boundary.source_mutation_performed,
    resource_mutation_performed: boundary.resource_mutation_performed,
    output_delivery_performed: boundary.output_delivery_performed,
    protected_action_executed: boundary.protected_action_executed,
    legal_advice_generated: boundary.legal_advice_generated,
    client_facing_output_generated: boundary.client_facing_output_generated,
    human_review_required_count: [...messageRecords, ...attachmentRecords].filter((row) => row.human_review_required).length,
    validation_item_count: validation.items.length,
    validation_error_count: validation.errors.length,
  };
}

function renderKakaoTalkImportBoundaryMarkdown(result) {
  const lines = [];
  lines.push("# KakaoTalk Import Boundary");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.kakaotalk_import_boundary_status}`);
  lines.push(`Connector: ${result.connector_id}`);
  lines.push(`Source: ${result.summary.source_id}`);
  lines.push(`Messages: ${result.summary.message_count}`);
  lines.push(`Attachments: ${result.summary.attachment_count}`);
  lines.push(`Conversations: ${result.summary.conversation_count}`);
  lines.push("");
  lines.push("## Boundary");
  lines.push("");
  lines.push("- The artifact reads only operator-provided KakaoTalk text exports and attachment manifests.");
  lines.push("- It does not execute the KakaoTalk app, call live chat APIs, access the network, read credentials, mutate sources, deliver outputs, or perform protected actions.");
  lines.push("- Message, attachment, and conversation resource candidates remain human-review gated.");
  lines.push("- The artifact does not provide legal advice and does not create client-facing work product.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { exportInputs: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--connector-contract-v2") parsed.connectorContractV2Path = argv[++index];
    else if (arg === "--outlook-email-connector") parsed.outlookEmailConnectorPath = argv[++index];
    else if (arg === "--export-input") parsed.exportInputs.push(argv[++index]);
    else if (arg === "--attachment-manifest") parsed.attachmentManifestPath = argv[++index];
    else if (arg === "--source-id") parsed.sourceId = argv[++index];
    else if (arg === "--tenant-id") parsed.tenantId = argv[++index];
    else if (arg === "--matter-id") parsed.matterId = argv[++index];
    else if (arg === "--policy-snapshot-id") parsed.policySnapshotId = argv[++index];
    else if (arg === "--export-id") parsed.exportId = argv[++index];
    else if (arg === "--chat-room-id") parsed.chatRoomId = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (parsed.exportInputs.length === 0) delete parsed.exportInputs;
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/kakaotalk-import-boundary.mjs [options]

Options:
  --check                         Fail unless the boundary reaches complete status.
  --out-dir <folder>              Output directory.
  --connector-contract-v2 <path>  Connector Contract v2 artifact.
  --outlook-email-connector <path> P270 Outlook Email Connector artifact.
  --export-input <path>           Local KakaoTalk txt export file or folder. Can be repeated.
  --attachment-manifest <path>    Attachment manifest JSON.
  --source-id <id>                Connector source id.
  --tenant-id <id>                Tenant id for connector rows.
  --matter-id <id>                Matter id for connector rows.
  --policy-snapshot-id <id>       Policy snapshot id.
  --export-id <id>                Stable export id.
  --chat-room-id <id>             Stable chat room id.
  --run-at <iso>                  Deterministic generated_at timestamp.
`);
}

function parseDateFromText(value) {
  const dotted = String(value).match(/(20\d{2})\.\s*(\d{1,2})\.\s*(\d{1,2})\./);
  if (dotted) return formatDate(dotted[1], dotted[2], dotted[3]);
  const iso = String(value).match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);
  if (iso) return formatDate(iso[1], iso[2], iso[3]);
  return null;
}

function normalizeTime(hour, minute, ampm = "") {
  let h = Number.parseInt(hour, 10);
  const marker = String(ampm ?? "").toLowerCase();
  if ((marker === "pm" || marker === "오후") && h < 12) h += 12;
  if ((marker === "am" || marker === "오전") && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${minute}`;
}

function formatDate(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildExternalId(sourceId, exportId, lineNumber) {
  return `${sourceId}:${exportId}:line:${lineNumber}`;
}

function buildExternalVersionId(item, externalId) {
  return `${externalId}:version:${shortHash(`${item.message_date}:${item.message_time}:${item.author}:${item.text}`)}`;
}

function buildAuditTrail(sourceType, sourceRef, generatedAt) {
  return {
    source: sourceRef,
    source_type: sourceType,
    timestamp: generatedAt,
    confidence: "high",
    responsible_owner: "connector.kakaotalk_export.v2",
    review_status: "needs_review",
  };
}

async function readJsonWithRetry(filePath) {
  return JSON.parse(await readTextWithRetry(filePath));
}

async function readTextWithRetry(filePath, attempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await readFile(filePath, "utf8");
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableKakaoTalkImportBoundary(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function pushCheck(items, checkpointId, passed, message) {
  items.push({
    checkpoint_id: checkpointId,
    status: passed ? "passed" : "failed",
    message,
  });
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({
      path: item.checkpoint_id,
      message: item.message,
    }));
  return {
    valid: errors.length === 0,
    errors,
    items,
  };
}

function normalizeInputPaths(inputPaths) {
  return inputPaths.map((inputPath) => path.resolve(inputPath));
}

function previewText(value, length = 280) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 1)}...` : text;
}

function hashValue(value) {
  return `sha256:${createHash("sha256").update(String(value ?? "")).digest("hex")}`;
}

function shortHash(value, length = 12) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, length);
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "attachment";
}
