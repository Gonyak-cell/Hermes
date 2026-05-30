import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_GITHUB_CONNECTOR_OUT_DIR = "artifacts/github-connector/latest";
export const DEFAULT_GITHUB_CONNECTOR_INPUTS = {
  connectorContractV2Path: "artifacts/connector-contract-v2/latest/connector-contract-v2.json",
  kakaotalkImportBoundaryPath: "artifacts/kakaotalk-import-boundary/latest/kakaotalk-import-boundary.json",
  githubInputs: ["examples/github-connector"],
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
  finalLedgerPath: "docs/final-completion-phase-ledger.md",
  controlPlaneLoopPath: "src/control-plane-loop.mjs",
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiPath: "src/review-api.mjs",
};

const CONNECTOR_ID = "connector.github.v2";
const CONNECTOR_PHASE = "P272";
const DEFAULT_TENANT_ID = "tenant.hermes.github.demo";
const DEFAULT_MATTER_ID = "matter.github.demo";
const DEFAULT_POLICY_SNAPSHOT_ID = "policy.github_connector.default.v1";
const DEFAULT_OWNER = "hermes-demo";
const DEFAULT_REPO = "matter-ops";

export async function runGitHubConnector(options = {}) {
  const result = await buildGitHubConnector(options);
  if (options.write !== false) await writeGitHubConnector(result, result.output_dir);
  if (options.check && (!result.validation.valid || result.summary.github_connector_status !== "complete")) {
    const error = new Error(`GitHub connector validation failed with ${result.validation.errors.length} error(s); status=${result.summary.github_connector_status}.`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildGitHubConnector(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_GITHUB_CONNECTOR_OUT_DIR);
  const connectorContractPath = path.resolve(options.connectorContractV2Path ?? DEFAULT_GITHUB_CONNECTOR_INPUTS.connectorContractV2Path);
  const kakaotalkImportBoundaryPath = path.resolve(options.kakaotalkImportBoundaryPath ?? DEFAULT_GITHUB_CONNECTOR_INPUTS.kakaotalkImportBoundaryPath);
  const githubInputs = normalizeInputPaths(options.githubInputs ?? DEFAULT_GITHUB_CONNECTOR_INPUTS.githubInputs);
  const connectorContract = await readJsonWithRetry(connectorContractPath);
  const kakaotalkImportBoundary = await readJsonWithRetry(kakaotalkImportBoundaryPath);
  const githubContract = pickGitHubConnectorContract(connectorContract);
  const sourceId = options.sourceId ?? githubContract.source_contract?.source_id ?? "source.github.v2";
  const sourceItems = await readGitHubInputs(githubInputs, {
    sourceId,
    generatedAt,
    tenantId: options.tenantId,
    matterId: options.matterId,
    policySnapshotId: options.policySnapshotId,
  });
  const repositories = buildRepositoryRecords(sourceItems, { sourceId, generatedAt });
  const connectorContractBinding = buildConnectorContractBinding(githubContract, connectorContract, sourceId, generatedAt);
  const sourceBinding = buildSourceBinding(githubContract, { sourceId, githubInputs, repositories, generatedAt });
  const authBoundary = buildAuthBoundary(githubContract.auth_boundary, generatedAt);
  const issueRecords = buildIssueRecords(sourceItems, { sourceId, generatedAt });
  const pullRequestRecords = buildPullRequestRecords(sourceItems, { sourceId, generatedAt });
  const commitRecords = buildCommitRecords(sourceItems, { sourceId, generatedAt });
  const reviewRecords = buildReviewRecords(sourceItems, pullRequestRecords, { sourceId, generatedAt });
  const workflowInputRecords = buildWorkflowInputRecords([...issueRecords, ...pullRequestRecords, ...commitRecords, ...reviewRecords], generatedAt);
  const cursorState = buildCursorState(githubContract.cursor_contract, [...issueRecords, ...pullRequestRecords, ...commitRecords, ...reviewRecords], {
    generatedAt,
    sourceId,
    repositories,
  });
  const boundary = buildBoundary(generatedAt);
  const docsAndCode = await readDocsAndCode(options);
  const validationItems = validateGitHubConnector({
    connectorContract,
    kakaotalkImportBoundary,
    githubContract,
    connectorContractBinding,
    sourceBinding,
    authBoundary,
    repositories,
    issueRecords,
    pullRequestRecords,
    commitRecords,
    reviewRecords,
    workflowInputRecords,
    cursorState,
    boundary,
    docsAndCode,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeGitHubConnector({
    kakaotalkImportBoundary,
    authBoundary,
    repositories,
    issueRecords,
    pullRequestRecords,
    commitRecords,
    reviewRecords,
    workflowInputRecords,
    cursorState,
    boundary,
    validation,
    sourceId,
  });

  const result = {
    schema_version: "github-connector.v1",
    generated_at: generatedAt,
    github_connector_id: `github-connector.${dateStamp(generatedAt)}`,
    connector_id: CONNECTOR_ID,
    connector_status: summary.github_connector_status,
    output_dir: outputDir,
    inputs: {
      connector_contract_v2_path: connectorContractPath,
      kakaotalk_import_boundary_path: kakaotalkImportBoundaryPath,
      github_inputs: githubInputs,
    },
    connector_contract_binding: connectorContractBinding,
    source_binding: sourceBinding,
    auth_boundary: authBoundary,
    github_repository_records: repositories,
    github_issue_records: issueRecords,
    github_pull_request_records: pullRequestRecords,
    github_commit_records: commitRecords,
    github_review_records: reviewRecords,
    github_workflow_input_records: workflowInputRecords,
    cursor_state: cursorState,
    github_connector_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };

  return {
    ...result,
    markdown: renderGitHubConnectorMarkdown(result),
  };
}

export async function writeGitHubConnector(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableGitHubConnector(result);
  await writeJson(path.join(outDir, "github-connector.json"), serializable);
  await writeJson(path.join(outDir, "github-repository-records.json"), {
    generated_at: result.generated_at,
    repository_record_count: result.github_repository_records.length,
    github_repository_records: result.github_repository_records,
  });
  await writeJson(path.join(outDir, "github-issue-records.json"), {
    generated_at: result.generated_at,
    issue_record_count: result.github_issue_records.length,
    github_issue_records: result.github_issue_records,
  });
  await writeJson(path.join(outDir, "github-pull-request-records.json"), {
    generated_at: result.generated_at,
    pull_request_record_count: result.github_pull_request_records.length,
    github_pull_request_records: result.github_pull_request_records,
  });
  await writeJson(path.join(outDir, "github-commit-records.json"), {
    generated_at: result.generated_at,
    commit_record_count: result.github_commit_records.length,
    github_commit_records: result.github_commit_records,
  });
  await writeJson(path.join(outDir, "github-review-records.json"), {
    generated_at: result.generated_at,
    review_record_count: result.github_review_records.length,
    github_review_records: result.github_review_records,
  });
  await writeJson(path.join(outDir, "github-workflow-input-records.json"), {
    generated_at: result.generated_at,
    workflow_input_record_count: result.github_workflow_input_records.length,
    github_workflow_input_records: result.github_workflow_input_records,
  });
  await writeJson(path.join(outDir, "cursor-state.json"), result.cursor_state);
  await writeJson(path.join(outDir, "auth-boundary.json"), result.auth_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    github_connector_id: result.github_connector_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runGitHubConnectorCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runGitHubConnector(args);
    console.log(`GitHub connector ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.github_connector_status}`);
    console.log(`Issues: ${result.summary.issue_count}`);
    console.log(`Pull requests: ${result.summary.pull_request_count}`);
    console.log(`Commits: ${result.summary.commit_count}`);
    console.log(`Reviews: ${result.summary.review_count}`);
    console.log(`Workflow inputs: ${result.summary.workflow_input_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function pickGitHubConnectorContract(connectorContract) {
  const byConnectorId = (items = []) => items.find((item) => item.connector_id === CONNECTOR_ID) ?? null;
  return {
    definition: byConnectorId(connectorContract.connector_definitions),
    source_contract: byConnectorId(connectorContract.connector_source_contracts),
    cursor_contract: byConnectorId(connectorContract.connector_cursor_contracts),
    external_id_contract: byConnectorId(connectorContract.connector_external_id_contracts),
    auth_boundary: byConnectorId(connectorContract.connector_auth_boundaries),
  };
}

function buildConnectorContractBinding(githubContract, connectorContract, sourceId, generatedAt) {
  return {
    schema_version: "github-connector-contract-binding.v1",
    binding_status: githubContract.definition?.connector_status === "contracted" ? "bound" : "attention",
    connector_id: CONNECTOR_ID,
    source_id: sourceId,
    source_system: "github",
    connector_family: "github",
    phase_slot: CONNECTOR_PHASE,
    connector_contract_version: connectorContract.schema_version,
    interface_schema_version: connectorContract.connector_interface_schema?.schema_version ?? null,
    source_contract_status: githubContract.source_contract?.source_contract_status ?? "unknown",
    cursor_contract_status: githubContract.cursor_contract?.cursor_contract_status ?? "unknown",
    external_id_contract_status: githubContract.external_id_contract?.external_id_contract_status ?? "unknown",
    auth_boundary_status: githubContract.auth_boundary?.auth_boundary_status ?? "unknown",
    generated_at: generatedAt,
  };
}

function buildSourceBinding(githubContract, context) {
  return {
    schema_version: "github-connector-source-binding.v1",
    source_binding_status: githubContract.source_contract?.source_contract_status === "contracted" ? "bound" : "attention",
    connector_id: CONNECTOR_ID,
    source_id: context.sourceId,
    source_system: "github",
    source_kind: "repo_api",
    repository_count: context.repositories.length,
    repository_full_names: context.repositories.map((repo) => repo.repository_full_name),
    source_inputs: context.githubInputs,
    source_id_strategy: githubContract.source_contract?.source_id_strategy ?? "deterministic_connector_source_id",
    tenant_id_required: true,
    matter_id_required: true,
    classification_required: true,
    policy_snapshot_required: true,
    source_uri_template: githubContract.source_contract?.source_uri_template ?? "github://{owner}/{repo}/{node_id}",
    resource_id_template: githubContract.source_contract?.resource_id_template ?? "resource.github.{external_id_hash}",
    generated_at: context.generatedAt,
  };
}

function buildAuthBoundary(authContract, generatedAt) {
  return {
    schema_version: "github-connector-auth-boundary.v1",
    auth_boundary_id: authContract?.auth_boundary_id ?? "auth.github.v2",
    auth_boundary_status: authContract?.auth_boundary_status ?? "unknown",
    auth_mode: authContract?.auth_mode ?? "app_installation_or_pat_readonly",
    credential_ref_required: true,
    credential_ref_kind: "github_app_installation_or_pat_reference",
    credential_reference_only: true,
    credential_material_read: false,
    raw_secret_material_allowed: false,
    least_privilege_scopes: authContract?.least_privilege_scopes ?? ["contents:read", "issues:read", "pull_requests:read"],
    external_network_access_required_for_runtime: true,
    external_network_access_performed: false,
    github_api_execution_performed: false,
    connector_execution_performed: true,
    local_export_read_performed: true,
    read_operations_allowed: true,
    write_operations_allowed: false,
    source_mutation_performed: false,
    issue_mutation_performed: false,
    pull_request_mutation_performed: false,
    repository_mutation_performed: false,
    branch_push_performed: false,
    merge_performed: false,
    release_performed: false,
    protected_action_allowed: false,
    delivery_execution_allowed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_required_for_resource_projection: true,
    generated_at: generatedAt,
  };
}

async function readGitHubInputs(inputPaths, context) {
  const items = [];
  for (const inputPath of inputPaths) {
    items.push(...(await readGitHubInputPath(inputPath, context)));
  }
  return items.sort((a, b) => a.repository_full_name.localeCompare(b.repository_full_name) || a.source_path.localeCompare(b.source_path));
}

async function readGitHubInputPath(inputPath, context) {
  const absolutePath = path.resolve(inputPath);
  const info = await stat(absolutePath);
  if (info.isDirectory()) {
    const entries = await readdir(absolutePath);
    const results = [];
    for (const entry of entries.sort()) {
      const childPath = path.join(absolutePath, entry);
      const childInfo = await stat(childPath);
      if (childInfo.isDirectory()) {
        results.push(...(await readGitHubInputPath(childPath, context)));
      } else if (/\.json$/i.test(entry)) {
        results.push(...(await readGitHubInputPath(childPath, context)));
      }
    }
    return results;
  }

  if (/\.json$/i.test(absolutePath)) {
    return normalizeGitHubExport(JSON.parse(await readFile(absolutePath, "utf8")), absolutePath, context);
  }

  throw new Error(`Unsupported GitHub connector input: ${inputPath}`);
}

function normalizeGitHubExport(raw, inputPath, context) {
  const exports = Array.isArray(raw) ? raw : [raw];
  return exports.map((item) => {
    const owner = item.owner ?? item.repository?.owner ?? DEFAULT_OWNER;
    const repo = item.repo ?? item.repository?.name ?? DEFAULT_REPO;
    const tenantId = context.tenantId ?? item.tenant_id ?? DEFAULT_TENANT_ID;
    const matterId = context.matterId ?? item.matter_id ?? DEFAULT_MATTER_ID;
    const policySnapshotId = context.policySnapshotId ?? item.policy_snapshot_id ?? DEFAULT_POLICY_SNAPSHOT_ID;
    return {
      source_path: inputPath,
      source_format: item.schema_version ?? "github-connector-export.v1",
      source_id: context.sourceId,
      tenant_id: tenantId,
      matter_id: matterId,
      policy_snapshot_id: policySnapshotId,
      owner,
      repo,
      repository_id: item.repository_id ?? item.repository?.id ?? `${owner}/${repo}`,
      repository_node_id: item.repository_node_id ?? item.repository?.node_id ?? `R_${shortHash(`${owner}/${repo}`)}`,
      repository_full_name: `${owner}/${repo}`,
      default_branch: item.default_branch ?? item.repository?.default_branch ?? "main",
      exported_at: item.exported_at ?? context.generatedAt,
      issues: item.issues ?? [],
      pull_requests: item.pull_requests ?? item.pullRequests ?? [],
      commits: item.commits ?? [],
      reviews: item.reviews ?? item.pull_request_reviews ?? [],
      generated_at: context.generatedAt,
    };
  });
}

function buildRepositoryRecords(sourceItems, context) {
  const byFullName = new Map();
  for (const item of sourceItems) {
    if (byFullName.has(item.repository_full_name)) continue;
    const externalId = buildExternalId(context.sourceId, item.owner, item.repo, item.repository_node_id);
    const resourceId = `resource.github.repository.${shortHash(externalId)}`;
    byFullName.set(item.repository_full_name, {
      schema_version: "github-repository-record.v1",
      repository_record_id: `github-repository.${shortHash(externalId)}`,
      connector_id: CONNECTOR_ID,
      source_id: context.sourceId,
      tenant_id: item.tenant_id,
      matter_id: item.matter_id,
      policy_snapshot_id: item.policy_snapshot_id,
      source_system: "github",
      source_format: item.source_format,
      source_path: item.source_path,
      owner: item.owner,
      repo: item.repo,
      repository_id: String(item.repository_id),
      repository_node_id: item.repository_node_id,
      repository_full_name: item.repository_full_name,
      default_branch: item.default_branch,
      external_id: externalId,
      external_version_id: `${externalId}:version:${shortHash(`${item.default_branch}:${item.exported_at}`)}`,
      resource_id: resourceId,
      resource_version_id: `${resourceId}.v.${shortHash(`${item.default_branch}:${item.exported_at}`)}`,
      repository_status: "resource_candidate_ready",
      github_resource_status: "ready",
      resource_projection_status: "ready",
      review_status: "needs_review",
      classification: "confidential",
      human_review_required: true,
      source_mutation_performed: false,
      resource_mutation_performed: false,
      client_facing_output_generated: false,
      audit_trail: buildAuditTrail("github_repository_export_metadata", item.repository_full_name, context.generatedAt),
      generated_at: context.generatedAt,
    });
  }
  return [...byFullName.values()];
}

function buildIssueRecords(sourceItems, context) {
  const records = [];
  for (const sourceItem of sourceItems) {
    for (const [index, issue] of sourceItem.issues.entries()) {
      const nodeId = String(issue.node_id ?? issue.id ?? `issue-${issue.number ?? index + 1}`);
      const externalId = buildExternalId(context.sourceId, sourceItem.owner, sourceItem.repo, nodeId);
      const externalVersionId = `${externalId}:version:${shortHash(`${issue.updated_at ?? sourceItem.exported_at}:${issue.state ?? ""}:${issue.title ?? ""}`)}`;
      const resourceId = `resource.github.issue.${shortHash(externalId)}`;
      records.push({
        schema_version: "github-issue-record.v1",
        issue_record_id: `github-issue.${shortHash(`${externalId}:${index}`)}`,
        connector_id: CONNECTOR_ID,
        source_id: context.sourceId,
        tenant_id: sourceItem.tenant_id,
        matter_id: sourceItem.matter_id,
        policy_snapshot_id: sourceItem.policy_snapshot_id,
        source_system: "github",
        source_format: sourceItem.source_format,
        source_path: sourceItem.source_path,
        owner: sourceItem.owner,
        repo: sourceItem.repo,
        repository_full_name: sourceItem.repository_full_name,
        node_id: nodeId,
        number: Number(issue.number ?? index + 1),
        title: String(issue.title ?? "(untitled issue)"),
        body_preview: previewText(issue.body),
        body_hash_sha256: hashValue(issue.body ?? ""),
        state: issue.state ?? "open",
        author_login: issue.author_login ?? issue.user?.login ?? "unknown",
        labels: normalizeStringArray(issue.labels),
        assignees: normalizeStringArray(issue.assignees),
        milestone: issue.milestone ?? null,
        html_url: issue.html_url ?? issue.url ?? null,
        created_at: issue.created_at ?? sourceItem.exported_at,
        updated_at: issue.updated_at ?? issue.created_at ?? sourceItem.exported_at,
        closed_at: issue.closed_at ?? null,
        external_id: externalId,
        external_version_id: externalVersionId,
        resource_id: resourceId,
        resource_version_id: `${resourceId}.v.${shortHash(externalVersionId)}`,
        resource_type: "github_issue",
        issue_status: "resource_candidate_ready",
        github_resource_status: "ready",
        workflow_input_status: "ready",
        resource_projection_status: "ready",
        review_status: "needs_review",
        classification: "confidential",
        idempotency_key: hashValue(`${externalId}:${externalVersionId}`),
        metadata_complete: Boolean(issue.title && nodeId && issue.updated_at),
        human_review_required: true,
        source_mutation_performed: false,
        resource_mutation_performed: false,
        client_facing_output_generated: false,
        audit_trail: buildAuditTrail("github_issue_export", `${sourceItem.repository_full_name}#${issue.number ?? index + 1}`, context.generatedAt),
        generated_at: context.generatedAt,
      });
    }
  }
  return records;
}

function buildPullRequestRecords(sourceItems, context) {
  const records = [];
  for (const sourceItem of sourceItems) {
    for (const [index, pr] of sourceItem.pull_requests.entries()) {
      const nodeId = String(pr.node_id ?? pr.id ?? `pull-request-${pr.number ?? index + 1}`);
      const externalId = buildExternalId(context.sourceId, sourceItem.owner, sourceItem.repo, nodeId);
      const externalVersionId = `${externalId}:version:${shortHash(`${pr.updated_at ?? sourceItem.exported_at}:${pr.state ?? ""}:${pr.head_sha ?? ""}:${pr.title ?? ""}`)}`;
      const resourceId = `resource.github.pull_request.${shortHash(externalId)}`;
      records.push({
        schema_version: "github-pull-request-record.v1",
        pull_request_record_id: `github-pull-request.${shortHash(`${externalId}:${index}`)}`,
        connector_id: CONNECTOR_ID,
        source_id: context.sourceId,
        tenant_id: sourceItem.tenant_id,
        matter_id: sourceItem.matter_id,
        policy_snapshot_id: sourceItem.policy_snapshot_id,
        source_system: "github",
        source_format: sourceItem.source_format,
        source_path: sourceItem.source_path,
        owner: sourceItem.owner,
        repo: sourceItem.repo,
        repository_full_name: sourceItem.repository_full_name,
        node_id: nodeId,
        number: Number(pr.number ?? index + 1),
        title: String(pr.title ?? "(untitled pull request)"),
        body_preview: previewText(pr.body),
        body_hash_sha256: hashValue(pr.body ?? ""),
        state: pr.state ?? "open",
        author_login: pr.author_login ?? pr.user?.login ?? "unknown",
        base_ref: pr.base_ref ?? pr.base?.ref ?? "main",
        head_ref: pr.head_ref ?? pr.head?.ref ?? null,
        head_sha: pr.head_sha ?? pr.head?.sha ?? null,
        merge_commit_sha: pr.merge_commit_sha ?? null,
        changed_files: Number(pr.changed_files ?? 0),
        additions: Number(pr.additions ?? 0),
        deletions: Number(pr.deletions ?? 0),
        review_decision: pr.review_decision ?? "review_required",
        html_url: pr.html_url ?? pr.url ?? null,
        created_at: pr.created_at ?? sourceItem.exported_at,
        updated_at: pr.updated_at ?? pr.created_at ?? sourceItem.exported_at,
        merged_at: pr.merged_at ?? null,
        closed_at: pr.closed_at ?? null,
        external_id: externalId,
        external_version_id: externalVersionId,
        resource_id: resourceId,
        resource_version_id: `${resourceId}.v.${shortHash(externalVersionId)}`,
        resource_type: "github_pull_request",
        pull_request_status: "resource_candidate_ready",
        github_resource_status: "ready",
        workflow_input_status: "ready",
        resource_projection_status: "ready",
        review_status: "needs_review",
        classification: "confidential",
        idempotency_key: hashValue(`${externalId}:${externalVersionId}`),
        metadata_complete: Boolean(pr.title && nodeId && pr.updated_at && (pr.base_ref ?? pr.base?.ref)),
        human_review_required: true,
        source_mutation_performed: false,
        resource_mutation_performed: false,
        client_facing_output_generated: false,
        audit_trail: buildAuditTrail("github_pull_request_export", `${sourceItem.repository_full_name}#${pr.number ?? index + 1}`, context.generatedAt),
        generated_at: context.generatedAt,
      });
    }
  }
  return records;
}

function buildCommitRecords(sourceItems, context) {
  const records = [];
  for (const sourceItem of sourceItems) {
    for (const [index, commit] of sourceItem.commits.entries()) {
      const sha = String(commit.sha ?? commit.oid ?? `commit-${index + 1}`);
      const nodeId = String(commit.node_id ?? `C_${sha}`);
      const externalId = buildExternalId(context.sourceId, sourceItem.owner, sourceItem.repo, nodeId);
      const externalVersionId = `${externalId}:version:${shortHash(`${sha}:${commit.committed_at ?? sourceItem.exported_at}:${commit.message ?? ""}`)}`;
      const resourceId = `resource.github.commit.${shortHash(externalId)}`;
      records.push({
        schema_version: "github-commit-record.v1",
        commit_record_id: `github-commit.${shortHash(`${externalId}:${index}`)}`,
        connector_id: CONNECTOR_ID,
        source_id: context.sourceId,
        tenant_id: sourceItem.tenant_id,
        matter_id: sourceItem.matter_id,
        policy_snapshot_id: sourceItem.policy_snapshot_id,
        source_system: "github",
        source_format: sourceItem.source_format,
        source_path: sourceItem.source_path,
        owner: sourceItem.owner,
        repo: sourceItem.repo,
        repository_full_name: sourceItem.repository_full_name,
        node_id: nodeId,
        sha,
        short_sha: sha.slice(0, 12),
        message_preview: previewText(commit.message),
        message_hash_sha256: hashValue(commit.message ?? ""),
        author_login: commit.author_login ?? commit.author?.login ?? "unknown",
        author_name: commit.author_name ?? commit.commit?.author?.name ?? null,
        committed_at: commit.committed_at ?? commit.date ?? sourceItem.exported_at,
        parent_shas: normalizeStringArray(commit.parent_shas ?? commit.parents),
        changed_files: Number(commit.changed_files ?? 0),
        additions: Number(commit.additions ?? 0),
        deletions: Number(commit.deletions ?? 0),
        external_id: externalId,
        external_version_id: externalVersionId,
        resource_id: resourceId,
        resource_version_id: `${resourceId}.v.${shortHash(externalVersionId)}`,
        resource_type: "github_commit",
        commit_status: "resource_candidate_ready",
        github_resource_status: "ready",
        workflow_input_status: "ready",
        resource_projection_status: "ready",
        review_status: "needs_review",
        classification: "confidential",
        idempotency_key: hashValue(`${externalId}:${externalVersionId}`),
        metadata_complete: Boolean(sha && commit.message && (commit.committed_at ?? commit.date)),
        human_review_required: true,
        source_mutation_performed: false,
        resource_mutation_performed: false,
        client_facing_output_generated: false,
        audit_trail: buildAuditTrail("github_commit_export", `${sourceItem.repository_full_name}@${sha}`, context.generatedAt),
        generated_at: context.generatedAt,
      });
    }
  }
  return records;
}

function buildReviewRecords(sourceItems, pullRequestRecords, context) {
  const pullRequestByNumber = new Map(pullRequestRecords.map((pr) => [`${pr.repository_full_name}#${pr.number}`, pr]));
  const records = [];
  for (const sourceItem of sourceItems) {
    for (const [index, review] of sourceItem.reviews.entries()) {
      const nodeId = String(review.node_id ?? review.id ?? `review-${review.pull_request_number ?? index + 1}`);
      const pullRequestNumber = Number(review.pull_request_number ?? review.pull_request?.number ?? 0);
      const parentPullRequest = pullRequestByNumber.get(`${sourceItem.repository_full_name}#${pullRequestNumber}`);
      const externalId = buildExternalId(context.sourceId, sourceItem.owner, sourceItem.repo, nodeId);
      const externalVersionId = `${externalId}:version:${shortHash(`${review.submitted_at ?? sourceItem.exported_at}:${review.state ?? ""}:${review.body ?? ""}`)}`;
      const resourceId = `resource.github.review.${shortHash(externalId)}`;
      records.push({
        schema_version: "github-review-record.v1",
        review_record_id: `github-review.${shortHash(`${externalId}:${index}`)}`,
        pull_request_record_id: parentPullRequest?.pull_request_record_id ?? null,
        parent_pull_request_resource_id: parentPullRequest?.resource_id ?? null,
        connector_id: CONNECTOR_ID,
        source_id: context.sourceId,
        tenant_id: sourceItem.tenant_id,
        matter_id: sourceItem.matter_id,
        policy_snapshot_id: sourceItem.policy_snapshot_id,
        source_system: "github",
        source_format: sourceItem.source_format,
        source_path: sourceItem.source_path,
        owner: sourceItem.owner,
        repo: sourceItem.repo,
        repository_full_name: sourceItem.repository_full_name,
        node_id: nodeId,
        pull_request_number: pullRequestNumber,
        reviewer_login: review.reviewer_login ?? review.user?.login ?? "unknown",
        state: review.state ?? "COMMENTED",
        body_preview: previewText(review.body),
        body_hash_sha256: hashValue(review.body ?? ""),
        submitted_at: review.submitted_at ?? sourceItem.exported_at,
        commit_sha: review.commit_sha ?? parentPullRequest?.head_sha ?? null,
        external_id: externalId,
        external_version_id: externalVersionId,
        resource_id: resourceId,
        resource_version_id: `${resourceId}.v.${shortHash(externalVersionId)}`,
        resource_type: "github_review",
        github_review_status: "resource_candidate_ready",
        github_resource_status: "ready",
        workflow_input_status: "ready",
        resource_projection_status: "ready",
        review_status: "needs_review",
        classification: "confidential",
        idempotency_key: hashValue(`${externalId}:${externalVersionId}`),
        metadata_complete: Boolean(nodeId && pullRequestNumber && review.state && review.submitted_at),
        human_review_required: true,
        source_mutation_performed: false,
        resource_mutation_performed: false,
        client_facing_output_generated: false,
        audit_trail: buildAuditTrail("github_pull_request_review_export", `${sourceItem.repository_full_name}#${pullRequestNumber}/review/${nodeId}`, context.generatedAt),
        generated_at: context.generatedAt,
      });
    }
  }
  return records;
}

function buildWorkflowInputRecords(resourceRecords, generatedAt) {
  return resourceRecords.map((record) => ({
    schema_version: "github-workflow-input-record.v1",
    workflow_input_record_id: `github-workflow-input.${shortHash(record.resource_id)}`,
    connector_id: CONNECTOR_ID,
    source_id: record.source_id,
    tenant_id: record.tenant_id,
    matter_id: record.matter_id,
    policy_snapshot_id: record.policy_snapshot_id,
    source_system: "github",
    repository_full_name: record.repository_full_name,
    source_resource_record_id: record.issue_record_id ?? record.pull_request_record_id ?? record.commit_record_id ?? record.review_record_id,
    source_resource_id: record.resource_id,
    source_resource_type: record.resource_type,
    workflow_input_type: workflowInputType(record.resource_type),
    workflow_input_status: "ready",
    task_signal_status: "candidate",
    review_status: "needs_review",
    title: record.title ?? record.message_preview ?? `${record.resource_type}:${record.node_id}`,
    event_time: record.updated_at ?? record.committed_at ?? record.submitted_at ?? record.created_at ?? generatedAt,
    human_review_required: true,
    source_mutation_performed: false,
    workflow_state_mutation_performed: false,
    protected_action_executed: false,
    audit_trail: buildAuditTrail("github_workflow_input_projection", record.resource_id, generatedAt),
    generated_at: generatedAt,
  }));
}

function buildCursorState(cursorContract, records, context) {
  const sorted = [...records].sort((a, b) => String(a.updated_at ?? a.committed_at ?? a.submitted_at ?? a.created_at ?? "").localeCompare(String(b.updated_at ?? b.committed_at ?? b.submitted_at ?? b.created_at ?? "")));
  const lastSeen = sorted.at(-1) ?? null;
  const cursorPayload = {
    source_id: context.sourceId,
    repositories: context.repositories.map((repo) => repo.repository_full_name),
    last_seen_external_id: lastSeen?.external_id ?? null,
    last_event_time: lastSeen?.updated_at ?? lastSeen?.committed_at ?? lastSeen?.submitted_at ?? lastSeen?.created_at ?? null,
    record_count: records.length,
  };
  return {
    schema_version: "github-connector-cursor-state.v1",
    cursor_id: cursorContract?.cursor_id ?? "cursor.github.v2",
    cursor_status: "complete",
    cursor_kind: cursorContract?.cursor_kind ?? "repo_event_since_cursor",
    connector_id: CONNECTOR_ID,
    source_id: context.sourceId,
    queued_count: 0,
    repository_count: context.repositories.length,
    last_seen_external_id: cursorPayload.last_seen_external_id,
    last_event_time: cursorPayload.last_event_time,
    resume_supported: true,
    cursor_storage_mode: "repo_since_timestamp_hash_only",
    resume_token_hash: hashValue(JSON.stringify(cursorPayload)),
    raw_since_cursor_material_allowed: false,
    raw_cursor_material_allowed: false,
    cross_matter_cursor_reuse_allowed: false,
    reset_requires_human_review: true,
    external_network_access_performed: false,
    source_mutation_performed: false,
    updated_at: context.generatedAt,
  };
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "github-connector-boundary.v1",
    boundary_status: "enforced",
    phase_slot: CONNECTOR_PHASE,
    local_export_read_performed: true,
    github_api_execution_performed: false,
    external_network_access_performed: false,
    connector_execution_performed: true,
    source_read_performed: true,
    credential_material_read: false,
    raw_secret_material_allowed: false,
    source_mutation_performed: false,
    resource_mutation_performed: false,
    issue_mutation_performed: false,
    pull_request_mutation_performed: false,
    repository_mutation_performed: false,
    branch_push_performed: false,
    merge_performed: false,
    release_performed: false,
    workflow_state_mutation_performed: false,
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
    package_path: path.resolve(options.packagePath ?? DEFAULT_GITHUB_CONNECTOR_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_GITHUB_CONNECTOR_INPUTS.roadmapPath),
    final_ledger_path: path.resolve(options.finalLedgerPath ?? DEFAULT_GITHUB_CONNECTOR_INPUTS.finalLedgerPath),
    control_plane_loop_path: path.resolve(options.controlPlaneLoopPath ?? DEFAULT_GITHUB_CONNECTOR_INPUTS.controlPlaneLoopPath),
    review_dashboard_path: path.resolve(options.reviewDashboardPath ?? DEFAULT_GITHUB_CONNECTOR_INPUTS.reviewDashboardPath),
    review_api_path: path.resolve(options.reviewApiPath ?? DEFAULT_GITHUB_CONNECTOR_INPUTS.reviewApiPath),
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

function validateGitHubConnector({ connectorContract, kakaotalkImportBoundary, githubContract, connectorContractBinding, sourceBinding, authBoundary, repositories, issueRecords, pullRequestRecords, commitRecords, reviewRecords, workflowInputRecords, cursorState, boundary, docsAndCode }) {
  const resourceRecords = [...issueRecords, ...pullRequestRecords, ...commitRecords, ...reviewRecords];
  const items = [];
  pushCheck(items, "connector_contract.github", githubContract.definition?.connector_status === "contracted" && githubContract.definition?.phase_slot === CONNECTOR_PHASE, "P267 connector contract includes connector.github.v2 for P272.");
  pushCheck(items, "connector_contract.source", githubContract.source_contract?.source_id === sourceBinding.source_id && sourceBinding.source_binding_status === "bound", "GitHub source_id is bound to the P267 source contract.");
  pushCheck(items, "connector_contract.cursor", githubContract.cursor_contract?.cursor_kind === "repo_event_since_cursor" && cursorState.resume_supported === true && cursorState.raw_since_cursor_material_allowed === false, "GitHub connector uses repo event since-cursor semantics without raw cursor material.");
  pushCheck(items, "connector_contract.external_id", githubContract.external_id_contract?.external_id_contract_status === "contracted" && resourceRecords.every((row) => row.external_id && row.external_version_id && row.resource_id && row.resource_version_id), "Every GitHub issue, PR, commit, and review has an external_id/resource projection candidate.");
  pushCheck(items, "connector_contract.auth_boundary", authBoundary.auth_boundary_status === "enforced" && authBoundary.auth_mode === "app_installation_or_pat_readonly" && authBoundary.credential_ref_required === true && authBoundary.credential_reference_only === true && authBoundary.raw_secret_material_allowed === false, "GitHub auth boundary is credential-reference-only and raw-secret-free.");
  pushCheck(items, "windows_baseline.kakaotalk_import", kakaotalkImportBoundary.summary?.kakaotalk_import_boundary_status === "complete" && kakaotalkImportBoundary.summary?.external_network_access_performed === false && kakaotalkImportBoundary.summary?.source_mutation_performed === false, "P271 KakaoTalk Import Boundary baseline remains complete and non-mutating before P272.");
  pushCheck(items, "binding.phase", connectorContractBinding.binding_status === "bound" && connectorContractBinding.phase_slot === CONNECTOR_PHASE, "GitHub connector binding is attached to P272.");
  pushCheck(items, "repositories.present", repositories.length > 0 && repositories.every((repo) => repo.repository_status === "resource_candidate_ready" && repo.repository_full_name), "GitHub repository export metadata is represented.");
  pushCheck(items, "issues.present", issueRecords.length > 0 && issueRecords.every((issue) => issue.issue_status === "resource_candidate_ready" && issue.resource_type === "github_issue" && issue.metadata_complete), "GitHub issues are projected as issue resource candidates.");
  pushCheck(items, "pull_requests.present", pullRequestRecords.length > 0 && pullRequestRecords.every((pr) => pr.pull_request_status === "resource_candidate_ready" && pr.resource_type === "github_pull_request" && pr.metadata_complete), "GitHub pull requests are projected as pull request resource candidates.");
  pushCheck(items, "commits.present", commitRecords.length > 0 && commitRecords.every((commit) => commit.commit_status === "resource_candidate_ready" && commit.resource_type === "github_commit" && commit.metadata_complete), "GitHub commits are projected as commit resource candidates.");
  pushCheck(items, "reviews.present", reviewRecords.length > 0 && reviewRecords.every((review) => review.github_review_status === "resource_candidate_ready" && review.resource_type === "github_review" && review.parent_pull_request_resource_id && review.metadata_complete), "GitHub pull request reviews are projected as review resource candidates linked to PRs.");
  pushCheck(items, "workflow_inputs.bound", workflowInputRecords.length === resourceRecords.length && workflowInputRecords.every((input) => input.workflow_input_status === "ready" && input.source_resource_id && input.human_review_required), "Every GitHub resource candidate has a workflow input projection.");
  pushCheck(items, "resources.review_gate", [...resourceRecords, ...workflowInputRecords].every((row) => row.review_status === "needs_review" && row.human_review_required), "GitHub resource and workflow projections remain human-review gated.");
  pushCheck(items, "boundary.no_live_api_or_secret", boundary.github_api_execution_performed === false && boundary.external_network_access_performed === false && boundary.credential_material_read === false && authBoundary.raw_secret_material_allowed === false, "GitHub artifact performs no live API call, network access, credential read, or raw secret handling.");
  pushCheck(items, "boundary.no_mutation_or_delivery", boundary.source_mutation_performed === false && boundary.resource_mutation_performed === false && boundary.issue_mutation_performed === false && boundary.pull_request_mutation_performed === false && boundary.repository_mutation_performed === false && boundary.branch_push_performed === false && boundary.merge_performed === false && boundary.release_performed === false && boundary.output_delivery_performed === false && boundary.protected_action_executed === false, "GitHub artifact performs no source/resource/repo mutation, push, merge, release, delivery, or protected action.");
  pushCheck(items, "boundary.no_legal_or_client_output", boundary.legal_advice_generated === false && boundary.client_facing_output_generated === false && boundary.human_review_required === true, "GitHub artifact produces no legal advice or client-facing output and remains human-review gated.");
  pushCheck(items, "package.script", Boolean(docsAndCode.package_json?.scripts?.["connectors:github"]), "package.json registers connectors:github.");
  pushCheck(items, "roadmap.slot", typeof docsAndCode.roadmap_text === "string" && docsAndCode.roadmap_text.includes("Phase 272") && docsAndCode.final_ledger_text.includes("P272") && docsAndCode.final_ledger_text.includes("GitHub connector"), "Roadmap and final ledger promote P272 GitHub connector.");
  pushCheck(items, "loop.bound", docsAndCode.control_plane_loop_text.includes("github_connector") && docsAndCode.control_plane_loop_text.includes("connectors:github"), "Control-plane loop includes GitHub connector.");
  pushCheck(items, "dashboard.bound", docsAndCode.review_dashboard_text.includes("github_connector"), "Review Dashboard includes GitHub connector.");
  pushCheck(items, "api.bound", docsAndCode.review_api_text.includes("/api/github-connector"), "Review API exposes GitHub connector routes.");
  pushCheck(items, "contract_source.complete", connectorContract.summary?.connector_contract_status === "complete", "Connector Contract v2 source artifact is complete.");
  return items;
}

function summarizeGitHubConnector({ kakaotalkImportBoundary, authBoundary, repositories, issueRecords, pullRequestRecords, commitRecords, reviewRecords, workflowInputRecords, cursorState, boundary, validation, sourceId }) {
  const resourceCandidateCount = issueRecords.length + pullRequestRecords.length + commitRecords.length + reviewRecords.length;
  const status = validation.errors.length > 0 ? "attention" : "complete";
  return {
    github_connector_status: status,
    connector_id: CONNECTOR_ID,
    source_id: sourceId,
    phase_slot: CONNECTOR_PHASE,
    source_kakaotalk_import_boundary_status: kakaotalkImportBoundary.summary?.kakaotalk_import_boundary_status ?? "unknown",
    repository_count: repositories.length,
    issue_count: issueRecords.length,
    pull_request_count: pullRequestRecords.length,
    commit_count: commitRecords.length,
    review_count: reviewRecords.length,
    workflow_input_count: workflowInputRecords.length,
    issue_resource_count: issueRecords.filter((issue) => issue.resource_id).length,
    pull_request_resource_count: pullRequestRecords.filter((pr) => pr.resource_id).length,
    commit_resource_count: commitRecords.filter((commit) => commit.resource_id).length,
    review_resource_count: reviewRecords.filter((review) => review.resource_id).length,
    resource_candidate_count: resourceCandidateCount,
    metadata_complete_issue_count: issueRecords.filter((issue) => issue.metadata_complete).length,
    metadata_complete_pull_request_count: pullRequestRecords.filter((pr) => pr.metadata_complete).length,
    metadata_complete_commit_count: commitRecords.filter((commit) => commit.metadata_complete).length,
    metadata_complete_review_count: reviewRecords.filter((review) => review.metadata_complete).length,
    review_parent_link_count: reviewRecords.filter((review) => review.parent_pull_request_resource_id).length,
    workflow_input_link_count: workflowInputRecords.filter((input) => input.source_resource_id).length,
    cursor_status: cursorState.cursor_status,
    cursor_kind: cursorState.cursor_kind,
    cursor_resume_supported: cursorState.resume_supported,
    raw_since_cursor_material_allowed: cursorState.raw_since_cursor_material_allowed,
    auth_boundary_status: authBoundary.auth_boundary_status,
    credential_ref_required: authBoundary.credential_ref_required,
    credential_reference_only: authBoundary.credential_reference_only,
    raw_secret_material_allowed: authBoundary.raw_secret_material_allowed,
    least_privilege_scope_count: authBoundary.least_privilege_scopes.length,
    read_operations_allowed: authBoundary.read_operations_allowed,
    write_operations_allowed: authBoundary.write_operations_allowed,
    external_network_access_required_for_runtime: authBoundary.external_network_access_required_for_runtime,
    local_export_read_performed: boundary.local_export_read_performed,
    github_api_execution_performed: boundary.github_api_execution_performed,
    external_network_access_performed: boundary.external_network_access_performed,
    connector_execution_performed: boundary.connector_execution_performed,
    source_read_performed: boundary.source_read_performed,
    credential_material_read: boundary.credential_material_read,
    source_mutation_performed: boundary.source_mutation_performed,
    resource_mutation_performed: boundary.resource_mutation_performed,
    issue_mutation_performed: boundary.issue_mutation_performed,
    pull_request_mutation_performed: boundary.pull_request_mutation_performed,
    repository_mutation_performed: boundary.repository_mutation_performed,
    branch_push_performed: boundary.branch_push_performed,
    merge_performed: boundary.merge_performed,
    release_performed: boundary.release_performed,
    workflow_state_mutation_performed: boundary.workflow_state_mutation_performed,
    output_delivery_performed: boundary.output_delivery_performed,
    protected_action_executed: boundary.protected_action_executed,
    legal_advice_generated: boundary.legal_advice_generated,
    client_facing_output_generated: boundary.client_facing_output_generated,
    human_review_required_count: [...issueRecords, ...pullRequestRecords, ...commitRecords, ...reviewRecords].filter((row) => row.human_review_required).length,
    workflow_input_human_review_required_count: workflowInputRecords.filter((row) => row.human_review_required).length,
    validation_item_count: validation.items.length,
    validation_error_count: validation.errors.length,
  };
}

function renderGitHubConnectorMarkdown(result) {
  const lines = [];
  lines.push("# GitHub Connector");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.github_connector_status}`);
  lines.push(`Connector: ${result.connector_id}`);
  lines.push(`Source: ${result.summary.source_id}`);
  lines.push(`Repositories: ${result.summary.repository_count}`);
  lines.push(`Issues: ${result.summary.issue_count}`);
  lines.push(`Pull requests: ${result.summary.pull_request_count}`);
  lines.push(`Commits: ${result.summary.commit_count}`);
  lines.push(`Reviews: ${result.summary.review_count}`);
  lines.push(`Workflow inputs: ${result.summary.workflow_input_count}`);
  lines.push("");
  lines.push("## Boundary");
  lines.push("");
  lines.push("- The artifact reads only operator-provided GitHub export JSON.");
  lines.push("- It does not call the GitHub API, access the network, read credentials, mutate issues/PRs/repos, push branches, merge, release, deliver outputs, or perform protected actions.");
  lines.push("- Issue, pull request, commit, review, and workflow input candidates remain human-review gated.");
  lines.push("- The artifact does not provide legal advice and does not create client-facing work product.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { githubInputs: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--connector-contract-v2") parsed.connectorContractV2Path = argv[++index];
    else if (arg === "--kakaotalk-import-boundary") parsed.kakaotalkImportBoundaryPath = argv[++index];
    else if (arg === "--github-input") parsed.githubInputs.push(argv[++index]);
    else if (arg === "--source-id") parsed.sourceId = argv[++index];
    else if (arg === "--tenant-id") parsed.tenantId = argv[++index];
    else if (arg === "--matter-id") parsed.matterId = argv[++index];
    else if (arg === "--policy-snapshot-id") parsed.policySnapshotId = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (parsed.githubInputs.length === 0) delete parsed.githubInputs;
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/github-connector.mjs [options]

Options:
  --check                         Fail unless the connector reaches complete status.
  --out-dir <folder>              Output directory.
  --connector-contract-v2 <path>  Connector Contract v2 artifact.
  --kakaotalk-import-boundary <path> P271 KakaoTalk Import Boundary artifact.
  --github-input <path>           Local GitHub export JSON file or folder. Can be repeated.
  --source-id <id>                Connector source id.
  --tenant-id <id>                Tenant id for connector rows.
  --matter-id <id>                Matter id for connector rows.
  --policy-snapshot-id <id>       Policy snapshot id.
  --run-at <iso>                  Deterministic generated_at timestamp.
`);
}

function workflowInputType(resourceType) {
  if (resourceType === "github_issue") return "issue_task_signal";
  if (resourceType === "github_pull_request") return "pull_request_review_signal";
  if (resourceType === "github_commit") return "commit_change_signal";
  if (resourceType === "github_review") return "pull_request_review_comment_signal";
  return "github_signal";
}

function buildExternalId(sourceId, owner, repo, nodeId) {
  return `${sourceId}:${owner}/${repo}:${nodeId}`;
}

function buildAuditTrail(sourceType, sourceRef, generatedAt) {
  return {
    source: sourceRef,
    source_type: sourceType,
    timestamp: generatedAt,
    confidence: "high",
    responsible_owner: CONNECTOR_ID,
    review_status: "needs_review",
  };
}

function normalizeStringArray(value) {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  return items.map((item) => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object") return item.name ?? item.login ?? item.sha ?? JSON.stringify(item);
    return String(item);
  });
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

function serializableGitHubConnector(result) {
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
