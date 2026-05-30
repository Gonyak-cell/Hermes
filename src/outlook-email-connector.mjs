import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_OUTLOOK_EMAIL_CONNECTOR_OUT_DIR = "artifacts/outlook-email-connector/latest";
export const DEFAULT_OUTLOOK_EMAIL_CONNECTOR_INPUTS = {
  connectorContractV2Path: "artifacts/connector-contract-v2/latest/connector-contract-v2.json",
  onedriveConnectorBoundaryPath: "artifacts/onedrive-connector-boundary/latest/onedrive-connector-boundary.json",
  emailInputs: ["examples/outlook-email-connector"],
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
  finalLedgerPath: "docs/final-completion-phase-ledger.md",
  controlPlaneLoopPath: "src/control-plane-loop.mjs",
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiPath: "src/review-api.mjs",
};

const CONNECTOR_ID = "connector.outlook_email.v2";
const CONNECTOR_PHASE = "P270";
const DEFAULT_TENANT_ID = "tenant.hermes.outlook.demo";
const DEFAULT_MATTER_ID = "matter.outlook.demo";
const DEFAULT_POLICY_SNAPSHOT_ID = "policy.outlook_email_connector.default.v1";

export async function runOutlookEmailConnector(options = {}) {
  const result = await buildOutlookEmailConnector(options);
  if (options.write !== false) await writeOutlookEmailConnector(result, result.output_dir);
  if (options.check && (!result.validation.valid || result.summary.outlook_email_connector_status !== "complete")) {
    const error = new Error(`Outlook email connector validation failed with ${result.validation.errors.length} error(s); status=${result.summary.outlook_email_connector_status}.`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildOutlookEmailConnector(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_OUTLOOK_EMAIL_CONNECTOR_OUT_DIR);
  const connectorContractPath = path.resolve(options.connectorContractV2Path ?? DEFAULT_OUTLOOK_EMAIL_CONNECTOR_INPUTS.connectorContractV2Path);
  const onedriveConnectorBoundaryPath = path.resolve(options.onedriveConnectorBoundaryPath ?? DEFAULT_OUTLOOK_EMAIL_CONNECTOR_INPUTS.onedriveConnectorBoundaryPath);
  const emailInputs = normalizeInputPaths(options.emailInputs ?? DEFAULT_OUTLOOK_EMAIL_CONNECTOR_INPUTS.emailInputs);
  const connectorContract = await readJsonWithRetry(connectorContractPath);
  const onedriveConnectorBoundary = await readJsonWithRetry(onedriveConnectorBoundaryPath);
  const outlookContract = pickOutlookConnectorContract(connectorContract);
  const sourceId = options.sourceId ?? outlookContract.source_contract?.source_id ?? "source.outlook_email.v2";
  const tenantId = options.tenantId ?? DEFAULT_TENANT_ID;
  const matterId = options.matterId ?? DEFAULT_MATTER_ID;
  const policySnapshotId = options.policySnapshotId ?? DEFAULT_POLICY_SNAPSHOT_ID;
  const emailSourceItems = await readEmailInputs(emailInputs, {
    sourceId,
    tenantId,
    matterId,
    policySnapshotId,
    generatedAt,
  });
  const connectorContractBinding = buildConnectorContractBinding(outlookContract, connectorContract, sourceId, generatedAt);
  const sourceBinding = buildSourceBinding(outlookContract, { sourceId, tenantId, matterId, policySnapshotId, emailInputs, generatedAt });
  const authBoundary = buildAuthBoundary(outlookContract.auth_boundary, generatedAt);
  const messageRecords = buildMessageRecords(emailSourceItems, {
    generatedAt,
    connectorId: CONNECTOR_ID,
    sourceId,
    tenantId,
    matterId,
    policySnapshotId,
  });
  const attachmentRecords = buildAttachmentRecords(messageRecords, generatedAt);
  const threadRecords = buildThreadRecords(messageRecords, attachmentRecords, generatedAt);
  const cursorState = buildCursorState(outlookContract.cursor_contract, messageRecords, {
    generatedAt,
    sourceId,
    tenantId,
    matterId,
  });
  const boundary = buildBoundary(generatedAt);
  const docsAndCode = await readDocsAndCode(options);
  const validationItems = validateOutlookEmailConnector({
    connectorContract,
    onedriveConnectorBoundary,
    outlookContract,
    connectorContractBinding,
    sourceBinding,
    authBoundary,
    messageRecords,
    attachmentRecords,
    threadRecords,
    cursorState,
    boundary,
    docsAndCode,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeOutlookEmailConnector({
    onedriveConnectorBoundary,
    authBoundary,
    messageRecords,
    attachmentRecords,
    threadRecords,
    cursorState,
    boundary,
    validation,
    sourceId,
  });

  const result = {
    schema_version: "outlook-email-connector.v1",
    generated_at: generatedAt,
    outlook_email_connector_id: `outlook-email-connector.${dateStamp(generatedAt)}`,
    connector_id: CONNECTOR_ID,
    connector_status: summary.outlook_email_connector_status,
    output_dir: outputDir,
    inputs: {
      connector_contract_v2_path: connectorContractPath,
      onedrive_connector_boundary_path: onedriveConnectorBoundaryPath,
      email_inputs: emailInputs,
    },
    connector_contract_binding: connectorContractBinding,
    source_binding: sourceBinding,
    auth_boundary: authBoundary,
    outlook_email_message_records: messageRecords,
    outlook_email_attachment_records: attachmentRecords,
    outlook_email_thread_records: threadRecords,
    cursor_state: cursorState,
    outlook_email_connector_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };

  return {
    ...result,
    markdown: renderOutlookEmailConnectorMarkdown(result),
  };
}

export async function writeOutlookEmailConnector(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableOutlookEmailConnector(result);
  await writeJson(path.join(outDir, "outlook-email-connector.json"), serializable);
  await writeJson(path.join(outDir, "email-message-records.json"), {
    generated_at: result.generated_at,
    message_record_count: result.outlook_email_message_records.length,
    outlook_email_message_records: result.outlook_email_message_records,
  });
  await writeJson(path.join(outDir, "email-attachment-records.json"), {
    generated_at: result.generated_at,
    attachment_record_count: result.outlook_email_attachment_records.length,
    outlook_email_attachment_records: result.outlook_email_attachment_records,
  });
  await writeJson(path.join(outDir, "email-thread-records.json"), {
    generated_at: result.generated_at,
    thread_record_count: result.outlook_email_thread_records.length,
    outlook_email_thread_records: result.outlook_email_thread_records,
  });
  await writeJson(path.join(outDir, "cursor-state.json"), result.cursor_state);
  await writeJson(path.join(outDir, "auth-boundary.json"), result.auth_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    outlook_email_connector_id: result.outlook_email_connector_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runOutlookEmailConnectorCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runOutlookEmailConnector(args);
    console.log(`Outlook email connector ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.outlook_email_connector_status}`);
    console.log(`Messages: ${result.summary.message_count}`);
    console.log(`Attachments: ${result.summary.attachment_count}`);
    console.log(`Threads: ${result.summary.thread_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function pickOutlookConnectorContract(connectorContract) {
  const byConnectorId = (items = []) => items.find((item) => item.connector_id === CONNECTOR_ID) ?? null;
  return {
    definition: byConnectorId(connectorContract.connector_definitions),
    source_contract: byConnectorId(connectorContract.connector_source_contracts),
    cursor_contract: byConnectorId(connectorContract.connector_cursor_contracts),
    external_id_contract: byConnectorId(connectorContract.connector_external_id_contracts),
    auth_boundary: byConnectorId(connectorContract.connector_auth_boundaries),
  };
}

function buildConnectorContractBinding(outlookContract, connectorContract, sourceId, generatedAt) {
  return {
    schema_version: "outlook-email-connector-contract-binding.v1",
    binding_status: outlookContract.definition?.connector_status === "contracted" ? "bound" : "attention",
    connector_id: CONNECTOR_ID,
    source_id: sourceId,
    source_system: "outlook",
    connector_family: "outlook_email",
    phase_slot: CONNECTOR_PHASE,
    connector_contract_version: connectorContract.schema_version,
    interface_schema_version: connectorContract.connector_interface_schema?.schema_version ?? null,
    source_contract_status: outlookContract.source_contract?.source_contract_status ?? "unknown",
    cursor_contract_status: outlookContract.cursor_contract?.cursor_contract_status ?? "unknown",
    external_id_contract_status: outlookContract.external_id_contract?.external_id_contract_status ?? "unknown",
    auth_boundary_status: outlookContract.auth_boundary?.auth_boundary_status ?? "unknown",
    generated_at: generatedAt,
  };
}

function buildSourceBinding(outlookContract, context) {
  return {
    schema_version: "outlook-email-source-binding.v1",
    source_binding_status: outlookContract.source_contract?.source_contract_status === "contracted" ? "bound" : "attention",
    connector_id: CONNECTOR_ID,
    source_id: context.sourceId,
    source_system: "outlook",
    source_kind: "mailbox",
    tenant_id: context.tenantId,
    matter_id: context.matterId,
    policy_snapshot_id: context.policySnapshotId,
    source_inputs: context.emailInputs,
    source_id_strategy: outlookContract.source_contract?.source_id_strategy ?? "deterministic_connector_source_id",
    tenant_id_required: true,
    matter_id_required: true,
    classification_required: true,
    policy_snapshot_required: true,
    source_uri_template: outlookContract.source_contract?.source_uri_template ?? "outlook://{tenant_id}/{mailbox_id}/{message_id}",
    resource_id_template: outlookContract.source_contract?.resource_id_template ?? "resource.outlook_email.{external_id_hash}",
    generated_at: context.generatedAt,
  };
}

function buildAuthBoundary(authContract, generatedAt) {
  return {
    schema_version: "outlook-email-auth-boundary.v1",
    auth_boundary_id: authContract?.auth_boundary_id ?? "auth.outlook_email.v2",
    auth_boundary_status: authContract?.auth_boundary_status ?? "unknown",
    auth_mode: authContract?.auth_mode ?? "oauth_delegated_readonly",
    credential_ref_required: true,
    credential_ref_kind: "vault_or_os_keychain_reference",
    credential_reference_only: true,
    credential_material_read: false,
    raw_secret_material_allowed: false,
    least_privilege_scopes: authContract?.least_privilege_scopes ?? ["Mail.Read", "MailboxSettings.Read"],
    external_network_access_required_for_runtime: true,
    external_network_access_performed: false,
    outlook_api_execution_performed: false,
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

async function readEmailInputs(inputPaths, context) {
  const items = [];
  for (const inputPath of inputPaths) {
    items.push(...(await readEmailInputPath(inputPath, context)));
  }
  return items.sort((a, b) => `${a.received_at ?? ""}:${a.source_path}`.localeCompare(`${b.received_at ?? ""}:${b.source_path}`));
}

async function readEmailInputPath(inputPath, context) {
  const absolutePath = path.resolve(inputPath);
  const info = await stat(absolutePath);
  if (info.isDirectory()) {
    const entries = await readdir(absolutePath);
    const results = [];
    for (const entry of entries.sort()) {
      const childPath = path.join(absolutePath, entry);
      const childInfo = await stat(childPath);
      if (childInfo.isDirectory()) {
        results.push(...(await readEmailInputPath(childPath, context)));
      } else if (/\.(eml|json)$/i.test(entry)) {
        results.push(...(await readEmailInputPath(childPath, context)));
      }
    }
    return results;
  }

  if (/\.eml$/i.test(absolutePath)) {
    const raw = await readFile(absolutePath, "utf8");
    return [parseEmlMessage(raw, absolutePath, context)];
  }

  if (/\.json$/i.test(absolutePath)) {
    const raw = await readFile(absolutePath, "utf8");
    return parseGraphMessages(raw, absolutePath, context);
  }

  throw new Error(`Unsupported Outlook email input: ${inputPath}`);
}

function parseEmlMessage(raw, inputPath, context) {
  const { headers, body } = splitEml(raw);
  const subject = decodeMimeWords(headers.subject ?? "(no subject)");
  const messageId = cleanHeaderId(headers["message-id"]) ?? `eml:${path.basename(inputPath)}:${shortHash(raw)}`;
  const inReplyTo = cleanHeaderId(headers["in-reply-to"]);
  const references = parseReferences(headers.references);
  const threadKey = headers["thread-index"] ?? headers["conversation-id"] ?? inReplyTo ?? references[0] ?? normalizeThreadSubject(subject);
  const threadId = buildThreadId(context.sourceId, threadKey);
  const sentAt = normalizeDateTime(headers.date);
  const textBody = cleanEmailBody(extractTextBody(headers, body));
  const attachments = extractEmlAttachments(raw);
  return {
    source_format: "eml",
    source_path: inputPath,
    tenant_id: context.tenantId,
    matter_id: context.matterId,
    policy_snapshot_id: context.policySnapshotId,
    message_id: messageId,
    internet_message_id: messageId,
    conversation_id: headers["conversation-id"] ?? headers["thread-index"] ?? null,
    thread_key: threadKey,
    thread_id: threadId,
    in_reply_to: inReplyTo,
    references,
    subject,
    from: decodeMimeWords(headers.from ?? "unknown"),
    to: parseAddressList(headers.to),
    cc: parseAddressList(headers.cc),
    sent_at: sentAt,
    received_at: sentAt,
    body_preview: previewText(textBody),
    body_hash_sha256: hashValue(textBody),
    attachments,
    classification: "confidential",
    generated_at: context.generatedAt,
  };
}

function parseGraphMessages(raw, inputPath, context) {
  const parsed = JSON.parse(raw);
  const items = Array.isArray(parsed) ? parsed : parsed.value ?? parsed.messages ?? [parsed];
  return items.map((item, index) => normalizeGraphMessage(item, index, inputPath, context));
}

function normalizeGraphMessage(item, index, inputPath, context) {
  const subject = item.subject ?? item.Subject ?? "(no subject)";
  const messageId = cleanHeaderId(item.internetMessageId ?? item.messageId) ?? item.id ?? `graph-json-${index + 1}`;
  const conversationId = item.conversationId ?? item.threadId ?? item.conversation_id ?? null;
  const threadKey = conversationId ?? item.conversationIndex ?? item.inReplyTo ?? normalizeThreadSubject(subject);
  const threadId = buildThreadId(context.sourceId, threadKey);
  const sentAt = normalizeDateTime(item.sentDateTime ?? item.sent_at ?? item.date ?? item.Date);
  const receivedAt = normalizeDateTime(item.receivedDateTime ?? item.received_at ?? item.date ?? item.Date) ?? sentAt;
  const bodyText = cleanEmailBody(String(item.body?.content ?? item.bodyPreview ?? item.Body ?? item.text ?? ""));
  const attachmentItems = item.attachments?.value ?? item.attachments ?? [];
  return {
    source_format: "graph_json",
    source_path: inputPath,
    tenant_id: context.tenantId,
    matter_id: context.matterId,
    policy_snapshot_id: context.policySnapshotId,
    message_id: String(item.id ?? messageId),
    internet_message_id: messageId,
    conversation_id: conversationId,
    thread_key: threadKey,
    thread_id: threadId,
    in_reply_to: cleanHeaderId(item.inReplyTo ?? item.replyToMessageId),
    references: parseReferences(item.references),
    subject,
    from: stringifyGraphAddress(item.from ?? item.sender),
    to: stringifyGraphAddressList(item.toRecipients ?? item.to ?? []),
    cc: stringifyGraphAddressList(item.ccRecipients ?? item.cc ?? []),
    sent_at: sentAt,
    received_at: receivedAt,
    body_preview: previewText(bodyText),
    body_hash_sha256: hashValue(bodyText),
    attachments: attachmentItems.map((attachment, attachmentIndex) => normalizeGraphAttachment(attachment, attachmentIndex)),
    classification: item.classification ?? "confidential",
    generated_at: context.generatedAt,
  };
}

function buildMessageRecords(sourceItems, context) {
  return sourceItems.map((item, index) => {
    const externalId = buildExternalId(context.sourceId, item.internet_message_id ?? item.message_id);
    const externalVersionId = buildExternalVersionId(item, externalId);
    const resourceId = `resource.outlook_email.message.${shortHash(externalId)}`;
    return {
      schema_version: "outlook-email-message-record.v1",
      message_record_id: `outlook-message.${shortHash(`${externalId}:${index}`)}`,
      connector_id: context.connectorId,
      source_id: context.sourceId,
      tenant_id: item.tenant_id ?? context.tenantId,
      matter_id: item.matter_id ?? context.matterId,
      policy_snapshot_id: item.policy_snapshot_id ?? context.policySnapshotId,
      source_system: "outlook",
      source_format: item.source_format,
      source_path: item.source_path,
      external_id: externalId,
      external_version_id: externalVersionId,
      resource_id: resourceId,
      resource_version_id: `${resourceId}.v.${shortHash(externalVersionId)}`,
      resource_type: "email",
      message_status: "resource_candidate_ready",
      email_resource_status: "ready",
      resource_projection_status: "ready",
      review_status: "needs_review",
      message_id: item.message_id,
      internet_message_id: item.internet_message_id,
      conversation_id: item.conversation_id,
      thread_id: item.thread_id,
      thread_key_hash: hashValue(item.thread_key),
      in_reply_to: item.in_reply_to,
      references: item.references,
      subject: item.subject,
      from: item.from,
      to: item.to,
      cc: item.cc,
      sent_at: item.sent_at,
      received_at: item.received_at,
      body_preview: item.body_preview,
      body_hash_sha256: item.body_hash_sha256,
      classification: item.classification,
      attachment_count: item.attachments.length,
      has_attachments: item.attachments.length > 0,
      attachment_names: item.attachments.map((attachment) => attachment.name),
      attachments: item.attachments,
      idempotency_key: hashValue(`${externalId}:${externalVersionId}`),
      metadata_complete: Boolean(item.subject && item.from && item.received_at && item.internet_message_id && item.thread_id),
      human_review_required: true,
      source_mutation_performed: false,
      resource_mutation_performed: false,
      client_facing_output_generated: false,
      audit_trail: buildAuditTrail("outlook_email_message_metadata", item.source_path, context.generatedAt),
      generated_at: context.generatedAt,
    };
  });
}

function buildAttachmentRecords(messageRecords, generatedAt) {
  const records = [];
  for (const message of messageRecords) {
    message.attachments.forEach((attachment, index) => {
      const externalId = `${message.external_id}:attachment:${attachment.attachment_id ?? slug(attachment.name)}:${index}`;
      const externalVersionId = `${externalId}:version:${shortHash(`${attachment.name}:${attachment.size_bytes ?? 0}:${message.external_version_id}`)}`;
      const resourceId = `resource.outlook_email.attachment.${shortHash(externalId)}`;
      records.push({
        schema_version: "outlook-email-attachment-record.v1",
        attachment_record_id: `outlook-attachment.${shortHash(`${externalId}:${index}`)}`,
        message_record_id: message.message_record_id,
        connector_id: message.connector_id,
        source_id: message.source_id,
        tenant_id: message.tenant_id,
        matter_id: message.matter_id,
        policy_snapshot_id: message.policy_snapshot_id,
        source_system: "outlook",
        source_format: message.source_format,
        parent_message_external_id: message.external_id,
        parent_message_resource_id: message.resource_id,
        thread_id: message.thread_id,
        attachment_id: attachment.attachment_id ?? `attachment.${shortHash(externalId)}`,
        attachment_name: attachment.name,
        attachment_content_type: attachment.content_type,
        attachment_size_bytes: attachment.size_bytes ?? 0,
        is_inline: Boolean(attachment.is_inline),
        external_id: externalId,
        external_version_id: externalVersionId,
        resource_id: resourceId,
        resource_version_id: `${resourceId}.v.${shortHash(externalVersionId)}`,
        resource_type: "email_attachment",
        attachment_status: "resource_candidate_ready",
        email_resource_status: "ready",
        resource_projection_status: "ready",
        content_materialization_status: "metadata_only_pending_human_review",
        attachment_content_read_performed: false,
        source_mutation_performed: false,
        resource_mutation_performed: false,
        review_status: "needs_review",
        human_review_required: true,
        audit_trail: buildAuditTrail("outlook_email_attachment_metadata", message.source_path, generatedAt),
        generated_at: generatedAt,
      });
    });
  }
  return records;
}

function buildThreadRecords(messageRecords, attachmentRecords, generatedAt) {
  const byThread = new Map();
  for (const message of messageRecords) {
    if (!byThread.has(message.thread_id)) byThread.set(message.thread_id, []);
    byThread.get(message.thread_id).push(message);
  }
  return [...byThread.entries()].map(([threadId, messages]) => {
    const sortedMessages = [...messages].sort((a, b) => String(a.received_at ?? "").localeCompare(String(b.received_at ?? "")));
    const threadAttachments = attachmentRecords.filter((attachment) => attachment.thread_id === threadId);
    const participants = new Set();
    for (const message of sortedMessages) {
      if (message.from) participants.add(message.from);
      for (const recipient of message.to ?? []) participants.add(recipient);
      for (const recipient of message.cc ?? []) participants.add(recipient);
    }
    return {
      schema_version: "outlook-email-thread-record.v1",
      thread_record_id: `outlook-thread.${shortHash(threadId)}`,
      connector_id: CONNECTOR_ID,
      source_id: sortedMessages[0]?.source_id ?? null,
      tenant_id: sortedMessages[0]?.tenant_id ?? null,
      matter_id: sortedMessages[0]?.matter_id ?? null,
      policy_snapshot_id: sortedMessages[0]?.policy_snapshot_id ?? null,
      source_system: "outlook",
      thread_id: threadId,
      conversation_id: sortedMessages.find((message) => message.conversation_id)?.conversation_id ?? null,
      normalized_subject: normalizeThreadSubject(sortedMessages[0]?.subject ?? "(no subject)"),
      thread_status: "complete",
      message_count: sortedMessages.length,
      attachment_count: threadAttachments.length,
      message_record_ids: sortedMessages.map((message) => message.message_record_id),
      attachment_record_ids: threadAttachments.map((attachment) => attachment.attachment_record_id),
      participants: [...participants].sort(),
      first_message_at: sortedMessages[0]?.received_at ?? null,
      last_message_at: sortedMessages.at(-1)?.received_at ?? null,
      resource_projection_status: "ready",
      review_status: "needs_review",
      human_review_required: true,
      source_mutation_performed: false,
      resource_mutation_performed: false,
      audit_trail: buildAuditTrail("outlook_email_thread_metadata", threadId, generatedAt),
      generated_at: generatedAt,
    };
  });
}

function buildCursorState(cursorContract, messageRecords, context) {
  const lastSeen = messageRecords.at(-1) ?? null;
  const highWatermark = maxString(messageRecords.map((message) => message.received_at).filter(Boolean));
  const cursorPayload = {
    source_id: context.sourceId,
    last_seen_external_id: lastSeen?.external_id ?? null,
    high_watermark: highWatermark,
    message_count: messageRecords.length,
  };
  return {
    schema_version: "outlook-email-cursor-state.v1",
    cursor_id: cursorContract?.cursor_id ?? "cursor.outlook_email.v2",
    cursor_status: "complete",
    cursor_kind: cursorContract?.cursor_kind ?? "mail_folder_delta_cursor",
    connector_id: CONNECTOR_ID,
    source_id: context.sourceId,
    tenant_id: context.tenantId,
    matter_id: context.matterId,
    queued_count: 0,
    last_seen_external_id: lastSeen?.external_id ?? null,
    high_watermark: highWatermark,
    resume_supported: true,
    cursor_storage_mode: "mail_delta_token_hash_only",
    resume_token_hash: hashValue(cursorPayload),
    raw_delta_token_material_allowed: false,
    cross_matter_cursor_reuse_allowed: false,
    reset_requires_human_review: true,
    external_network_access_performed: false,
    source_mutation_performed: false,
    updated_at: context.generatedAt,
  };
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "outlook-email-connector-boundary.v1",
    boundary_status: "enforced",
    phase_slot: CONNECTOR_PHASE,
    live_mailbox_api_disabled_for_artifact: true,
    local_export_read_performed: true,
    outlook_api_execution_performed: false,
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
    package_path: path.resolve(options.packagePath ?? DEFAULT_OUTLOOK_EMAIL_CONNECTOR_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_OUTLOOK_EMAIL_CONNECTOR_INPUTS.roadmapPath),
    final_ledger_path: path.resolve(options.finalLedgerPath ?? DEFAULT_OUTLOOK_EMAIL_CONNECTOR_INPUTS.finalLedgerPath),
    control_plane_loop_path: path.resolve(options.controlPlaneLoopPath ?? DEFAULT_OUTLOOK_EMAIL_CONNECTOR_INPUTS.controlPlaneLoopPath),
    review_dashboard_path: path.resolve(options.reviewDashboardPath ?? DEFAULT_OUTLOOK_EMAIL_CONNECTOR_INPUTS.reviewDashboardPath),
    review_api_path: path.resolve(options.reviewApiPath ?? DEFAULT_OUTLOOK_EMAIL_CONNECTOR_INPUTS.reviewApiPath),
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

function validateOutlookEmailConnector({ connectorContract, onedriveConnectorBoundary, outlookContract, connectorContractBinding, sourceBinding, authBoundary, messageRecords, attachmentRecords, threadRecords, cursorState, boundary, docsAndCode }) {
  const items = [];
  pushCheck(items, "connector_contract.outlook_email", outlookContract.definition?.connector_status === "contracted" && outlookContract.definition?.phase_slot === CONNECTOR_PHASE, "P267 connector contract includes connector.outlook_email.v2 for P270.");
  pushCheck(items, "connector_contract.source", outlookContract.source_contract?.source_id === sourceBinding.source_id && sourceBinding.source_binding_status === "bound", "Outlook email source_id is bound to the P267 source contract.");
  pushCheck(items, "connector_contract.cursor", outlookContract.cursor_contract?.cursor_kind === "mail_folder_delta_cursor" && cursorState.resume_supported === true && cursorState.raw_delta_token_material_allowed === false, "Outlook email cursor uses resumable mail-folder delta semantics without raw token material.");
  pushCheck(items, "connector_contract.external_id", outlookContract.external_id_contract?.external_id_contract_status === "contracted" && [...messageRecords, ...attachmentRecords].every((row) => row.external_id && row.external_version_id && row.resource_id && row.resource_version_id), "Every Outlook email message and attachment has an external_id/resource projection candidate.");
  pushCheck(items, "connector_contract.auth_boundary", authBoundary.auth_boundary_status === "enforced" && authBoundary.auth_mode === "oauth_delegated_readonly" && authBoundary.credential_ref_required === true && authBoundary.credential_reference_only === true && authBoundary.raw_secret_material_allowed === false, "Outlook email auth boundary is OAuth read-only, credential-reference-only, and raw-secret-free.");
  pushCheck(items, "windows_baseline.onedrive_boundary", onedriveConnectorBoundary.summary?.onedrive_connector_boundary_status === "complete" && onedriveConnectorBoundary.summary?.external_network_access_performed === false && onedriveConnectorBoundary.summary?.source_mutation_performed === false, "P269 OneDrive Connector Boundary baseline remains complete and non-mutating before P270.");
  pushCheck(items, "binding.phase", connectorContractBinding.binding_status === "bound" && connectorContractBinding.phase_slot === CONNECTOR_PHASE, "Outlook email connector binding is attached to P270.");
  pushCheck(items, "messages.present", messageRecords.length > 0 && messageRecords.every((message) => message.message_status === "resource_candidate_ready" && message.resource_type === "email"), "Outlook email messages are projected as email resource candidates.");
  pushCheck(items, "messages.metadata", messageRecords.every((message) => message.metadata_complete && message.subject && message.from && message.received_at && message.internet_message_id && message.thread_id), "Outlook email metadata includes subject, sender, timestamp, message id, and thread id.");
  pushCheck(items, "attachments.present", attachmentRecords.length > 0 && attachmentRecords.every((attachment) => attachment.attachment_status === "resource_candidate_ready" && attachment.resource_type === "email_attachment" && attachment.parent_message_resource_id), "Outlook email attachments are projected as attachment resource candidates.");
  pushCheck(items, "threads.present", threadRecords.length > 0 && threadRecords.every((thread) => thread.thread_status === "complete" && thread.message_count > 0 && thread.thread_id), "Outlook email threads are materialized with thread ids and message membership.");
  pushCheck(items, "resources.review_gate", [...messageRecords, ...attachmentRecords, ...threadRecords].every((row) => row.review_status === "needs_review" && row.human_review_required), "Message, attachment, and thread projections remain human-review gated.");
  pushCheck(items, "boundary.no_live_outlook_or_secret", boundary.outlook_api_execution_performed === false && boundary.external_network_access_performed === false && boundary.credential_material_read === false && authBoundary.raw_secret_material_allowed === false, "Outlook email artifact performs no live Outlook API call, network access, credential read, or raw secret handling.");
  pushCheck(items, "boundary.no_mutation_or_delivery", boundary.source_mutation_performed === false && boundary.resource_mutation_performed === false && boundary.output_delivery_performed === false && boundary.protected_action_executed === false, "Outlook email artifact performs no source/resource mutation, delivery, or protected action.");
  pushCheck(items, "boundary.no_legal_or_client_output", boundary.legal_advice_generated === false && boundary.client_facing_output_generated === false && boundary.human_review_required === true, "Outlook email artifact produces no legal advice or client-facing output and remains human-review gated.");
  pushCheck(items, "package.script", Boolean(docsAndCode.package_json?.scripts?.["connectors:outlook-email"]), "package.json registers connectors:outlook-email.");
  pushCheck(items, "roadmap.slot", typeof docsAndCode.roadmap_text === "string" && docsAndCode.roadmap_text.includes("Phase 270") && docsAndCode.final_ledger_text.includes("P270") && docsAndCode.final_ledger_text.includes("Outlook EML/email connector"), "Roadmap and final ledger promote P270 Outlook EML/email connector.");
  pushCheck(items, "loop.bound", docsAndCode.control_plane_loop_text.includes("outlook_email_connector") && docsAndCode.control_plane_loop_text.includes("connectors:outlook-email"), "Control-plane loop includes Outlook email connector.");
  pushCheck(items, "dashboard.bound", docsAndCode.review_dashboard_text.includes("outlook_email_connector"), "Review Dashboard includes Outlook email connector.");
  pushCheck(items, "api.bound", docsAndCode.review_api_text.includes("/api/outlook-email-connector"), "Review API exposes Outlook email connector routes.");
  pushCheck(items, "contract_source.complete", connectorContract.summary?.connector_contract_status === "complete", "Connector Contract v2 source artifact is complete.");
  return items;
}

function summarizeOutlookEmailConnector({ onedriveConnectorBoundary, authBoundary, messageRecords, attachmentRecords, threadRecords, cursorState, boundary, validation, sourceId }) {
  const resourceCandidateCount = messageRecords.length + attachmentRecords.length;
  const status = validation.errors.length > 0 ? "attention" : "complete";
  return {
    outlook_email_connector_status: status,
    connector_id: CONNECTOR_ID,
    source_id: sourceId,
    phase_slot: CONNECTOR_PHASE,
    source_onedrive_connector_boundary_status: onedriveConnectorBoundary.summary?.onedrive_connector_boundary_status ?? "unknown",
    message_count: messageRecords.length,
    attachment_count: attachmentRecords.length,
    thread_count: threadRecords.length,
    threaded_message_count: messageRecords.filter((message) => Boolean(message.thread_id)).length,
    message_resource_count: messageRecords.filter((message) => message.resource_id).length,
    attachment_resource_count: attachmentRecords.filter((attachment) => attachment.resource_id).length,
    resource_candidate_count: resourceCandidateCount,
    metadata_complete_message_count: messageRecords.filter((message) => message.metadata_complete).length,
    message_id_count: messageRecords.filter((message) => message.internet_message_id).length,
    thread_id_count: new Set(messageRecords.map((message) => message.thread_id).filter(Boolean)).size,
    attachment_parent_link_count: attachmentRecords.filter((attachment) => attachment.parent_message_resource_id).length,
    cursor_status: cursorState.cursor_status,
    cursor_kind: cursorState.cursor_kind,
    cursor_resume_supported: cursorState.resume_supported,
    raw_delta_token_material_allowed: cursorState.raw_delta_token_material_allowed,
    auth_boundary_status: authBoundary.auth_boundary_status,
    credential_ref_required: authBoundary.credential_ref_required,
    credential_reference_only: authBoundary.credential_reference_only,
    raw_secret_material_allowed: authBoundary.raw_secret_material_allowed,
    least_privilege_scope_count: authBoundary.least_privilege_scopes.length,
    read_operations_allowed: authBoundary.read_operations_allowed,
    write_operations_allowed: authBoundary.write_operations_allowed,
    external_network_access_required_for_runtime: authBoundary.external_network_access_required_for_runtime,
    local_export_read_performed: boundary.local_export_read_performed,
    outlook_api_execution_performed: boundary.outlook_api_execution_performed,
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

function normalizeGraphAttachment(attachment, index) {
  return {
    attachment_id: attachment.id ?? `graph-attachment-${String(index + 1).padStart(3, "0")}`,
    name: attachment.name ?? `attachment-${index + 1}`,
    content_type: attachment.contentType ?? attachment.content_type ?? "application/octet-stream",
    size_bytes: Number.isFinite(attachment.size) ? attachment.size : attachment.size_bytes ?? 0,
    is_inline: Boolean(attachment.isInline ?? attachment.is_inline),
  };
}

function extractEmlAttachments(raw) {
  const normalized = String(raw ?? "").replace(/\r\n/g, "\n");
  const boundary = normalized.match(/boundary="?([^"\n;]+)"?/i)?.[1] ?? null;
  const blocks = boundary ? normalized.split(`--${boundary}`) : normalized.split(/\n(?=Content-Type:)/i);
  return blocks
    .filter((block) => /Content-Disposition:\s*(attachment|inline)/i.test(block) || /filename\*?=/i.test(block))
    .map((block, index) => {
      const name = decodeMimeWords(readParam(block, "filename") ?? readParam(block, "name") ?? `attachment-${index + 1}`);
      const contentType = block.match(/Content-Type:\s*([^;\n]+)/i)?.[1]?.trim() ?? "application/octet-stream";
      const encodedBody = block.split(/\n\n/).slice(1).join("\n\n").replace(/[^A-Za-z0-9+/=]/g, "");
      const sizeBytes = encodedBody ? Math.floor((encodedBody.length * 3) / 4) : 0;
      return {
        attachment_id: `eml-attachment-${String(index + 1).padStart(3, "0")}`,
        name,
        content_type: contentType,
        size_bytes: sizeBytes,
        is_inline: /Content-Disposition:\s*inline/i.test(block),
      };
    });
}

function extractTextBody(headers, body) {
  const contentType = headers["content-type"] ?? "";
  const boundary = contentType.match(/boundary="?([^"\n;]+)"?/i)?.[1] ?? null;
  if (!boundary) return body;
  const parts = body.split(`--${boundary}`);
  const textPart = parts.find((part) => /Content-Type:\s*text\/plain/i.test(part) && !/Content-Disposition:\s*attachment/i.test(part));
  if (!textPart) return body;
  return textPart.split(/\n\n/).slice(1).join("\n\n");
}

function splitEml(text) {
  const normalized = String(text ?? "").replace(/\r\n/g, "\n");
  const splitIndex = normalized.indexOf("\n\n");
  const headerText = splitIndex >= 0 ? normalized.slice(0, splitIndex) : normalized;
  const body = splitIndex >= 0 ? normalized.slice(splitIndex + 2) : "";
  const headers = {};
  let current = "";

  for (const line of headerText.split("\n")) {
    if (/^\s/.test(line) && current) {
      headers[current] = `${headers[current]} ${line.trim()}`;
      continue;
    }
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (!match) continue;
    current = match[1].toLowerCase();
    headers[current] = match[2].trim();
  }

  return { headers, body };
}

function readParam(text, key) {
  const pattern = new RegExp(`${key}\\*?=(?:"([^"]+)"|([^;\\n]+))`, "i");
  const match = String(text ?? "").match(pattern);
  return match?.[1] ?? match?.[2]?.trim() ?? null;
}

function cleanEmailBody(body) {
  return decodeQuotedPrintable(String(body ?? ""))
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function parseAddressList(value) {
  if (!value) return [];
  return String(value).split(",").map((item) => decodeMimeWords(item.trim())).filter(Boolean);
}

function stringifyGraphAddress(value) {
  const email = value?.emailAddress;
  if (email?.name && email?.address) return `${email.name} <${email.address}>`;
  if (email?.address) return email.address;
  if (typeof value === "string") return value;
  return "unknown";
}

function stringifyGraphAddressList(values) {
  const list = Array.isArray(values) ? values : [values].filter(Boolean);
  return list.map((value) => stringifyGraphAddress(value)).filter(Boolean);
}

function parseReferences(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(cleanHeaderId).filter(Boolean);
  return String(value).split(/\s+/).map(cleanHeaderId).filter(Boolean);
}

function cleanHeaderId(value) {
  if (!value) return null;
  return String(value).trim().replace(/^<|>$/g, "");
}

function normalizeDateTime(value) {
  if (!value) return null;
  const time = Date.parse(value);
  if (!Number.isNaN(time)) return new Date(time).toISOString();
  return null;
}

function normalizeThreadSubject(value) {
  return String(value ?? "(no subject)").replace(/^\s*(re|fw|fwd):\s*/i, "").trim().toLowerCase() || "(no subject)";
}

function buildThreadId(sourceId, threadKey) {
  return `${sourceId}:thread:${shortHash(threadKey)}`;
}

function buildExternalId(sourceId, messageId) {
  return `${sourceId}:${messageId}`;
}

function buildExternalVersionId(item, externalId) {
  const versionInput = `${item.received_at ?? item.sent_at ?? "unknown"}:${item.body_hash_sha256 ?? ""}:${item.attachments.length}`;
  return `${externalId}:version:${shortHash(versionInput)}`;
}

function buildAuditTrail(sourceType, sourceRef, generatedAt) {
  return {
    source: sourceRef,
    source_type: sourceType,
    timestamp: generatedAt,
    confidence: "high",
    responsible_owner: "connector.outlook_email.v2",
    review_status: "needs_review",
  };
}

function renderOutlookEmailConnectorMarkdown(result) {
  const lines = [];
  lines.push("# Outlook Email Connector");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.outlook_email_connector_status}`);
  lines.push(`Connector: ${result.connector_id}`);
  lines.push(`Source: ${result.summary.source_id}`);
  lines.push(`Messages: ${result.summary.message_count}`);
  lines.push(`Attachments: ${result.summary.attachment_count}`);
  lines.push(`Threads: ${result.summary.thread_count}`);
  lines.push("");
  lines.push("## Boundary");
  lines.push("");
  lines.push("- The artifact reads only safe local EML/Graph JSON exports and does not call the Outlook API.");
  lines.push("- OAuth credentials are represented only by credential references; raw secret material and raw delta tokens are not allowed.");
  lines.push("- Message, attachment, and thread resource candidates remain human-review gated.");
  lines.push("- No source mutation, external network access, credential read, resource mutation, delivery, protected action, legal advice, or client-facing output is performed.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { emailInputs: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--connector-contract-v2") parsed.connectorContractV2Path = argv[++index];
    else if (arg === "--onedrive-connector-boundary") parsed.onedriveConnectorBoundaryPath = argv[++index];
    else if (arg === "--email-input") parsed.emailInputs.push(argv[++index]);
    else if (arg === "--source-id") parsed.sourceId = argv[++index];
    else if (arg === "--tenant-id") parsed.tenantId = argv[++index];
    else if (arg === "--matter-id") parsed.matterId = argv[++index];
    else if (arg === "--policy-snapshot-id") parsed.policySnapshotId = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (parsed.emailInputs.length === 0) delete parsed.emailInputs;
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/outlook-email-connector.mjs [options]

Options:
  --check                              Fail unless the connector reaches complete status.
  --out-dir <folder>                   Output directory.
  --connector-contract-v2 <path>       Connector Contract v2 artifact.
  --onedrive-connector-boundary <path> P269 OneDrive Connector Boundary artifact.
  --email-input <path>                 Local EML/Graph JSON export file or folder. Can be repeated.
  --source-id <id>                     Connector source id.
  --tenant-id <id>                     Tenant id for connector rows.
  --matter-id <id>                     Matter id for connector rows.
  --policy-snapshot-id <id>            Policy snapshot id.
  --run-at <iso>                       Deterministic generated_at timestamp.
`);
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

function serializableOutlookEmailConnector(result) {
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

function decodeQuotedPrintable(value) {
  return value
    .replace(/=\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
}

function decodeMimeWords(value) {
  return String(value).replace(/=\?UTF-8\?B\?([^?]+)\?=/gi, (_, encoded) => {
    try {
      return Buffer.from(encoded, "base64").toString("utf8");
    } catch {
      return encoded;
    }
  });
}

function previewText(value, length = 280) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
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

function maxString(values) {
  return values.length ? values.sort().at(-1) : null;
}
