import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CAPABILITY_REGISTRY_API_OUT_DIR = "artifacts/capability-registry-api/latest";
export const DEFAULT_CAPABILITY_REGISTRY_API_INPUTS = {
  domainPackRegistryPath: "artifacts/domain-packs/latest/domain-pack-registry.json",
  capabilityManifestV2Path: "artifacts/capability-manifest-v2/latest/capability-manifest-v2.json",
  packManifestCompatibilityPath: "artifacts/pack-manifest-compatibility/latest/pack-manifest-compatibility.json",
  gateResultAggregatorPath: "artifacts/gate-result-aggregator/latest/gate-result-aggregator.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CAPABILITY_REGISTRY_API_CONTRACT_ID = "capability-registry-api.v1";
const READ_ONLY_ROUTE_METHOD = "GET";

export async function runCapabilityRegistryApi(options = {}) {
  const result = await buildCapabilityRegistryApi(options);
  if (options.write !== false) await writeCapabilityRegistryApi(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Capability registry API validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildCapabilityRegistryApi(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CAPABILITY_REGISTRY_API_OUT_DIR);
  const inputs = normalizeInputs(options);
  const domainPackRegistry = await readJson(inputs.domain_pack_registry_path);
  const capabilityManifestV2 = await readJson(inputs.capability_manifest_v2_path);
  const packManifestCompatibility = await readJson(inputs.pack_manifest_compatibility_path);
  const gateResultAggregator = await readJson(inputs.gate_result_aggregator_path);
  const packageJson = await readJson(inputs.package_path);
  const roadmapText = await readFile(inputs.roadmap_path, "utf8");

  const packApiCards = buildPackApiCards({
    domainPackRegistry,
    packManifestCompatibility,
    generatedAt,
  });
  const capabilityApiCards = buildCapabilityApiCards({
    domainPackRegistry,
    capabilityManifestV2,
    generatedAt,
  });
  const capabilityVersionApiCards = buildCapabilityVersionApiCards({
    capabilityManifestV2,
    generatedAt,
  });
  const gateRequirementApiCards = buildGateRequirementApiCards({
    capabilityManifestV2,
    gateResultAggregator,
    generatedAt,
  });
  const desktopCompanionRouteGroups = buildDesktopCompanionRouteGroups(generatedAt);
  const routeRecords = desktopCompanionRouteGroups.flatMap((group) => group.routes);
  const validationItems = validateCapabilityRegistryApi({
    domainPackRegistry,
    capabilityManifestV2,
    packManifestCompatibility,
    gateResultAggregator,
    packageJson,
    roadmapText,
    packApiCards,
    capabilityApiCards,
    capabilityVersionApiCards,
    gateRequirementApiCards,
    desktopCompanionRouteGroups,
    routeRecords,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeCapabilityRegistryApi({
    domainPackRegistry,
    capabilityManifestV2,
    packManifestCompatibility,
    gateResultAggregator,
    packApiCards,
    capabilityApiCards,
    capabilityVersionApiCards,
    gateRequirementApiCards,
    desktopCompanionRouteGroups,
    routeRecords,
    validation,
    validationItems,
  });
  const result = {
    schema_version: "capability-registry-api.v1",
    generated_at: generatedAt,
    capability_registry_api_id: `capability-registry-api.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      domain_pack_registry: {
        schema_version: domainPackRegistry.schema_version,
        registry_status: domainPackRegistry.validation?.valid ? "passed" : "failed",
        pack_count: domainPackRegistry.summary?.pack_count ?? domainPackRegistry.packs?.length ?? 0,
        capability_count: domainPackRegistry.summary?.capability_count ?? domainPackRegistry.capabilities?.length ?? 0,
        validation_error_count: domainPackRegistry.summary?.error_count ?? domainPackRegistry.validation?.errors?.length ?? 0,
      },
      capability_manifest_v2: {
        schema_version: capabilityManifestV2.schema_version,
        capability_manifest_v2_status: capabilityManifestV2.summary?.capability_manifest_v2_status ?? "unknown",
        capability_manifest_count: capabilityManifestV2.summary?.capability_manifest_count ?? capabilityManifestV2.capability_manifests?.length ?? 0,
        gate_requirement_count: capabilityManifestV2.summary?.gate_requirement_count ?? 0,
        validation_error_count: capabilityManifestV2.summary?.validation_error_count ?? capabilityManifestV2.validation?.errors?.length ?? 0,
      },
      pack_manifest_compatibility: {
        schema_version: packManifestCompatibility.schema_version,
        compatibility_status: packManifestCompatibility.summary?.compatibility_status ?? "unknown",
        pack_count: packManifestCompatibility.summary?.pack_count ?? packManifestCompatibility.pack_compatibility_records?.length ?? 0,
        validation_error_count: packManifestCompatibility.summary?.validation_error_count ?? packManifestCompatibility.validation?.errors?.length ?? 0,
      },
      gate_result_aggregator: {
        schema_version: gateResultAggregator.schema_version,
        gate_result_aggregator_status: gateResultAggregator.summary?.gate_result_aggregator_status ?? "unknown",
        gate_aggregate_record_count: gateResultAggregator.summary?.gate_aggregate_record_count ?? gateResultAggregator.gate_aggregate_records?.length ?? 0,
        workflow_gate_status_count: gateResultAggregator.summary?.workflow_gate_status_count ?? gateResultAggregator.workflow_gate_status_records?.length ?? 0,
        validation_error_count: gateResultAggregator.summary?.validation_error_count ?? gateResultAggregator.validation?.errors?.length ?? 0,
      },
    },
    capability_registry_api_contract: {
      schema_version: "capability-registry-api-contract.v1",
      contract_id: CAPABILITY_REGISTRY_API_CONTRACT_ID,
      contract_status: "read_only_operator_surface",
      desktop_companion_role: "operator_companion",
      source_of_truth: "harness_control_plane",
      mutation_policy: "not_allowed_in_v1",
      protected_action_policy: "receipt_draft_or_human_gate_only",
      secret_policy: "no_secret_material_exposed",
      installer_gateway_policy: "not_owned_by_core",
      route_method: READ_ONLY_ROUTE_METHOD,
      created_at: generatedAt,
    },
    capability_registry_api_catalog: {
      schema_version: "capability-registry-api-catalog.v1",
      pack_api_cards: packApiCards,
      capability_api_cards: capabilityApiCards,
      capability_version_api_cards: capabilityVersionApiCards,
      gate_requirement_api_cards: gateRequirementApiCards,
      desktop_companion_route_groups: desktopCompanionRouteGroups,
    },
    pack_api_cards: packApiCards,
    capability_api_cards: capabilityApiCards,
    capability_version_api_cards: capabilityVersionApiCards,
    gate_requirement_api_cards: gateRequirementApiCards,
    desktop_companion_route_groups: desktopCompanionRouteGroups,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderCapabilityRegistryApiMarkdown(result),
  };
}

export async function writeCapabilityRegistryApi(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableCapabilityRegistryApi(result);
  await writeJson(path.join(outDir, "capability-registry-api.json"), serializable);
  await writeJson(path.join(outDir, "pack-api-cards.json"), {
    schema_version: "pack-api-cards.v1",
    generated_at: result.generated_at,
    pack_api_card_count: result.pack_api_cards.length,
    pack_api_cards: result.pack_api_cards,
  });
  await writeJson(path.join(outDir, "capability-api-cards.json"), {
    schema_version: "capability-api-cards.v1",
    generated_at: result.generated_at,
    capability_api_card_count: result.capability_api_cards.length,
    capability_api_cards: result.capability_api_cards,
  });
  await writeJson(path.join(outDir, "capability-version-api-cards.json"), {
    schema_version: "capability-version-api-cards.v1",
    generated_at: result.generated_at,
    capability_version_api_card_count: result.capability_version_api_cards.length,
    capability_version_api_cards: result.capability_version_api_cards,
  });
  await writeJson(path.join(outDir, "gate-requirement-api-cards.json"), {
    schema_version: "gate-requirement-api-cards.v1",
    generated_at: result.generated_at,
    gate_requirement_api_card_count: result.gate_requirement_api_cards.length,
    gate_requirement_api_cards: result.gate_requirement_api_cards,
  });
  await writeJson(path.join(outDir, "desktop-companion-route-groups.json"), {
    schema_version: "desktop-companion-route-groups.v1",
    generated_at: result.generated_at,
    desktop_companion_route_group_count: result.desktop_companion_route_groups.length,
    desktop_companion_route_groups: result.desktop_companion_route_groups,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "capability-registry-api-validation-report.v1",
    generated_at: result.generated_at,
    capability_registry_api_id: result.capability_registry_api_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runCapabilityRegistryApiCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runCapabilityRegistryApi(args);
    console.log(`Capability registry API ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.capability_registry_api_status}`);
    console.log(`Pack cards: ${result.summary.pack_api_card_count}`);
    console.log(`Capability cards: ${result.summary.capability_api_card_count}`);
    console.log(`Gate requirement cards: ${result.summary.gate_requirement_api_card_count}`);
    console.log(`Desktop route groups: ${result.summary.desktop_companion_route_group_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildPackApiCards({
  domainPackRegistry,
  packManifestCompatibility,
  generatedAt,
}) {
  const compatibilityByPack = new Map((packManifestCompatibility.pack_compatibility_records ?? [])
    .map((record) => [record.pack_id, record]));
  return (domainPackRegistry.packs ?? []).map((pack) => {
    const compatibility = compatibilityByPack.get(pack.pack_id);
    const record = {
      schema_version: "pack-api-card.v1",
      pack_api_card_id: `pack-api-card.${slugify(pack.pack_id)}`,
      pack_id: pack.pack_id,
      pack_version: pack.pack_version,
      display_name: pack.display_name,
      enabled: pack.enabled !== false,
      capability_count: pack.capability_count ?? 0,
      dependency_pack_ids: pack.dependency_pack_ids ?? [],
      compatibility_status: compatibility?.compatibility_status ?? "unknown",
      core_compatibility_status: compatibility?.core_compatibility_status ?? "unknown",
      dependency_status: compatibility?.dependency_status ?? "unknown",
      validation_status: pack.validation?.valid === false ? "failed" : "passed",
      desktop_surface: "domain_packs",
      desktop_card_status: pack.validation?.valid === false || compatibility?.compatibility_status === "blocked" ? "blocked" : "ready",
      read_only: true,
      mutation_allowed: false,
      route_paths: [
        "/api/capability-registry-packs",
        "/api/capability-registry-capabilities",
      ],
      query_examples: [
        `/api/capability-registry-packs?pack_id=${encodeURIComponent(pack.pack_id)}`,
        `/api/capability-registry-capabilities?pack_id=${encodeURIComponent(pack.pack_id)}`,
      ],
      source_manifest_path: pack.path ?? null,
      created_at: generatedAt,
    };
    return {
      ...record,
      pack_api_card_hash: sha256(record),
    };
  });
}

function buildCapabilityApiCards({
  domainPackRegistry,
  capabilityManifestV2,
  generatedAt,
}) {
  const registryByCapability = new Map((domainPackRegistry.capabilities ?? [])
    .map((capability) => [capability.capability_id, capability]));
  const gateRuntimeByCapability = new Map((capabilityManifestV2.capability_gate_runtime_matrix ?? [])
    .map((row) => [row.capability_id, row]));
  const policyByCapability = new Map((capabilityManifestV2.capability_policy_index ?? [])
    .map((row) => [row.capability_id, row]));
  return (capabilityManifestV2.capability_manifests ?? []).map((manifest) => {
    const registry = registryByCapability.get(manifest.capability_id);
    const gateRuntime = gateRuntimeByCapability.get(manifest.capability_id);
    const policy = policyByCapability.get(manifest.capability_id);
    const record = {
      schema_version: "capability-api-card.v1",
      capability_api_card_id: `capability-api-card.${slugify(manifest.capability_id)}`,
      capability_id: manifest.capability_id,
      version: manifest.version ?? null,
      pack_id: manifest.pack_id ?? manifest.domain_pack ?? registry?.pack_id ?? null,
      domain_pack: manifest.domain_pack ?? registry?.pack_id ?? null,
      display_name: manifest.display_name,
      description: manifest.description ?? null,
      input_schema_ref: manifest.input_contract?.schema_ref ?? registry?.input_contract ?? null,
      output_schema_ref: manifest.output_contract?.schema_ref ?? registry?.output_contract ?? null,
      gate_requirement_count: gateRuntime?.required_gate_count ?? manifest.gate_requirements?.length ?? 0,
      required_gate_ids: gateRuntime?.required_gate_ids ?? (manifest.gate_requirements ?? []).map((gate) => gate.gate_id),
      runtime_requirement_count: gateRuntime?.runtime_requirement_count ?? manifest.runtime_requirements?.length ?? 0,
      runtime_ids: gateRuntime?.runtime_ids ?? (manifest.runtime_requirements ?? []).map((runtime) => runtime.runtime_id),
      approval_required: policy?.approval_required ?? manifest.approval_policy?.required === true,
      human_review_required: policy?.human_review_required ?? manifest.approval_policy?.required === true,
      attorney_review_required: policy?.attorney_review_required ?? manifest.approval_policy?.approval_type === "attorney_review",
      policy_status: policy?.policy_status ?? "unknown",
      gate_runtime_status: gateRuntime?.gate_runtime_status ?? "unknown",
      registry_validation_status: manifest.registry_validation_status ?? (registry?.validation?.valid === false ? "failed" : "passed"),
      desktop_surface: "capabilities",
      desktop_card_status: gateRuntime?.gate_runtime_status === "complete" && policy?.policy_status === "complete"
        ? "ready"
        : "blocked",
      read_only: true,
      mutation_allowed: false,
      route_paths: [
        "/api/capability-registry-capabilities",
        "/api/capability-registry-versions",
        "/api/capability-registry-gates",
      ],
      query_examples: [
        `/api/capability-registry-capabilities?capability_id=${encodeURIComponent(manifest.capability_id)}`,
        `/api/capability-registry-gates?capability_id=${encodeURIComponent(manifest.capability_id)}`,
      ],
      source_manifest_path: manifest.source_manifest_path ?? registry?.path ?? null,
      created_at: generatedAt,
    };
    return {
      ...record,
      capability_api_card_hash: sha256(record),
    };
  });
}

function buildCapabilityVersionApiCards({
  capabilityManifestV2,
  generatedAt,
}) {
  return (capabilityManifestV2.capability_version_policy_index ?? []).map((versionPolicy) => {
    const record = {
      schema_version: "capability-version-api-card.v1",
      capability_version_api_card_id: `capability-version-api-card.${slugify(versionPolicy.capability_id)}.${slugify(versionPolicy.version ?? "unversioned")}`,
      capability_id: versionPolicy.capability_id,
      version: versionPolicy.version ?? null,
      domain_pack: versionPolicy.domain_pack ?? null,
      version_status: versionPolicy.version_status ?? "unknown",
      manifest_schema_version: versionPolicy.manifest_schema_version ?? null,
      source_schema_version: versionPolicy.source_schema_version ?? null,
      source_workflow_count: versionPolicy.source_workflow_count ?? versionPolicy.source_workflow_ids?.length ?? 0,
      source_workflow_ids: versionPolicy.source_workflow_ids ?? [],
      desktop_surface: "capability_versions",
      desktop_card_status: versionPolicy.version_status === "complete" ? "ready" : "blocked",
      read_only: true,
      mutation_allowed: false,
      route_paths: [
        "/api/capability-registry-versions",
        "/api/capability-manifest-version-policy-index",
      ],
      query_examples: [
        `/api/capability-registry-versions?capability_id=${encodeURIComponent(versionPolicy.capability_id)}`,
        `/api/capability-registry-versions?version=${encodeURIComponent(versionPolicy.version ?? "")}`,
      ],
      source_manifest_path: versionPolicy.source_manifest_path ?? null,
      created_at: generatedAt,
    };
    return {
      ...record,
      capability_version_api_card_hash: sha256(record),
    };
  });
}

function buildGateRequirementApiCards({
  capabilityManifestV2,
  gateResultAggregator,
  generatedAt,
}) {
  const aggregatesByGate = countBy(gateResultAggregator.gate_aggregate_records ?? [], (record) => record.aggregate_gate_type ?? record.gate_id ?? "unknown");
  const gateCards = [];
  for (const manifest of capabilityManifestV2.capability_manifests ?? []) {
    for (const [index, gate] of (manifest.gate_requirements ?? []).entries()) {
      const aggregateGateCount = aggregatesByGate.get(gate.gate_id) ?? 0;
      const record = {
        schema_version: "gate-requirement-api-card.v1",
        gate_requirement_api_card_id: `gate-requirement-api-card.${slugify(manifest.capability_id)}.${slugify(gate.phase)}.${slugify(gate.gate_id)}.${index + 1}`,
        capability_id: manifest.capability_id,
        version: manifest.version ?? null,
        pack_id: manifest.pack_id ?? manifest.domain_pack ?? null,
        domain_pack: manifest.domain_pack ?? null,
        gate_id: gate.gate_id,
        gate_phase: gate.phase,
        required: gate.required !== false,
        aggregate_gate_count: aggregateGateCount,
        aggregate_gate_binding_status: aggregateGateCount > 0 ? "observed_in_gate_aggregator" : "declared_only",
        desktop_surface: "workflow_gates",
        desktop_card_status: aggregateGateCount > 0 ? "ready" : "attention",
        read_only: true,
        mutation_allowed: false,
        route_paths: [
          "/api/capability-registry-gates",
          "/api/gate-aggregate-records",
          "/api/workflow-gate-statuses",
        ],
        query_examples: [
          `/api/capability-registry-gates?gate_id=${encodeURIComponent(gate.gate_id)}`,
          `/api/gate-aggregate-records?gate_type=${encodeURIComponent(gate.gate_id)}`,
        ],
        created_at: generatedAt,
      };
      gateCards.push({
        ...record,
        gate_requirement_api_card_hash: sha256(record),
      });
    }
  }
  return gateCards.sort((left, right) => left.gate_requirement_api_card_id.localeCompare(right.gate_requirement_api_card_id));
}

function buildDesktopCompanionRouteGroups(generatedAt) {
  const groups = [
    routeGroup({
      groupId: "desktop.overview",
      label: "Overview",
      desktopSurface: "overview",
      routes: [
        route("/api/summary", "dashboard_summary", "Dashboard summary and high-level stage state"),
        route("/api/stages", "stage_statuses", "Control-plane stage statuses"),
        route("/api/actions", "action_items", "Pending action queue rows"),
        route("/api/sources", "sources", "Dashboard artifact source availability"),
      ],
      generatedAt,
    }),
    routeGroup({
      groupId: "desktop.domain_packs",
      label: "Domain Packs",
      desktopSurface: "domain_packs",
      routes: [
        route("/api/capability-registry-apis", "capability_registry_apis", "Capability registry API artifact"),
        route("/api/capability-registry-packs", "pack_api_cards", "Pack cards for desktop catalog views"),
        route("/api/capability-registry-capabilities", "capability_api_cards", "Capability cards grouped by pack"),
      ],
      generatedAt,
    }),
    routeGroup({
      groupId: "desktop.capabilities",
      label: "Capabilities",
      desktopSurface: "capabilities",
      routes: [
        route("/api/capability-registry-capabilities", "capability_api_cards", "Capability card rows"),
        route("/api/capability-registry-versions", "capability_version_api_cards", "Capability version card rows"),
        route("/api/capability-registry-gates", "gate_requirement_api_cards", "Capability gate requirement card rows"),
      ],
      generatedAt,
    }),
    routeGroup({
      groupId: "desktop.workflow_gates",
      label: "Workflow Gates",
      desktopSurface: "workflow_gates",
      routes: [
        route("/api/gate-result-aggregators", "gate_result_aggregators", "Gate result aggregator artifact"),
        route("/api/gate-aggregate-records", "gate_aggregate_records", "Normalized pass/warn/manual/fail gate rows"),
        route("/api/workflow-gate-statuses", "workflow_gate_statuses", "Workflow-level gate status rows"),
      ],
      generatedAt,
    }),
    routeGroup({
      groupId: "desktop.run_ledger",
      label: "Runs",
      desktopSurface: "runs",
      routes: [
        route("/api/workflow-run-ledgers", "workflow_run_ledgers", "Workflow run ledger artifact"),
        route("/api/agent-run-ledgers", "agent_run_ledgers", "Agent run ledger artifact"),
        route("/api/tool-invocation-ledgers", "tool_invocation_ledgers", "Tool invocation ledger artifact"),
        route("/api/audit-event-ledgers", "audit_event_ledgers", "Audit event ledger artifact"),
      ],
      generatedAt,
    }),
    routeGroup({
      groupId: "desktop.approvals",
      label: "Approvals",
      desktopSurface: "approvals",
      routes: [
        route("/api/actions", "action_items", "Read-only pending action rows"),
        route("/api/human-gates", "human_gates", "Human gate artifact rows"),
        route("/api/human-gate-items", "human_gate_items", "Human gate queue items"),
        route("/api/human-gate-receipts", "human_gate_receipts", "Human gate receipt drafts"),
        route("/api/work-packet-receipt-drafts", "work_packet_receipt_drafts", "Work packet receipt drafts"),
      ],
      generatedAt,
    }),
    routeGroup({
      groupId: "desktop.policy_observability",
      label: "Policy and Observability",
      desktopSurface: "policy_observability",
      routes: [
        route("/api/policy-matrices", "policy_matrices", "Policy matrix artifact rows"),
        route("/api/policy-snapshots", "policy_snapshots", "Policy snapshots"),
        route("/api/cost-record-projections", "cost_record_projections", "Cost projection artifact"),
        route("/api/token-usage-projections", "token_usage_projections", "Token projection artifact"),
        route("/api/observability-trace-projections", "observability_trace_projections", "Trace projection artifact"),
      ],
      generatedAt,
    }),
    routeGroup({
      groupId: "desktop.diagnostics",
      label: "Diagnostics",
      desktopSurface: "diagnostics",
      routes: [
        route("/health", "health", "Readiness and dashboard availability"),
        route("/api", "route_index", "Route index"),
        route("/summary.md", "markdown_summary", "Dashboard markdown summary"),
        route("/api/capability-registry-api-validations", "capability_registry_api_validations", "Capability registry API validation rows"),
      ],
      generatedAt,
    }),
  ];
  return groups.map((group) => ({
    ...group,
    route_count: group.routes.length,
    read_only_route_count: group.routes.filter((routeRecord) => routeRecord.read_only).length,
    mutation_route_count: group.routes.filter((routeRecord) => routeRecord.mutation_allowed).length,
    protected_mutation_request_route_count: group.routes.filter((routeRecord) => routeRecord.protected_mutation_request_allowed).length,
    secret_material_route_count: group.routes.filter((routeRecord) => routeRecord.secret_material_exposed).length,
    installer_or_gateway_route_count: group.routes.filter((routeRecord) => routeRecord.installer_or_gateway_control).length,
    desktop_companion_route_group_hash: sha256({
      schema_version: group.schema_version,
      desktop_route_group_id: group.desktop_route_group_id,
      routes: group.routes.map((routeRecord) => routeRecord.route_id),
    }),
  }));
}

function routeGroup({
  groupId,
  label,
  desktopSurface,
  routes,
  generatedAt,
}) {
  return {
    schema_version: "desktop-companion-route-group.v1",
    desktop_route_group_id: groupId,
    label,
    desktop_surface: desktopSurface,
    desktop_companion_role: "operator_read_only_view",
    mutation_policy: "not_allowed",
    secret_policy: "no_secret_material_exposed",
    installer_gateway_policy: "not_owned_by_core",
    routes: routes.map((routeRecord) => ({
      ...routeRecord,
      route_id: `desktop-route.${slugify(groupId)}.${slugify(routeRecord.path)}`,
      route_group_id: groupId,
      desktop_surface: desktopSurface,
      created_at: generatedAt,
      route_hash: sha256({ route_group_id: groupId, path: routeRecord.path, collection: routeRecord.collection }),
    })),
    created_at: generatedAt,
  };
}

function route(pathname, collection, description) {
  return {
    schema_version: "desktop-companion-route.v1",
    route_id: `desktop-route.${slugify(pathname)}`,
    method: READ_ONLY_ROUTE_METHOD,
    path: pathname,
    collection,
    description,
    read_only: true,
    mutation_allowed: false,
    protected_mutation_request_allowed: false,
    secret_material_exposed: false,
    installer_or_gateway_control: false,
    source_of_truth: "harness_control_plane",
    human_gate_required_for_mutation: true,
  };
}

function validateCapabilityRegistryApi({
  domainPackRegistry,
  capabilityManifestV2,
  packManifestCompatibility,
  gateResultAggregator,
  packageJson,
  roadmapText,
  packApiCards,
  capabilityApiCards,
  capabilityVersionApiCards,
  gateRequirementApiCards,
  desktopCompanionRouteGroups,
  routeRecords,
}) {
  const items = [];
  const sourcePackCount = domainPackRegistry.summary?.pack_count ?? domainPackRegistry.packs?.length ?? 0;
  const sourceCapabilityCount = capabilityManifestV2.summary?.capability_manifest_count ?? capabilityManifestV2.capability_manifests?.length ?? 0;
  const sourceGateRequirementCount = capabilityManifestV2.summary?.gate_requirement_count ?? 0;
  pushCheck(
    items,
    "source.domain_pack_registry",
    "domain_pack_registry_valid",
    domainPackRegistry.validation?.valid === true,
    "Domain pack registry is valid.",
  );
  pushCheck(
    items,
    "source.capability_manifest_v2",
    "capability_manifest_v2_complete",
    capabilityManifestV2.summary?.capability_manifest_v2_status === "complete" && (capabilityManifestV2.summary?.validation_error_count ?? 0) === 0,
    "Capability Manifest v2 catalog is complete.",
  );
  pushCheck(
    items,
    "source.pack_manifest_compatibility",
    "pack_manifest_compatibility_complete",
    packManifestCompatibility.summary?.compatibility_status === "complete" && (packManifestCompatibility.summary?.validation_error_count ?? 0) === 0,
    "Pack compatibility is complete.",
  );
  pushCheck(
    items,
    "source.gate_result_aggregator",
    "gate_result_aggregator_complete",
    gateResultAggregator.summary?.gate_result_aggregator_status === "complete" && (gateResultAggregator.summary?.validation_error_count ?? 0) === 0,
    "Gate result aggregator is complete.",
  );
  pushCheck(
    items,
    "package.scripts.capabilities_registry_api",
    "package_script_registered",
    Boolean(packageJson.scripts?.["capabilities:registry-api"]),
    "Package script capabilities:registry-api is registered.",
  );
  pushCheck(
    items,
    "roadmap.p191",
    "roadmap_p191_promoted",
    roadmapText.includes("| P191 |") && roadmapText.includes("capability registry API") && roadmapText.includes("Desktop Companion"),
    "P191 roadmap entry references the capability registry API and Desktop Companion boundary.",
  );
  pushCheck(
    items,
    "cards.packs",
    "pack_card_count_matches_registry",
    packApiCards.length === sourcePackCount && packApiCards.every((card) => card.read_only && !card.mutation_allowed),
    "Pack API cards mirror the domain pack registry and are read-only.",
  );
  pushCheck(
    items,
    "cards.capabilities",
    "capability_card_count_matches_manifest",
    capabilityApiCards.length === sourceCapabilityCount && capabilityApiCards.every((card) => card.read_only && !card.mutation_allowed),
    "Capability API cards mirror Capability Manifest v2 and are read-only.",
  );
  pushCheck(
    items,
    "cards.versions",
    "version_card_count_matches_manifest",
    capabilityVersionApiCards.length === sourceCapabilityCount && capabilityVersionApiCards.every((card) => card.version_status === "complete"),
    "Capability version API cards mirror version policy rows.",
  );
  pushCheck(
    items,
    "cards.gates",
    "gate_requirement_card_count_matches_manifest",
    gateRequirementApiCards.length === sourceGateRequirementCount && gateRequirementApiCards.every((card) => card.read_only && !card.mutation_allowed),
    "Gate requirement API cards mirror declared gate requirements.",
  );
  pushCheck(
    items,
    "desktop.routes",
    "desktop_route_groups_declared",
    desktopCompanionRouteGroups.length >= 8 && routeRecords.length > 0,
    "Desktop companion route groups are declared.",
  );
  pushCheck(
    items,
    "desktop.routes.read_only",
    "desktop_routes_read_only",
    routeRecords.length > 0 && routeRecords.every((routeRecord) => routeRecord.method === READ_ONLY_ROUTE_METHOD && routeRecord.read_only === true),
    "All Desktop Companion routes are GET/read-only.",
  );
  pushCheck(
    items,
    "desktop.routes.mutation",
    "desktop_routes_do_not_mutate",
    routeRecords.every((routeRecord) => routeRecord.mutation_allowed === false && routeRecord.protected_mutation_request_allowed === false),
    "Desktop Companion route groups do not expose mutation or protected action execution.",
  );
  pushCheck(
    items,
    "desktop.routes.secrets",
    "desktop_routes_hide_secrets",
    routeRecords.every((routeRecord) => routeRecord.secret_material_exposed === false),
    "Desktop Companion route groups expose no secret material.",
  );
  pushCheck(
    items,
    "desktop.routes.gateway",
    "desktop_routes_do_not_control_installers_or_gateways",
    routeRecords.every((routeRecord) => routeRecord.installer_or_gateway_control === false),
    "Desktop Companion route groups do not control installers, gateways, SSH, cron, or auto-update.",
  );
  return items;
}

function summarizeCapabilityRegistryApi({
  domainPackRegistry,
  capabilityManifestV2,
  packManifestCompatibility,
  gateResultAggregator,
  packApiCards,
  capabilityApiCards,
  capabilityVersionApiCards,
  gateRequirementApiCards,
  desktopCompanionRouteGroups,
  routeRecords,
  validation,
  validationItems,
}) {
  const mutationRouteCount = routeRecords.filter((routeRecord) => routeRecord.mutation_allowed).length;
  const protectedMutationRequestRouteCount = routeRecords.filter((routeRecord) => routeRecord.protected_mutation_request_allowed).length;
  const secretMaterialRouteCount = routeRecords.filter((routeRecord) => routeRecord.secret_material_exposed).length;
  const installerOrGatewayRouteCount = routeRecords.filter((routeRecord) => routeRecord.installer_or_gateway_control).length;
  const readOnlyReady = routeRecords.length > 0
    && mutationRouteCount === 0
    && protectedMutationRequestRouteCount === 0
    && secretMaterialRouteCount === 0
    && installerOrGatewayRouteCount === 0
    && validation.errors.length === 0;
  return {
    capability_registry_api_status: readOnlyReady ? "complete" : "blocked",
    capability_registry_api_contract_id: CAPABILITY_REGISTRY_API_CONTRACT_ID,
    desktop_companion_readiness_status: readOnlyReady ? "read_only_ready" : "blocked",
    source_domain_pack_registry_status: domainPackRegistry.validation?.valid ? "passed" : "failed",
    source_capability_manifest_v2_status: capabilityManifestV2.summary?.capability_manifest_v2_status ?? "unknown",
    source_pack_manifest_compatibility_status: packManifestCompatibility.summary?.compatibility_status ?? "unknown",
    source_gate_result_aggregator_status: gateResultAggregator.summary?.gate_result_aggregator_status ?? "unknown",
    source_pack_count: domainPackRegistry.summary?.pack_count ?? domainPackRegistry.packs?.length ?? 0,
    source_capability_count: domainPackRegistry.summary?.capability_count ?? domainPackRegistry.capabilities?.length ?? 0,
    source_capability_manifest_count: capabilityManifestV2.summary?.capability_manifest_count ?? capabilityManifestV2.capability_manifests?.length ?? 0,
    source_gate_requirement_count: capabilityManifestV2.summary?.gate_requirement_count ?? 0,
    source_pack_compatibility_count: packManifestCompatibility.summary?.pack_count ?? packManifestCompatibility.pack_compatibility_records?.length ?? 0,
    source_gate_aggregate_record_count: gateResultAggregator.summary?.gate_aggregate_record_count ?? gateResultAggregator.gate_aggregate_records?.length ?? 0,
    source_workflow_gate_status_count: gateResultAggregator.summary?.workflow_gate_status_count ?? gateResultAggregator.workflow_gate_status_records?.length ?? 0,
    pack_api_card_count: packApiCards.length,
    capability_api_card_count: capabilityApiCards.length,
    capability_version_api_card_count: capabilityVersionApiCards.length,
    gate_requirement_api_card_count: gateRequirementApiCards.length,
    desktop_companion_route_group_count: desktopCompanionRouteGroups.length,
    desktop_companion_route_count: routeRecords.length,
    read_only_route_count: routeRecords.filter((routeRecord) => routeRecord.read_only).length,
    mutation_route_count: mutationRouteCount,
    protected_mutation_request_route_count: protectedMutationRequestRouteCount,
    secret_material_route_count: secretMaterialRouteCount,
    installer_or_gateway_route_count: installerOrGatewayRouteCount,
    ready_pack_card_count: packApiCards.filter((card) => card.desktop_card_status === "ready").length,
    ready_capability_card_count: capabilityApiCards.filter((card) => card.desktop_card_status === "ready").length,
    ready_gate_requirement_card_count: gateRequirementApiCards.filter((card) => card.desktop_card_status === "ready").length,
    attention_gate_requirement_card_count: gateRequirementApiCards.filter((card) => card.desktop_card_status === "attention").length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
    by_desktop_surface: countObject(routeRecords, (routeRecord) => routeRecord.desktop_surface ?? "unknown"),
  };
}

function renderCapabilityRegistryApiMarkdown(result) {
  const summary = result.summary;
  return `# Capability Registry API

- Status: ${summary.capability_registry_api_status}
- Contract: ${summary.capability_registry_api_contract_id}
- Desktop companion readiness: ${summary.desktop_companion_readiness_status}
- Pack cards: ${summary.pack_api_card_count}
- Capability cards: ${summary.capability_api_card_count}
- Version cards: ${summary.capability_version_api_card_count}
- Gate requirement cards: ${summary.gate_requirement_api_card_count}
- Desktop route groups: ${summary.desktop_companion_route_group_count}
- Desktop routes: ${summary.desktop_companion_route_count}
- Read-only routes: ${summary.read_only_route_count}
- Mutation routes: ${summary.mutation_route_count}
- Secret material routes: ${summary.secret_material_route_count}
- Installer/gateway routes: ${summary.installer_or_gateway_route_count}
- Validation errors: ${summary.validation_error_count}

## Desktop Companion Boundary

Hermes Desktop-style consumers may read pack, capability, version, gate, run, approval, policy, and diagnostics state from these route groups. The harness remains the source of truth. This contract exposes no write route, no secret material, and no installer, gateway, SSH, cron, auto-update, or provider-key management surface.
`;
}

function serializableCapabilityRegistryApi(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function normalizeInputs(options) {
  return {
    domain_pack_registry_path: path.resolve(options.domainPackRegistryPath ?? DEFAULT_CAPABILITY_REGISTRY_API_INPUTS.domainPackRegistryPath),
    capability_manifest_v2_path: path.resolve(options.capabilityManifestV2Path ?? DEFAULT_CAPABILITY_REGISTRY_API_INPUTS.capabilityManifestV2Path),
    pack_manifest_compatibility_path: path.resolve(options.packManifestCompatibilityPath ?? DEFAULT_CAPABILITY_REGISTRY_API_INPUTS.packManifestCompatibilityPath),
    gate_result_aggregator_path: path.resolve(options.gateResultAggregatorPath ?? DEFAULT_CAPABILITY_REGISTRY_API_INPUTS.gateResultAggregatorPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_CAPABILITY_REGISTRY_API_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_CAPABILITY_REGISTRY_API_INPUTS.roadmapPath),
  };
}

function summarizeValidation(validationItems) {
  return {
    valid: validationItems.every((item) => item.status === "passed"),
    errors: validationItems
      .filter((item) => item.status !== "passed")
      .map((item) => ({
        path: item.path,
        check_id: item.check_id,
        message: item.message,
      })),
  };
}

function pushCheck(items, itemPath, checkId, condition, message) {
  items.push({
    schema_version: "capability-registry-api-validation-item.v1",
    validation_item_id: `capability-registry-api.${slugify(itemPath)}.${checkId}`,
    path: itemPath,
    check_id: checkId,
    status: condition ? "passed" : "failed",
    message,
  });
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function countBy(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function countObject(items, keyFn) {
  return Object.fromEntries([...countBy(items, keyFn).entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--domain-pack-registry") parsed.domainPackRegistryPath = argv[++index];
    else if (arg === "--capability-manifest-v2") parsed.capabilityManifestV2Path = argv[++index];
    else if (arg === "--pack-manifest-compatibility") parsed.packManifestCompatibilityPath = argv[++index];
    else if (arg === "--gate-result-aggregator") parsed.gateResultAggregatorPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/capability-registry-api.mjs [options]

Options:
  --check                             Fail when validation fails.
  --out-dir <path>                    Output directory.
  --domain-pack-registry <path>       domain-pack-registry.json path.
  --capability-manifest-v2 <path>     capability-manifest-v2.json path.
  --pack-manifest-compatibility <path> pack-manifest-compatibility.json path.
  --gate-result-aggregator <path>     gate-result-aggregator.json path.
  --package <path>                    package.json path.
  --roadmap <path>                    final completion phase ledger path.
  --run-at <iso>                      Deterministic generated_at value.
`);
}
