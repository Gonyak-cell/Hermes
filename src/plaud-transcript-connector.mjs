import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_PLAUD_TRANSCRIPT_CONNECTOR_OUT_DIR = "artifacts/plaud-transcript-connector/latest";
export const DEFAULT_PLAUD_TRANSCRIPT_CONNECTOR_INPUTS = {
  connectorContractV2Path: "artifacts/connector-contract-v2/latest/connector-contract-v2.json",
  vdrConnectorPath: "artifacts/vdr-connector/latest/vdr-connector.json",
  normalizedTextContractPath: "artifacts/normalized-text-contract/latest/normalized-text-contract.json",
  plaudInputs: ["examples/plaud-transcript-connector"],
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
  finalLedgerPath: "docs/final-completion-phase-ledger.md",
  controlPlaneLoopPath: "src/control-plane-loop.mjs",
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiPath: "src/review-api.mjs",
};

const CONNECTOR_ID = "connector.plaud_transcript.v2";
const CONNECTOR_PHASE = "P274";
const DEFAULT_TENANT_ID = "tenant.hermes.plaud.demo";
const DEFAULT_MATTER_ID = "MNA-2026-ALPHA";
const DEFAULT_POLICY_SNAPSHOT_ID = "policy.plaud_transcript.default.v1";
const DEFAULT_RECORDING_ID = "plaud-rec-alpha-001";

export async function runPlaudTranscriptConnector(options = {}) {
  const result = await buildPlaudTranscriptConnector(options);
  if (options.write !== false) await writePlaudTranscriptConnector(result, result.output_dir);
  if (options.check && (!result.validation.valid || result.summary.plaud_transcript_connector_status !== "complete")) {
    const error = new Error(`Plaud transcript connector validation failed with ${result.validation.errors.length} error(s); status=${result.summary.plaud_transcript_connector_status}.`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlaudTranscriptConnector(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLAUD_TRANSCRIPT_CONNECTOR_OUT_DIR);
  const connectorContractPath = path.resolve(options.connectorContractV2Path ?? DEFAULT_PLAUD_TRANSCRIPT_CONNECTOR_INPUTS.connectorContractV2Path);
  const vdrConnectorPath = path.resolve(options.vdrConnectorPath ?? DEFAULT_PLAUD_TRANSCRIPT_CONNECTOR_INPUTS.vdrConnectorPath);
  const normalizedTextContractPath = path.resolve(options.normalizedTextContractPath ?? DEFAULT_PLAUD_TRANSCRIPT_CONNECTOR_INPUTS.normalizedTextContractPath);
  const plaudInputs = normalizeInputPaths(options.plaudInputs ?? DEFAULT_PLAUD_TRANSCRIPT_CONNECTOR_INPUTS.plaudInputs);
  const connectorContract = await readJson(connectorContractPath);
  const vdrConnector = await readJson(vdrConnectorPath);
  const normalizedTextContract = await readJson(normalizedTextContractPath);
  const plaudContract = pickPlaudConnectorContract(connectorContract);
  const sourceId = options.sourceId ?? plaudContract.source_contract?.source_id ?? "source.plaud_transcript.v2";
  const sourceItems = await readPlaudInputs(plaudInputs, {
    sourceId,
    generatedAt,
    tenantId: options.tenantId,
    matterId: options.matterId,
    policySnapshotId: options.policySnapshotId,
  });
  const recordingRecords = buildRecordingRecords(sourceItems, { sourceId, generatedAt });
  const speakerRecords = buildSpeakerRecords(sourceItems, { sourceId, generatedAt });
  const transcriptSegmentRecords = buildTranscriptSegmentRecords(sourceItems, speakerRecords, { sourceId, generatedAt });
  const normalizedTextRecords = buildNormalizedTextRecords(transcriptSegmentRecords, { generatedAt });
  const timestampSpanRecords = buildTimestampSpanRecords(transcriptSegmentRecords, normalizedTextRecords, { generatedAt });
  const audioMetadataRecords = buildAudioMetadataRecords(sourceItems, { sourceId, generatedAt });
  const connectorContractBinding = buildConnectorContractBinding(plaudContract, connectorContract, sourceId);
  const sourceBinding = buildSourceBinding(plaudContract, { sourceId, plaudInputs, recordingRecords, generatedAt });
  const authBoundary = buildAuthBoundary(plaudContract.auth_boundary, generatedAt);
  const cursorState = buildCursorState(plaudContract.cursor_contract, transcriptSegmentRecords, {
    generatedAt,
    sourceId,
    recordingRecords,
  });
  const boundary = buildBoundary(generatedAt);
  const docsAndCode = await readDocsAndCode(options);
  const validationItems = validatePlaudTranscriptConnector({
    connectorContract,
    vdrConnector,
    normalizedTextContract,
    plaudContract,
    connectorContractBinding,
    sourceBinding,
    authBoundary,
    recordingRecords,
    speakerRecords,
    transcriptSegmentRecords,
    normalizedTextRecords,
    timestampSpanRecords,
    audioMetadataRecords,
    cursorState,
    boundary,
    docsAndCode,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizePlaudTranscriptConnector({
    vdrConnector,
    normalizedTextContract,
    authBoundary,
    recordingRecords,
    speakerRecords,
    transcriptSegmentRecords,
    normalizedTextRecords,
    timestampSpanRecords,
    audioMetadataRecords,
    cursorState,
    boundary,
    validation,
    sourceId,
  });

  const result = {
    schema_version: "plaud-transcript-connector.v1",
    generated_at: generatedAt,
    plaud_transcript_connector_id: `plaud-transcript-connector.${dateStamp(generatedAt)}`,
    connector_id: CONNECTOR_ID,
    connector_status: summary.plaud_transcript_connector_status,
    output_dir: outputDir,
    inputs: {
      connector_contract_v2_path: connectorContractPath,
      vdr_connector_path: vdrConnectorPath,
      normalized_text_contract_path: normalizedTextContractPath,
      plaud_inputs: plaudInputs,
    },
    connector_contract_binding: connectorContractBinding,
    source_binding: sourceBinding,
    auth_boundary: authBoundary,
    plaud_recording_records: recordingRecords,
    plaud_speaker_records: speakerRecords,
    plaud_transcript_segment_records: transcriptSegmentRecords,
    plaud_normalized_text_records: normalizedTextRecords,
    plaud_timestamp_span_records: timestampSpanRecords,
    plaud_audio_metadata_records: audioMetadataRecords,
    cursor_state: cursorState,
    plaud_connector_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };

  return {
    ...result,
    markdown: renderPlaudTranscriptConnectorMarkdown(result),
  };
}

export async function writePlaudTranscriptConnector(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "plaud-transcript-connector.json"), serializablePlaudTranscriptConnector(result));
  await writeJson(path.join(outDir, "plaud-recording-records.json"), {
    generated_at: result.generated_at,
    recording_record_count: result.plaud_recording_records.length,
    plaud_recording_records: result.plaud_recording_records,
  });
  await writeJson(path.join(outDir, "plaud-speaker-records.json"), {
    generated_at: result.generated_at,
    speaker_record_count: result.plaud_speaker_records.length,
    plaud_speaker_records: result.plaud_speaker_records,
  });
  await writeJson(path.join(outDir, "plaud-transcript-segments.json"), {
    generated_at: result.generated_at,
    transcript_segment_count: result.plaud_transcript_segment_records.length,
    plaud_transcript_segment_records: result.plaud_transcript_segment_records,
  });
  await writeJson(path.join(outDir, "plaud-normalized-text-records.json"), {
    generated_at: result.generated_at,
    normalized_text_record_count: result.plaud_normalized_text_records.length,
    plaud_normalized_text_records: result.plaud_normalized_text_records,
  });
  await writeJson(path.join(outDir, "plaud-timestamp-spans.json"), {
    generated_at: result.generated_at,
    timestamp_span_record_count: result.plaud_timestamp_span_records.length,
    plaud_timestamp_span_records: result.plaud_timestamp_span_records,
  });
  await writeJson(path.join(outDir, "plaud-audio-metadata-records.json"), {
    generated_at: result.generated_at,
    audio_metadata_record_count: result.plaud_audio_metadata_records.length,
    plaud_audio_metadata_records: result.plaud_audio_metadata_records,
  });
  await writeJson(path.join(outDir, "cursor-state.json"), result.cursor_state);
  await writeJson(path.join(outDir, "auth-boundary.json"), result.auth_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    plaud_transcript_connector_id: result.plaud_transcript_connector_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlaudTranscriptConnectorCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runPlaudTranscriptConnector(args);
    console.log(`Plaud transcript connector ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.plaud_transcript_connector_status}`);
    console.log(`Recordings: ${result.summary.recording_count}`);
    console.log(`Speakers: ${result.summary.speaker_count}`);
    console.log(`Segments: ${result.summary.segment_count}`);
    console.log(`Normalized text records: ${result.summary.normalized_text_record_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function pickPlaudConnectorContract(connectorContract) {
  const byConnectorId = (items = []) => items.find((item) => item.connector_id === CONNECTOR_ID) ?? null;
  return {
    definition: byConnectorId(connectorContract.connector_definitions),
    source_contract: byConnectorId(connectorContract.connector_source_contracts),
    cursor_contract: byConnectorId(connectorContract.connector_cursor_contracts),
    external_id_contract: byConnectorId(connectorContract.connector_external_id_contracts),
    auth_boundary: byConnectorId(connectorContract.connector_auth_boundaries),
  };
}

function buildConnectorContractBinding(plaudContract, connectorContract, sourceId) {
  return {
    schema_version: "connector-contract-binding.v1",
    binding_status: plaudContract.definition?.connector_status === "contracted" ? "bound" : "attention",
    connector_id: CONNECTOR_ID,
    source_id: sourceId,
    source_system: "plaud",
    connector_family: "plaud_transcript",
    phase_slot: CONNECTOR_PHASE,
    connector_contract_version: connectorContract.schema_version,
    interface_schema_version: connectorContract.connector_interface_schema?.schema_version ?? null,
    source_contract_status: plaudContract.source_contract?.source_contract_status ?? "unknown",
    cursor_contract_status: plaudContract.cursor_contract?.cursor_contract_status ?? "unknown",
    external_id_contract_status: plaudContract.external_id_contract?.external_id_contract_status ?? "unknown",
    auth_boundary_status: plaudContract.auth_boundary?.auth_boundary_status ?? "unknown",
  };
}

function buildSourceBinding(plaudContract, { sourceId, plaudInputs, recordingRecords, generatedAt }) {
  return {
    schema_version: "connector-source-binding.v1",
    source_binding_status: plaudContract.source_contract?.source_contract_status === "contracted" ? "bound" : "attention",
    connector_id: CONNECTOR_ID,
    source_id: sourceId,
    source_system: "plaud",
    source_kind: "transcript_export",
    source_mode: "operator_provided_transcript_export",
    source_paths: plaudInputs,
    recording_count: recordingRecords.length,
    tenant_id_required: true,
    matter_id_required: true,
    classification_required: true,
    policy_snapshot_required: true,
    generated_at: generatedAt,
  };
}

function buildAuthBoundary(authContract, generatedAt) {
  return {
    schema_version: "plaud-transcript-auth-boundary.v1",
    auth_boundary_status: ["contracted", "enforced"].includes(authContract?.auth_boundary_status) ? "enforced" : "attention",
    connector_id: CONNECTOR_ID,
    auth_mode: authContract?.auth_mode ?? "oauth_or_operator_export_readonly",
    credential_ref_required: false,
    credential_reference_only: true,
    credential_material_read: false,
    raw_secret_material_allowed: false,
    least_privilege_scopes: authContract?.least_privilege_scopes ?? ["transcript.export.read"],
    external_network_access_required_for_runtime: false,
    external_network_access_performed: false,
    plaud_api_execution_performed: false,
    local_export_read_performed: true,
    connector_execution_performed: true,
    read_operations_allowed: true,
    write_operations_allowed: false,
    source_mutation_performed: false,
    generated_at: generatedAt,
  };
}

async function readPlaudInputs(inputPaths, context) {
  const files = [];
  for (const inputPath of inputPaths) {
    const stats = await stat(inputPath);
    if (stats.isDirectory()) {
      const names = await readdir(inputPath);
      for (const name of names.filter((item) => item.endsWith(".json")).sort()) {
        files.push(path.join(inputPath, name));
      }
    } else {
      files.push(inputPath);
    }
  }

  const items = [];
  for (const file of files) {
    const value = await readJson(file);
    items.push(normalizePlaudExport(value, file, context));
  }
  return items;
}

function normalizePlaudExport(value, sourcePath, context) {
  const recordingId = String(value.recording_id ?? value.plaud_recording_id ?? DEFAULT_RECORDING_ID);
  const matterId = value.matter_id ?? context.matterId ?? DEFAULT_MATTER_ID;
  const speakers = Array.isArray(value.speakers) ? value.speakers : [];
  const segments = Array.isArray(value.segments) ? value.segments : Array.isArray(value.transcript_segments) ? value.transcript_segments : [];
  return {
    source_path: sourcePath,
    tenant_id: value.tenant_id ?? context.tenantId ?? DEFAULT_TENANT_ID,
    matter_id: matterId,
    policy_snapshot_id: value.policy_snapshot_id ?? context.policySnapshotId ?? DEFAULT_POLICY_SNAPSHOT_ID,
    classification: value.classification ?? "restricted",
    recording_id: recordingId,
    recording_title: value.recording_title ?? value.title ?? "Plaud meeting transcript export",
    recorded_at: toIso(value.recorded_at ?? value.created_at ?? context.generatedAt),
    duration_seconds: Number(value.duration_seconds ?? value.audio?.duration_seconds ?? 0),
    language: value.language ?? "en-US",
    audio: value.audio ?? {},
    speakers: speakers.map((speaker, index) => ({
      speaker_id: String(speaker.speaker_id ?? speaker.id ?? `speaker-${index + 1}`),
      speaker_name: speaker.speaker_name ?? speaker.name ?? `Speaker ${index + 1}`,
      speaker_role: speaker.speaker_role ?? speaker.role ?? "participant",
      confidence: Number(speaker.confidence ?? 1),
    })),
    segments: segments.map((segment, index) => ({
      speaker_segment_id: String(segment.speaker_segment_id ?? segment.segment_id ?? `seg-${index + 1}`),
      speaker_id: String(segment.speaker_id ?? speakers[0]?.speaker_id ?? speakers[0]?.id ?? "speaker-1"),
      start_ms: Number(segment.start_ms ?? segment.start_offset_ms ?? 0),
      end_ms: Number(segment.end_ms ?? segment.end_offset_ms ?? 0),
      text: String(segment.text ?? segment.transcript_text ?? "").trim(),
      confidence: Number(segment.confidence ?? 1),
    })),
  };
}

function buildRecordingRecords(sourceItems, { sourceId, generatedAt }) {
  return sourceItems.map((item) => ({
    schema_version: "plaud-recording-record.v1",
    plaud_recording_record_id: stableId("plaud-recording", item.recording_id),
    connector_id: CONNECTOR_ID,
    source_id: sourceId,
    source_system: "plaud",
    source_kind: "transcript_export",
    tenant_id: item.tenant_id,
    matter_id: item.matter_id,
    policy_snapshot_id: item.policy_snapshot_id,
    classification: item.classification,
    recording_id: item.recording_id,
    recording_title: item.recording_title,
    recorded_at: item.recorded_at,
    duration_seconds: item.duration_seconds,
    language: item.language,
    source_path: item.source_path,
    recording_status: "metadata_export_ready",
    transcript_export_read_performed: true,
    audio_download_performed: false,
    speaker_count: item.speakers.length,
    segment_count: item.segments.length,
    review_status: "needs_review",
    human_review_required: true,
    generated_at: generatedAt,
  }));
}

function buildSpeakerRecords(sourceItems, { sourceId, generatedAt }) {
  return sourceItems.flatMap((item) => item.speakers.map((speaker) => ({
    schema_version: "plaud-speaker-record.v1",
    plaud_speaker_record_id: stableId("plaud-speaker", item.recording_id, speaker.speaker_id),
    plaud_recording_record_id: stableId("plaud-recording", item.recording_id),
    connector_id: CONNECTOR_ID,
    source_id: sourceId,
    tenant_id: item.tenant_id,
    matter_id: item.matter_id,
    recording_id: item.recording_id,
    speaker_id: speaker.speaker_id,
    speaker_name: speaker.speaker_name,
    speaker_role: speaker.speaker_role,
    speaker_status: "identified_from_export",
    confidence: speaker.confidence,
    review_status: "needs_review",
    human_review_required: true,
    generated_at: generatedAt,
  })));
}

function buildTranscriptSegmentRecords(sourceItems, speakerRecords, { sourceId, generatedAt }) {
  const speakersByRecording = new Map(speakerRecords.map((speaker) => [`${speaker.recording_id}:${speaker.speaker_id}`, speaker]));
  return sourceItems.flatMap((item) => item.segments.map((segment, index) => {
    const speaker = speakersByRecording.get(`${item.recording_id}:${segment.speaker_id}`) ?? null;
    const timestampRange = `${segment.start_ms}-${segment.end_ms}`;
    const externalId = `plaud:${item.recording_id}:${segment.speaker_segment_id}:${timestampRange}`;
    const externalVersionId = sha256([externalId, segment.text, segment.confidence].join("|"));
    const resourceId = stableId("resource.plaud_transcript", externalId);
    return {
      schema_version: "plaud-transcript-segment.v1",
      plaud_transcript_segment_id: stableId("plaud-segment", externalId),
      plaud_recording_record_id: stableId("plaud-recording", item.recording_id),
      plaud_speaker_record_id: speaker?.plaud_speaker_record_id ?? null,
      connector_id: CONNECTOR_ID,
      source_id: sourceId,
      source_system: "plaud",
      source_kind: "transcript_export",
      tenant_id: item.tenant_id,
      matter_id: item.matter_id,
      policy_snapshot_id: item.policy_snapshot_id,
      classification: item.classification,
      recording_id: item.recording_id,
      recording_title: item.recording_title,
      segment_index: index,
      speaker_segment_id: segment.speaker_segment_id,
      speaker_id: segment.speaker_id,
      speaker_name: speaker?.speaker_name ?? segment.speaker_id,
      start_ms: segment.start_ms,
      end_ms: segment.end_ms,
      timestamp_range: timestampRange,
      text: segment.text,
      text_hash: sha256(segment.text),
      confidence: segment.confidence,
      external_id: externalId,
      external_version_id: externalVersionId,
      resource_id: resourceId,
      resource_version_id: stableId("resource-version.plaud_transcript", externalVersionId),
      resource_type: "meeting_transcript",
      segment_status: "resource_candidate_ready",
      plaud_resource_status: "ready",
      normalized_text_status: "stored",
      timestamp_span_status: "bound",
      speaker_link_status: speaker ? "bound" : "attention",
      metadata_complete: Boolean(segment.text && segment.end_ms >= segment.start_ms && speaker),
      review_status: "needs_review",
      human_review_required: true,
      legal_advice_generated: false,
      client_facing_output_generated: false,
      generated_at: generatedAt,
    };
  }));
}

function buildNormalizedTextRecords(segmentRecords, { generatedAt }) {
  return segmentRecords.map((segment) => {
    const normalizedText = `[${formatTimestamp(segment.start_ms)}-${formatTimestamp(segment.end_ms)}] ${segment.speaker_name}: ${segment.text}`;
    return {
      schema_version: "plaud-normalized-text-record.v1",
      plaud_normalized_text_record_id: stableId("plaud-normalized-text", segment.plaud_transcript_segment_id),
      plaud_transcript_segment_id: segment.plaud_transcript_segment_id,
      connector_id: CONNECTOR_ID,
      tenant_id: segment.tenant_id,
      matter_id: segment.matter_id,
      recording_id: segment.recording_id,
      speaker_segment_id: segment.speaker_segment_id,
      normalized_text_artifact_id: stableId("normalized-text.plaud", segment.resource_version_id),
      normalized_text_status: "stored",
      normalized_text: normalizedText,
      normalized_text_hash: sha256(normalizedText),
      offset_unit: "utf16_code_unit",
      speaker_label_present: true,
      timestamp_range_present: true,
      source_resource_id: segment.resource_id,
      source_resource_version_id: segment.resource_version_id,
      review_status: "needs_review",
      human_review_required: true,
      generated_at: generatedAt,
    };
  });
}

function buildTimestampSpanRecords(segmentRecords, normalizedTextRecords, { generatedAt }) {
  const normalizedBySegment = new Map(normalizedTextRecords.map((record) => [record.plaud_transcript_segment_id, record]));
  return segmentRecords.map((segment) => {
    const normalized = normalizedBySegment.get(segment.plaud_transcript_segment_id);
    return {
      schema_version: "plaud-timestamp-span.v1",
      plaud_timestamp_span_record_id: stableId("plaud-timestamp-span", segment.plaud_transcript_segment_id),
      plaud_transcript_segment_id: segment.plaud_transcript_segment_id,
      plaud_normalized_text_record_id: normalized?.plaud_normalized_text_record_id ?? null,
      connector_id: CONNECTOR_ID,
      tenant_id: segment.tenant_id,
      matter_id: segment.matter_id,
      recording_id: segment.recording_id,
      speaker_segment_id: segment.speaker_segment_id,
      speaker_id: segment.speaker_id,
      speaker_name: segment.speaker_name,
      start_ms: segment.start_ms,
      end_ms: segment.end_ms,
      timestamp_range: segment.timestamp_range,
      timestamp_span_status: "bound",
      location_type: "timestamp_range",
      offset_unit: "milliseconds",
      review_status: "needs_review",
      human_review_required: true,
      generated_at: generatedAt,
    };
  });
}

function buildAudioMetadataRecords(sourceItems, { sourceId, generatedAt }) {
  return sourceItems.map((item) => {
    const audio = item.audio ?? {};
    const externalId = `plaud:${item.recording_id}:audio_metadata`;
    const externalVersionId = sha256(JSON.stringify({
      recording_id: item.recording_id,
      file_name: audio.file_name ?? null,
      duration_seconds: item.duration_seconds,
      checksum: audio.checksum ?? null,
    }));
    return {
      schema_version: "plaud-audio-metadata-record.v1",
      plaud_audio_metadata_record_id: stableId("plaud-audio-metadata", item.recording_id),
      plaud_recording_record_id: stableId("plaud-recording", item.recording_id),
      connector_id: CONNECTOR_ID,
      source_id: sourceId,
      source_system: "plaud",
      source_kind: "transcript_export",
      tenant_id: item.tenant_id,
      matter_id: item.matter_id,
      policy_snapshot_id: item.policy_snapshot_id,
      classification: item.classification,
      recording_id: item.recording_id,
      file_name: audio.file_name ?? `${item.recording_id}.m4a`,
      format: audio.format ?? "m4a",
      duration_seconds: item.duration_seconds,
      size_bytes: Number(audio.size_bytes ?? 0),
      checksum: audio.checksum ?? null,
      external_id: externalId,
      external_version_id: externalVersionId,
      resource_id: stableId("resource.plaud_audio", externalId),
      resource_version_id: stableId("resource-version.plaud_audio", externalVersionId),
      resource_type: "audio_metadata",
      audio_metadata_status: "resource_candidate_ready",
      plaud_resource_status: "ready",
      metadata_complete: true,
      audio_download_performed: false,
      review_status: "needs_review",
      human_review_required: true,
      generated_at: generatedAt,
    };
  });
}

function buildCursorState(cursorContract, segmentRecords, { generatedAt, sourceId, recordingRecords }) {
  const lastSegment = [...segmentRecords].sort((a, b) => a.end_ms - b.end_ms).at(-1) ?? null;
  const lastRecording = recordingRecords.at(-1) ?? null;
  const cursorPosition = lastSegment ? `${lastSegment.recording_id}:${lastSegment.end_ms}` : "empty";
  return {
    schema_version: "plaud-transcript-cursor-state.v1",
    cursor_status: cursorContract?.cursor_contract_status === "contracted" ? "complete" : "attention",
    cursor_kind: cursorContract?.cursor_kind ?? "transcript_timestamp_cursor",
    cursor_id: cursorContract?.cursor_id ?? "cursor.plaud_transcript.v2",
    connector_id: CONNECTOR_ID,
    source_id: sourceId,
    tenant_id: lastRecording?.tenant_id ?? DEFAULT_TENANT_ID,
    matter_id: lastRecording?.matter_id ?? DEFAULT_MATTER_ID,
    cursor_position: cursorPosition,
    last_seen_external_id: lastSegment?.external_id ?? null,
    last_seen_at: lastSegment?.generated_at ?? generatedAt,
    high_watermark: lastSegment?.end_ms ?? 0,
    resume_supported: cursorContract?.resume_supported ?? true,
    reset_requires_human_review: true,
    raw_transcript_timestamp_cursor_material_allowed: false,
    resume_token_hash: sha256(cursorPosition),
    updated_at: generatedAt,
  };
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "plaud-transcript-boundary.v1",
    boundary_status: "enforced",
    connector_id: CONNECTOR_ID,
    local_export_read_performed: true,
    plaud_api_execution_performed: false,
    external_network_access_performed: false,
    connector_execution_performed: true,
    source_read_performed: true,
    credential_material_read: false,
    transcript_text_read_performed: true,
    audio_download_performed: false,
    source_mutation_performed: false,
    resource_mutation_performed: false,
    normalized_text_mutation_performed: false,
    matter_data_write_allowed: false,
    task_state_write_allowed: false,
    workflow_transition_allowed: false,
    output_delivery_performed: false,
    protected_action_executed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    generated_at: generatedAt,
  };
}

function validatePlaudTranscriptConnector(input) {
  const {
    connectorContract,
    vdrConnector,
    normalizedTextContract,
    plaudContract,
    connectorContractBinding,
    sourceBinding,
    authBoundary,
    recordingRecords,
    speakerRecords,
    transcriptSegmentRecords,
    normalizedTextRecords,
    timestampSpanRecords,
    audioMetadataRecords,
    cursorState,
    boundary,
    docsAndCode,
  } = input;
  const items = [];
  const pushCheck = (pathId, passed, message) => {
    items.push({
      path: pathId,
      check_id: pathId,
      status: passed ? "passed" : "failed",
      message,
    });
  };

  pushCheck("connector.contract.present", connectorContract?.summary?.connector_contract_status === "complete", "Connector Contract v2 is complete.");
  pushCheck("connector.definition.bound", plaudContract.definition?.connector_id === CONNECTOR_ID && connectorContractBinding.binding_status === "bound", "Plaud transcript connector contract is bound.");
  pushCheck("source.vdr.complete", vdrConnector?.summary?.vdr_connector_status === "complete", "P273 VDR Connector baseline is complete.");
  pushCheck("source.normalized_text_contract.complete", normalizedTextContract?.summary?.normalized_text_contract_status === "complete", "Normalized text contract source is complete.");
  pushCheck("source.binding.bound", sourceBinding.source_binding_status === "bound", "Plaud transcript export source binding is bound.");
  pushCheck("recordings.present", recordingRecords.length > 0 && recordingRecords.every((record) => record.recording_status === "metadata_export_ready" && record.human_review_required), "Plaud recording metadata exports are represented.");
  pushCheck("speakers.present", speakerRecords.length > 0 && speakerRecords.every((record) => record.speaker_status === "identified_from_export" && record.human_review_required), "Plaud speaker records are represented.");
  pushCheck("segments.present", transcriptSegmentRecords.length > 0 && transcriptSegmentRecords.every((record) => record.segment_status === "resource_candidate_ready" && record.resource_type === "meeting_transcript" && record.metadata_complete), "Transcript speaker segments are projected as resource candidates.");
  pushCheck("audio.metadata.present", audioMetadataRecords.length > 0 && audioMetadataRecords.every((record) => record.audio_metadata_status === "resource_candidate_ready" && record.resource_type === "audio_metadata" && record.audio_download_performed === false), "Audio metadata is projected without downloading audio.");
  pushCheck("normalized_text.match.segments", normalizedTextRecords.length === transcriptSegmentRecords.length && normalizedTextRecords.every((record) => record.normalized_text_status === "stored" && record.speaker_label_present && record.timestamp_range_present), "Every transcript segment has speaker/timestamp normalized text.");
  pushCheck("timestamp_spans.match.segments", timestampSpanRecords.length === transcriptSegmentRecords.length && timestampSpanRecords.every((record) => record.timestamp_span_status === "bound"), "Every transcript segment has a timestamp span.");
  pushCheck("speaker.links.bound", transcriptSegmentRecords.every((record) => record.speaker_link_status === "bound"), "Every transcript segment is linked to a speaker record.");
  pushCheck("cursor.hash_only", cursorState.cursor_status === "complete" && cursorState.resume_supported === true && cursorState.raw_transcript_timestamp_cursor_material_allowed === false, "Plaud transcript cursor is resumable and hash-only.");
  pushCheck("auth.boundary", authBoundary.auth_boundary_status === "enforced" && authBoundary.credential_ref_required === false && authBoundary.credential_reference_only === true && authBoundary.raw_secret_material_allowed === false && authBoundary.write_operations_allowed === false && authBoundary.external_network_access_required_for_runtime === false, "Plaud auth boundary is local-export/OAuth read-only and credential-reference-only.");
  pushCheck("no.live.plaud", authBoundary.plaud_api_execution_performed === false && authBoundary.external_network_access_performed === false && boundary.plaud_api_execution_performed === false, "No live Plaud API or network execution is performed.");
  pushCheck("no.audio.download", boundary.audio_download_performed === false && audioMetadataRecords.every((record) => record.audio_download_performed === false), "No Plaud audio is downloaded.");
  pushCheck("no.mutation", boundary.source_mutation_performed === false && boundary.resource_mutation_performed === false && boundary.normalized_text_mutation_performed === false, "No source, resource, or normalized-text store mutation is performed.");
  pushCheck("no.delivery.or.legal", boundary.output_delivery_performed === false && boundary.protected_action_executed === false && boundary.legal_advice_generated === false && boundary.client_facing_output_generated === false, "No delivery, protected action, legal advice, or client-facing output is generated.");
  pushCheck("package.script", docsAndCode.package_text.includes("\"connectors:plaud-transcript\""), "package.json exposes connectors:plaud-transcript.");
  pushCheck("roadmap.phase", docsAndCode.roadmap_text.includes("Phase 274") && docsAndCode.roadmap_text.includes("Plaud Transcript Connector"), "Roadmap documents Phase 274 Plaud Transcript Connector.");
  pushCheck("ledger.slot", docsAndCode.final_ledger_text.includes("| P274 |") && docsAndCode.final_ledger_text.includes("Plaud transcript connector"), "Final ledger tracks P274 Plaud transcript connector.");
  pushCheck("loop.step", docsAndCode.control_plane_loop_text.includes("plaud_transcript_connector") && docsAndCode.control_plane_loop_text.includes("connectors:plaud-transcript"), "Control plane loop includes Plaud transcript connector.");
  pushCheck("dashboard.source", docsAndCode.review_dashboard_text.includes("plaud_transcript_connector"), "Review dashboard includes Plaud transcript connector.");
  pushCheck("api.routes", docsAndCode.review_api_text.includes("/api/plaud-transcript-connector"), "Review API exposes Plaud transcript connector routes.");
  return items;
}

function summarizePlaudTranscriptConnector(input) {
  const {
    vdrConnector,
    normalizedTextContract,
    authBoundary,
    recordingRecords,
    speakerRecords,
    transcriptSegmentRecords,
    normalizedTextRecords,
    timestampSpanRecords,
    audioMetadataRecords,
    cursorState,
    boundary,
    validation,
    sourceId,
  } = input;
  const resourceCandidateCount = transcriptSegmentRecords.length + audioMetadataRecords.length;
  return {
    plaud_transcript_connector_status: validation.valid ? "complete" : "attention",
    connector_id: CONNECTOR_ID,
    source_id: sourceId,
    phase_slot: CONNECTOR_PHASE,
    source_vdr_connector_status: vdrConnector?.summary?.vdr_connector_status ?? "unknown",
    source_normalized_text_contract_status: normalizedTextContract?.summary?.normalized_text_contract_status ?? "unknown",
    recording_count: recordingRecords.length,
    speaker_count: speakerRecords.length,
    segment_count: transcriptSegmentRecords.length,
    audio_metadata_count: audioMetadataRecords.length,
    normalized_text_record_count: normalizedTextRecords.length,
    timestamp_span_count: timestampSpanRecords.length,
    transcript_resource_count: transcriptSegmentRecords.length,
    audio_resource_count: audioMetadataRecords.length,
    resource_candidate_count: resourceCandidateCount,
    speaker_link_count: transcriptSegmentRecords.filter((record) => record.speaker_link_status === "bound").length,
    timestamp_range_count: transcriptSegmentRecords.filter((record) => record.timestamp_range).length,
    normalized_text_speaker_tag_count: normalizedTextRecords.filter((record) => record.speaker_label_present).length,
    normalized_text_timestamp_tag_count: normalizedTextRecords.filter((record) => record.timestamp_range_present).length,
    metadata_complete_segment_count: transcriptSegmentRecords.filter((record) => record.metadata_complete).length,
    metadata_complete_audio_count: audioMetadataRecords.filter((record) => record.metadata_complete).length,
    cursor_status: cursorState.cursor_status,
    cursor_kind: cursorState.cursor_kind,
    cursor_resume_supported: cursorState.resume_supported,
    raw_transcript_timestamp_cursor_material_allowed: cursorState.raw_transcript_timestamp_cursor_material_allowed,
    auth_boundary_status: authBoundary.auth_boundary_status,
    auth_mode: authBoundary.auth_mode,
    credential_ref_required: authBoundary.credential_ref_required,
    credential_reference_only: authBoundary.credential_reference_only,
    raw_secret_material_allowed: authBoundary.raw_secret_material_allowed,
    read_operations_allowed: authBoundary.read_operations_allowed,
    write_operations_allowed: authBoundary.write_operations_allowed,
    external_network_access_required_for_runtime: authBoundary.external_network_access_required_for_runtime,
    local_export_read_performed: boundary.local_export_read_performed,
    plaud_api_execution_performed: boundary.plaud_api_execution_performed,
    external_network_access_performed: boundary.external_network_access_performed,
    connector_execution_performed: boundary.connector_execution_performed,
    source_read_performed: boundary.source_read_performed,
    credential_material_read: boundary.credential_material_read,
    transcript_text_read_performed: boundary.transcript_text_read_performed,
    audio_download_performed: boundary.audio_download_performed,
    source_mutation_performed: boundary.source_mutation_performed,
    resource_mutation_performed: boundary.resource_mutation_performed,
    normalized_text_mutation_performed: boundary.normalized_text_mutation_performed,
    matter_data_write_allowed: boundary.matter_data_write_allowed,
    task_state_write_allowed: boundary.task_state_write_allowed,
    workflow_transition_allowed: boundary.workflow_transition_allowed,
    output_delivery_performed: boundary.output_delivery_performed,
    protected_action_executed: boundary.protected_action_executed,
    legal_advice_generated: boundary.legal_advice_generated,
    client_facing_output_generated: boundary.client_facing_output_generated,
    human_review_required_count: [...transcriptSegmentRecords, ...audioMetadataRecords].filter((record) => record.human_review_required).length,
    normalized_text_human_review_required_count: normalizedTextRecords.filter((record) => record.human_review_required).length,
    validation_item_count: validation.items.length,
    validation_error_count: validation.errors.length,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed");
  return {
    valid: errors.length === 0,
    item_count: items.length,
    error_count: errors.length,
    errors,
    items,
  };
}

function serializablePlaudTranscriptConnector(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function renderPlaudTranscriptConnectorMarkdown(result) {
  const { summary } = result;
  return [
    "# Plaud Transcript Connector",
    "",
    `Status: ${summary.plaud_transcript_connector_status}`,
    `Connector: ${summary.connector_id}`,
    `Recordings: ${summary.recording_count}`,
    `Speakers: ${summary.speaker_count}`,
    `Segments: ${summary.segment_count}`,
    `Normalized text records: ${summary.normalized_text_record_count}`,
    `Timestamp spans: ${summary.timestamp_span_count}`,
    `Audio metadata records: ${summary.audio_metadata_count}`,
    `Validation errors: ${summary.validation_error_count}`,
    "",
    "All transcript and audio metadata projections are internal resource candidates requiring human review. The connector reads operator-provided Plaud exports only and performs no live Plaud API calls, network access, credential material reads, audio downloads, mutations, legal advice, or client-facing output.",
    "",
  ].join("\n");
}

async function readDocsAndCode(options) {
  const packagePath = path.resolve(options.packagePath ?? DEFAULT_PLAUD_TRANSCRIPT_CONNECTOR_INPUTS.packagePath);
  const roadmapPath = path.resolve(options.roadmapPath ?? DEFAULT_PLAUD_TRANSCRIPT_CONNECTOR_INPUTS.roadmapPath);
  const finalLedgerPath = path.resolve(options.finalLedgerPath ?? DEFAULT_PLAUD_TRANSCRIPT_CONNECTOR_INPUTS.finalLedgerPath);
  const controlPlaneLoopPath = path.resolve(options.controlPlaneLoopPath ?? DEFAULT_PLAUD_TRANSCRIPT_CONNECTOR_INPUTS.controlPlaneLoopPath);
  const reviewDashboardPath = path.resolve(options.reviewDashboardPath ?? DEFAULT_PLAUD_TRANSCRIPT_CONNECTOR_INPUTS.reviewDashboardPath);
  const reviewApiPath = path.resolve(options.reviewApiPath ?? DEFAULT_PLAUD_TRANSCRIPT_CONNECTOR_INPUTS.reviewApiPath);
  const [packageText, roadmapText, finalLedgerText, controlPlaneLoopText, reviewDashboardText, reviewApiText] = await Promise.all([
    readFile(packagePath, "utf8"),
    readFile(roadmapPath, "utf8"),
    readFile(finalLedgerPath, "utf8"),
    readFile(controlPlaneLoopPath, "utf8"),
    readFile(reviewDashboardPath, "utf8"),
    readFile(reviewApiPath, "utf8"),
  ]);
  return {
    package_text: packageText,
    roadmap_text: roadmapText,
    final_ledger_text: finalLedgerText,
    control_plane_loop_text: controlPlaneLoopText,
    review_dashboard_text: reviewDashboardText,
    review_api_text: reviewApiText,
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--check") {
      args.check = true;
      args.write = false;
    }
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--connector-contract-v2") args.connectorContractV2Path = argv[++index];
    else if (arg === "--vdr-connector") args.vdrConnectorPath = argv[++index];
    else if (arg === "--normalized-text-contract") args.normalizedTextContractPath = argv[++index];
    else if (arg === "--plaud-input") {
      args.plaudInputs = [...(args.plaudInputs ?? []), argv[++index]];
    } else if (arg === "--run-at") args.runAt = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/plaud-transcript-connector.mjs [--check] [--plaud-input path] [--out-dir path]\n\nWrites the Phase 274 Plaud transcript connector artifact.`);
}

function normalizeInputPaths(values) {
  return (Array.isArray(values) ? values : [values]).filter(Boolean).map((value) => path.resolve(value));
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function stableId(prefix, ...parts) {
  return `${prefix}.${sha256(parts.join("|")).slice(0, 24)}`;
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}

function dateStamp(value) {
  return value.slice(0, 10).replaceAll("-", "");
}

function toIso(value) {
  return new Date(value).toISOString();
}

function formatTimestamp(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = ms % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}
