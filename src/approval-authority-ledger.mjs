import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_APPROVAL_AUTHORITY_LEDGER_OUT_DIR = "artifacts/approval-authority/latest";
export const DEFAULT_APPROVAL_AUTHORITY_LEDGER_INPUTS = {
  identityModelPath: "artifacts/identity-model/latest/identity-model.json",
  matterProfileTeamLedgerPath: "artifacts/matter-profile-team-ledger/latest/matter-profile-team-ledger.json",
  gateApprovalContractFreezePath: "artifacts/gate-approval-contract-freeze/latest/gate-approval-contract-freeze.json",
  outputDeliveryContractFreezePath: "artifacts/output-delivery-contract-freeze/latest/output-delivery-contract-freeze.json",
  outputDestinationPolicyEnforcementPath: "artifacts/output-destination-policy/latest/output-destination-policy-enforcement.json",
};

const HUMAN_AUTHORITY_ACTORS = new Set([
  "attorney_reviewer",
  "authorized_operator",
  "billing_approver",
  "content_reviewer",
  "evidence_reviewer",
  "human_reviewer",
  "partner",
  "repo_owner",
]);

const POLICY_BY_REQUIRED_ACTOR = {
  attorney_reviewer: {
    required_authority_role: "responsible_partner_or_reviewer",
    required_approval_level: "attorney_review",
    allowed_matter_roles: ["responsible_partner", "reviewer"],
    allowed_tenant_roles: ["partner", "owner"],
    human_authority_required: true,
    law_firm_human_required: true,
  },
  authorized_operator: {
    required_authority_role: "authorized_operator",
    required_approval_level: "explicit_operator_approval",
    allowed_matter_roles: ["responsible_partner", "reviewer"],
    allowed_tenant_roles: ["owner", "partner"],
    human_authority_required: true,
    law_firm_human_required: true,
  },
  billing_approver: {
    required_authority_role: "billing_approver",
    required_approval_level: "billing_approval",
    allowed_matter_roles: ["responsible_partner"],
    allowed_tenant_roles: ["partner", "owner"],
    human_authority_required: true,
    law_firm_human_required: true,
  },
  content_reviewer: {
    required_authority_role: "content_reviewer",
    required_approval_level: "content_review",
    allowed_matter_roles: ["responsible_partner", "reviewer"],
    allowed_tenant_roles: ["owner", "partner"],
    human_authority_required: true,
    law_firm_human_required: false,
  },
  evidence_reviewer: {
    required_authority_role: "evidence_reviewer",
    required_approval_level: "evidence_review",
    allowed_matter_roles: ["responsible_partner", "reviewer"],
    allowed_tenant_roles: ["partner", "owner"],
    human_authority_required: true,
    law_firm_human_required: true,
  },
  human_reviewer: {
    required_authority_role: "human_reviewer",
    required_approval_level: "human_review",
    allowed_matter_roles: ["responsible_partner", "reviewer"],
    allowed_tenant_roles: ["owner", "partner", "developer"],
    human_authority_required: true,
    law_firm_human_required: false,
  },
  partner: {
    required_authority_role: "partner",
    required_approval_level: "partner_approval",
    allowed_matter_roles: ["responsible_partner"],
    allowed_tenant_roles: ["partner"],
    human_authority_required: true,
    law_firm_human_required: true,
  },
  repo_owner: {
    required_authority_role: "repo_owner",
    required_approval_level: "repo_owner_review",
    allowed_matter_roles: [],
    allowed_tenant_roles: ["owner", "developer"],
    human_authority_required: true,
    law_firm_human_required: false,
  },
};

const REQUIRED_ACTOR_BY_DELIVERY_POLICY = {
  approval_required: "human_reviewer",
  internal_only: "human_reviewer",
  partner_approval_required: "partner",
  test_gate_required: "repo_owner",
};

const REQUIRED_ACTOR_BY_DOMAIN = {
  "law-firm": "attorney_reviewer",
  "personal-dev": "repo_owner",
  "creative-document": "content_reviewer",
};

const REQUIRED_ACTOR_BY_ARTIFACT_TYPE = {
  docx: "partner",
  email_draft: "attorney_reviewer",
  erp_billing_draft: "billing_approver",
  pptx: "content_reviewer",
  pr_draft: "repo_owner",
  public_content: "content_reviewer",
};

export async function runApprovalAuthorityLedger(options = {}) {
  const result = await buildApprovalAuthorityLedger(options);
  if (options.write !== false) await writeApprovalAuthorityLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Approval authority ledger validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildApprovalAuthorityLedger(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_APPROVAL_AUTHORITY_LEDGER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const identityResult = await readJsonOrError(inputs.identity_model_path);
  const matterTeamResult = await readJsonOrError(inputs.matter_profile_team_ledger_path);
  const gateApprovalResult = await readJsonOrError(inputs.gate_approval_contract_freeze_path);
  const outputDeliveryResult = await readJsonOrError(inputs.output_delivery_contract_freeze_path);
  const outputDestinationResult = await readJsonOrError(inputs.output_destination_policy_enforcement_path);

  const projected = projectApprovalAuthorityLedger({
    identityModel: identityResult.value ?? {},
    matterProfileTeamLedger: matterTeamResult.value ?? {},
    gateApprovalContractFreeze: gateApprovalResult.value ?? {},
    outputDeliveryContractFreeze: outputDeliveryResult.value ?? {},
    outputDestinationPolicyEnforcement: outputDestinationResult.value ?? {},
    generatedAt,
  });
  const validationItems = validateApprovalAuthorityLedger({
    identityResult,
    matterTeamResult,
    gateApprovalResult,
    outputDeliveryResult,
    outputDestinationResult,
    projected,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "approval-authority-ledger.v1",
    generated_at: generatedAt,
    approval_authority_ledger_id: `approval-authority-ledger.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_identity_model: summarizeIdentitySource(identityResult),
    source_matter_profile_team_ledger: summarizeMatterTeamSource(matterTeamResult),
    source_gate_approval_contract: summarizeGateApprovalSource(gateApprovalResult),
    source_output_delivery_contract: summarizeOutputDeliverySource(outputDeliveryResult),
    source_output_destination_policy: summarizeOutputDestinationSource(outputDestinationResult),
    approval_authority_catalog: {
      schema_version: "approval-authority-catalog.v1",
      generated_at: generatedAt,
      authority_policies: projected.authorityPolicies,
      artifact_authority_decisions: projected.artifactAuthorityDecisions,
      approval_request_authority_decisions: projected.approvalRequestAuthorityDecisions,
      delivery_action_authority_decisions: projected.deliveryActionAuthorityDecisions,
    },
    validation_items: validationItems,
    validation,
    summary: summarizeApprovalAuthority(projected, validationItems, validation, {
      identityResult,
      matterTeamResult,
      gateApprovalResult,
      outputDeliveryResult,
      outputDestinationResult,
    }),
  };
  return {
    ...result,
    markdown: renderApprovalAuthorityMarkdown(result),
  };
}

export async function writeApprovalAuthorityLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableLedger(result);
  await writeJson(path.join(outDir, "approval-authority-ledger.json"), serializable);
  await writeJson(path.join(outDir, "authority-policies.json"), {
    generated_at: result.generated_at,
    authority_policy_count: result.approval_authority_catalog.authority_policies.length,
    authority_policies: result.approval_authority_catalog.authority_policies,
  });
  await writeJson(path.join(outDir, "artifact-authority-decisions.json"), {
    generated_at: result.generated_at,
    artifact_authority_decision_count: result.approval_authority_catalog.artifact_authority_decisions.length,
    artifact_authority_decisions: result.approval_authority_catalog.artifact_authority_decisions,
  });
  await writeJson(path.join(outDir, "approval-request-authority-decisions.json"), {
    generated_at: result.generated_at,
    approval_request_authority_decision_count: result.approval_authority_catalog.approval_request_authority_decisions.length,
    approval_request_authority_decisions: result.approval_authority_catalog.approval_request_authority_decisions,
  });
  await writeJson(path.join(outDir, "delivery-action-authority-decisions.json"), {
    generated_at: result.generated_at,
    delivery_action_authority_decision_count: result.approval_authority_catalog.delivery_action_authority_decisions.length,
    delivery_action_authority_decisions: result.approval_authority_catalog.delivery_action_authority_decisions,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    approval_authority_ledger_id: result.approval_authority_ledger_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runApprovalAuthorityLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runApprovalAuthorityLedger(args);
    console.log(`Approval authority ledger written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.approval_authority_status}`);
    console.log(`Authority policies: ${result.summary.authority_policy_count}`);
    console.log(`Artifact authority decisions: ${result.summary.artifact_authority_decision_count}`);
    console.log(`Approval request authority decisions: ${result.summary.approval_request_authority_decision_count}`);
    console.log(`Delivery action authority decisions: ${result.summary.delivery_action_authority_decision_count}`);
    console.log(`Assigned authority decisions: ${result.summary.assigned_authority_decision_count}`);
    console.log(`Assignment required decisions: ${result.summary.assignment_required_decision_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectApprovalAuthorityLedger({
  identityModel,
  matterProfileTeamLedger,
  gateApprovalContractFreeze,
  outputDeliveryContractFreeze,
  outputDestinationPolicyEnforcement,
  generatedAt,
}) {
  const identityIndex = buildIdentityIndex(identityModel);
  const teamIndex = buildTeamIndex(matterProfileTeamLedger);
  const gateApprovalContract = gateApprovalContractFreeze.gate_approval_contract ?? {};
  const outputDeliveryContract = outputDeliveryContractFreeze.output_delivery_contract ?? {};
  const destinationCatalog = outputDestinationPolicyEnforcement.output_destination_policy_catalog ?? {};
  const outputArtifacts = outputDeliveryContract.output_artifacts ?? [];
  const deliveryActions = outputDeliveryContract.delivery_actions ?? [];
  const approvalRequests = gateApprovalContract.approval_requests ?? [];
  const approvalAuthorityContracts = gateApprovalContract.approval_authority_contracts ?? [];
  const artifactDestinationGates = destinationCatalog.artifact_destination_gates ?? [];
  const deliveryActionDestinationGates = destinationCatalog.delivery_action_destination_gates ?? [];
  const policyRules = destinationCatalog.policy_rules ?? [];

  const approvalRequestsById = new Map(approvalRequests.map((request) => [request.approval_request_id, request]));
  const authorityContractByRequestId = new Map(approvalAuthorityContracts.map((authority) => [authority.approval_request_id, authority]));
  const requestsByOutputArtifactId = groupBy(approvalRequests.filter((request) => request.output_artifact_id), "output_artifact_id");
  const artifactGateByArtifactId = new Map(artifactDestinationGates.map((gate) => [gate.output_artifact_id, gate]));
  const deliveryGateByActionId = new Map(deliveryActionDestinationGates.map((gate) => [gate.delivery_action_id, gate]));
  const policyRuleByArtifactType = new Map(policyRules.map((rule) => [rule.artifact_type, rule]));

  const authorityPolicyMap = new Map();
  const artifactAuthorityDecisions = outputArtifacts.map((artifact) => {
    const destinationGate = artifactGateByArtifactId.get(artifact.output_artifact_id);
    const linkedRequests = requestsByOutputArtifactId.get(artifact.output_artifact_id) ?? [];
    const policyRule = policyRuleByArtifactType.get(artifact.artifact_type);
    const requiredActor = inferRequiredActor({ artifact, destinationGate, policyRule, linkedRequests });
    const authorityPolicy = ensureAuthorityPolicy(authorityPolicyMap, {
      artifact_type: artifact.artifact_type,
      domain_pack: artifact.domain_pack,
      delivery_policy: destinationGate?.delivery_policy ?? policyRule?.delivery_policy ?? "unknown",
      destination_kind: destinationGate?.destination_kind ?? policyRule?.destination_kind ?? "unknown",
      required_actor: requiredActor,
      required_gates: destinationGate?.required_gates ?? policyRule?.computed_required_gates ?? [],
      generatedAt,
    });
    return buildAuthorityDecision({
      decisionType: "artifact_authority_decision",
      subjectId: artifact.output_artifact_id,
      subjectRef: { subject_type: "output_artifact", subject_id: artifact.output_artifact_id },
      artifact,
      deliveryAction: null,
      approvalRequest: linkedRequests[0],
      approvalAuthorityContract: linkedRequests[0] ? authorityContractByRequestId.get(linkedRequests[0].approval_request_id) : null,
      destinationGate,
      authorityPolicy,
      identityIndex,
      teamIndex,
      generatedAt,
      extra: {
        artifact_authority_decision_id: `artifact-authority-decision.${slugify(artifact.output_artifact_id)}`,
        output_artifact_id: artifact.output_artifact_id,
        approval_request_ids: linkedRequests.map((request) => request.approval_request_id).sort(),
        approval_request_count: linkedRequests.length,
        delivery_action_ids: artifact.delivery_action_ids ?? [],
        delivery_action_count: artifact.delivery_action_count ?? artifact.delivery_action_ids?.length ?? 0,
      },
    });
  }).sort(by("artifact_authority_decision_id"));

  const approvalRequestAuthorityDecisions = approvalRequests.map((request) => {
    const artifact = outputArtifacts.find((item) => item.output_artifact_id === request.output_artifact_id);
    const destinationGate = artifact ? artifactGateByArtifactId.get(artifact.output_artifact_id) : null;
    const policyRule = policyRuleByArtifactType.get(request.artifact_type ?? artifact?.artifact_type);
    const requiredActor = inferRequiredActor({ artifact, destinationGate, policyRule, linkedRequests: [request], approvalRequest: request });
    const authorityPolicy = ensureAuthorityPolicy(authorityPolicyMap, {
      artifact_type: request.artifact_type ?? artifact?.artifact_type ?? request.subject_ref?.subject_type ?? "unknown",
      domain_pack: request.domain_pack ?? artifact?.domain_pack ?? "unknown",
      delivery_policy: destinationGate?.delivery_policy ?? policyRule?.delivery_policy ?? "approval_request",
      destination_kind: destinationGate?.destination_kind ?? policyRule?.destination_kind ?? "approval_request",
      required_actor: requiredActor,
      required_gates: destinationGate?.required_gates ?? policyRule?.computed_required_gates ?? ["human_approval_gate"],
      generatedAt,
    });
    return buildAuthorityDecision({
      decisionType: "approval_request_authority_decision",
      subjectId: request.approval_request_id,
      subjectRef: request.subject_ref ?? { subject_type: "approval_request", subject_id: request.approval_request_id },
      artifact,
      deliveryAction: null,
      approvalRequest: request,
      approvalAuthorityContract: authorityContractByRequestId.get(request.approval_request_id),
      destinationGate,
      authorityPolicy,
      identityIndex,
      teamIndex,
      generatedAt,
      extra: {
        approval_request_authority_decision_id: `approval-request-authority-decision.${slugify(request.approval_request_id)}`,
        approval_request_id: request.approval_request_id,
        output_artifact_id: request.output_artifact_id ?? null,
        approval_kind: request.approval_kind ?? null,
        approval_source: request.approval_source ?? null,
        request_status: request.request_status ?? null,
      },
    });
  }).sort(by("approval_request_authority_decision_id"));

  const deliveryActionAuthorityDecisions = deliveryActions.map((action) => {
    const artifact = outputArtifacts.find((item) => item.output_artifact_id === action.output_artifact_id);
    const destinationGate = deliveryGateByActionId.get(action.delivery_action_id) ?? artifactGateByArtifactId.get(action.output_artifact_id);
    const linkedRequests = (artifact?.approval_request_ids ?? [])
      .map((approvalRequestId) => approvalRequestsById.get(approvalRequestId))
      .filter(Boolean);
    const policyRule = policyRuleByArtifactType.get(action.artifact_type ?? artifact?.artifact_type);
    const requiredActor = inferRequiredActor({ artifact: artifact ?? action, deliveryAction: action, destinationGate, policyRule, linkedRequests });
    const authorityPolicy = ensureAuthorityPolicy(authorityPolicyMap, {
      artifact_type: action.artifact_type ?? artifact?.artifact_type ?? "unknown",
      domain_pack: action.domain_pack ?? artifact?.domain_pack ?? "unknown",
      delivery_policy: destinationGate?.delivery_policy ?? policyRule?.delivery_policy ?? "unknown",
      destination_kind: destinationGate?.destination_kind ?? policyRule?.destination_kind ?? action.delivery_channel ?? "unknown",
      required_actor: requiredActor,
      required_gates: destinationGate?.required_gates ?? policyRule?.computed_required_gates ?? [],
      generatedAt,
    });
    return buildAuthorityDecision({
      decisionType: "delivery_action_authority_decision",
      subjectId: action.delivery_action_id,
      subjectRef: { subject_type: "delivery_action", subject_id: action.delivery_action_id },
      artifact,
      deliveryAction: action,
      approvalRequest: linkedRequests[0],
      approvalAuthorityContract: linkedRequests[0] ? authorityContractByRequestId.get(linkedRequests[0].approval_request_id) : null,
      destinationGate,
      authorityPolicy,
      identityIndex,
      teamIndex,
      generatedAt,
      extra: {
        delivery_action_authority_decision_id: `delivery-action-authority-decision.${slugify(action.delivery_action_id)}`,
        delivery_action_id: action.delivery_action_id,
        output_artifact_id: action.output_artifact_id,
        delivery_channel: action.delivery_channel ?? null,
        delivery_target: action.delivery_target ?? null,
        delivery_status: action.delivery_status ?? null,
        approval_request_ids: linkedRequests.map((request) => request.approval_request_id).sort(),
        approval_request_count: linkedRequests.length,
      },
    });
  }).sort(by("delivery_action_authority_decision_id"));

  return {
    identityIndex,
    teamIndex,
    authorityPolicies: [...authorityPolicyMap.values()].sort(by("authority_policy_id")),
    artifactAuthorityDecisions,
    approvalRequestAuthorityDecisions,
    deliveryActionAuthorityDecisions,
    outputArtifacts,
    deliveryActions,
    approvalRequests,
    approvalAuthorityContracts,
    artifactDestinationGates,
    deliveryActionDestinationGates,
  };
}

function ensureAuthorityPolicy(policyMap, input) {
  const actorPolicy = actorPolicyFor(input.required_actor);
  const lawFirmHumanRequired = actorPolicy.law_firm_human_required || input.domain_pack === "law-firm";
  const policyKey = [
    input.domain_pack,
    input.artifact_type,
    input.delivery_policy,
    input.destination_kind,
    actorPolicy.required_authority_role,
  ].map((part) => slugify(part ?? "unknown")).join(".");
  const authority_policy_id = `authority-policy.${policyKey}`;
  if (!policyMap.has(authority_policy_id)) {
    policyMap.set(authority_policy_id, {
      schema_version: "authority-policy.v1",
      authority_policy_id,
      artifact_type: input.artifact_type ?? "unknown",
      domain_pack: input.domain_pack ?? "unknown",
      delivery_policy: input.delivery_policy ?? "unknown",
      destination_kind: input.destination_kind ?? "unknown",
      required_actor: input.required_actor,
      required_authority_role: actorPolicy.required_authority_role,
      required_approval_level: actorPolicy.required_approval_level,
      human_authority_required: actorPolicy.human_authority_required,
      law_firm_human_required: lawFirmHumanRequired,
      allowed_matter_roles: [...actorPolicy.allowed_matter_roles].sort(),
      allowed_tenant_roles: [...actorPolicy.allowed_tenant_roles].sort(),
      required_gates: [...new Set(input.required_gates ?? [])].sort(),
      policy_status: "declared",
      reason_codes: [
        "required_actor_mapped_to_authority_role",
        lawFirmHumanRequired ? "law_firm_outputs_require_human_authority" : "human_authority_policy_declared",
      ],
      decided_at: input.generatedAt,
      metadata: {},
    });
  }
  return policyMap.get(authority_policy_id);
}

function buildAuthorityDecision({
  decisionType,
  subjectId,
  subjectRef,
  artifact,
  deliveryAction,
  approvalRequest,
  approvalAuthorityContract,
  destinationGate,
  authorityPolicy,
  identityIndex,
  teamIndex,
  generatedAt,
  extra,
}) {
  const tenant_id = firstPresent(
    approvalRequest?.tenant_id,
    artifact?.tenant_id,
    deliveryAction?.tenant_id,
    destinationGate?.tenant_id,
    null,
  );
  const matter_id = firstPresent(
    approvalRequest?.matter_id,
    artifact?.matter_id,
    deliveryAction?.matter_id,
    destinationGate?.matter_id,
    null,
  );
  const domain_pack = firstPresent(
    approvalRequest?.domain_pack,
    artifact?.domain_pack,
    deliveryAction?.domain_pack,
    destinationGate?.domain_pack,
    authorityPolicy.domain_pack,
  );
  const resolution = resolveAuthorityAssignment({
    tenantId: tenant_id,
    matterId: matter_id,
    authorityPolicy,
    identityIndex,
    teamIndex,
  });
  const approvalStatus = firstPresent(approvalRequest?.request_status, artifact?.approval_status, deliveryAction?.approval_status, destinationGate?.approval_status, "unknown");
  const finalActionRequired = Boolean(destinationGate?.final_action_required ?? deliveryAction?.protected_action ?? artifact?.delivery_action_count);
  const approvalRequired = Boolean(
    authorityPolicy.human_authority_required
      || approvalRequest?.requires_explicit_human_approval
      || deliveryAction?.requires_human_approval
      || destinationGate?.required_gates?.includes("human_approval_gate")
      || destinationGate?.output_destination_gate_required,
  );
  const base = {
    schema_version: `${decisionType}.v1`,
    subject_ref: subjectRef,
    domain_pack,
    tenant_id,
    matter_id,
    artifact_type: firstPresent(artifact?.artifact_type, deliveryAction?.artifact_type, destinationGate?.artifact_type, authorityPolicy.artifact_type, "unknown"),
    delivery_policy: destinationGate?.delivery_policy ?? authorityPolicy.delivery_policy,
    destination_kind: destinationGate?.destination_kind ?? authorityPolicy.destination_kind,
    destination_tool_id: destinationGate?.destination_tool_id ?? null,
    authority_policy_id: authorityPolicy.authority_policy_id,
    approval_authority_contract_id: approvalAuthorityContract?.approval_authority_id ?? null,
    approval_authority_contract_status: approvalAuthorityContract?.approval_authority_status ?? (approvalRequest ? "missing_contract" : "not_applicable"),
    required_actor: authorityPolicy.required_actor,
    required_authority_role: authorityPolicy.required_authority_role,
    required_approval_level: authorityPolicy.required_approval_level,
    allowed_matter_roles: authorityPolicy.allowed_matter_roles,
    allowed_tenant_roles: authorityPolicy.allowed_tenant_roles,
    human_authority_required: approvalRequired,
    law_firm_human_required: authorityPolicy.law_firm_human_required || domain_pack === "law-firm",
    final_action_required: finalActionRequired,
    approval_status: approvalStatus,
    authority_status: resolution.authority_status,
    assignment_status: resolution.assignment_status,
    assigned_user_id: resolution.assigned_user_id,
    assigned_actor_principal_id: resolution.assigned_actor_principal_id,
    candidate_user_ids: resolution.candidate_user_ids,
    candidate_count: resolution.candidate_count,
    matter_role_match_count: resolution.matter_role_match_count,
    tenant_role_match_count: resolution.tenant_role_match_count,
    matter_profile_known: resolution.matter_profile_known,
    tenant_identity_known: resolution.tenant_identity_known,
    nonhuman_authority_blocked: resolution.nonhuman_authority_blocked,
    authority_basis: resolution.authority_basis,
    decision_status: resolution.authority_status === "assigned" ? "assigned" : "assignment_required",
    gate_decision: resolution.authority_status === "assigned" ? "review" : "review",
    gate_status: resolution.authority_status === "assigned" ? "requires_approval" : "requires_assignment",
    reason_codes: resolution.reason_codes,
    decided_at: generatedAt,
    metadata: {
      source_subject_id: subjectId,
      destination_gate_id: destinationGate?.artifact_destination_gate_id ?? destinationGate?.delivery_action_destination_gate_id ?? null,
      output_destination_gate_required: Boolean(destinationGate?.output_destination_gate_required),
    },
  };
  return {
    ...extra,
    ...base,
  };
}

function resolveAuthorityAssignment({ tenantId, matterId, authorityPolicy, identityIndex, teamIndex }) {
  const matterMemberships = (teamIndex.membershipsByMatterId.get(matterId) ?? [])
    .filter((membership) => membership.membership_status === "active")
    .filter((membership) => membership.can_approve !== false)
    .filter((membership) => authorityPolicy.allowed_matter_roles.includes(membership.matter_role));
  const tenantUsers = (identityIndex.usersByTenantId.get(tenantId) ?? [])
    .filter((user) => user.status === "active")
    .filter((user) => intersects(user.tenant_role_names ?? [], authorityPolicy.allowed_tenant_roles));
  const candidates = uniqueBy(
    [
      ...matterMemberships.map((membership) => ({
        user_id: membership.user_id,
        actor_principal_id: membership.human_actor_principal_id ?? identityIndex.userById.get(membership.user_id)?.human_actor_principal_id ?? null,
        basis: `matter_role:${membership.matter_role}`,
      })),
      ...tenantUsers.map((user) => ({
        user_id: user.user_id,
        actor_principal_id: user.human_actor_principal_id ?? null,
        basis: `tenant_role:${(user.tenant_role_names ?? []).filter((role) => authorityPolicy.allowed_tenant_roles.includes(role)).sort().join("+")}`,
      })),
    ].filter((candidate) => candidate.user_id),
    "user_id",
  ).sort(by("user_id"));
  const assigned = candidates[0] ?? null;
  const matterProfileKnown = teamIndex.matterProfileById.has(matterId);
  const tenantIdentityKnown = identityIndex.tenantsById.has(tenantId);
  const reasonCodes = [];
  if (assigned) reasonCodes.push("human_authority_candidate_resolved");
  else reasonCodes.push("human_authority_assignment_required");
  if (matterProfileKnown) reasonCodes.push("matter_profile_known");
  else reasonCodes.push("matter_profile_missing_or_outside_current_registry");
  if (tenantIdentityKnown) reasonCodes.push("tenant_identity_known");
  else reasonCodes.push("tenant_identity_missing_or_outside_current_registry");
  if (matterMemberships.length > 0) reasonCodes.push("matter_role_authority_match");
  if (tenantUsers.length > 0) reasonCodes.push("tenant_role_authority_match");
  return {
    authority_status: assigned ? "assigned" : "assignment_required",
    assignment_status: assigned ? "assigned_to_human_user" : assignmentRequiredStatus({ matterProfileKnown, tenantIdentityKnown }),
    assigned_user_id: assigned?.user_id ?? null,
    assigned_actor_principal_id: assigned?.actor_principal_id ?? null,
    candidate_user_ids: candidates.map((candidate) => candidate.user_id),
    candidate_count: candidates.length,
    matter_role_match_count: matterMemberships.length,
    tenant_role_match_count: tenantUsers.length,
    matter_profile_known: matterProfileKnown,
    tenant_identity_known: tenantIdentityKnown,
    nonhuman_authority_blocked: true,
    authority_basis: assigned?.basis ?? "human_assignment_required",
    reason_codes: reasonCodes,
  };
}

function assignmentRequiredStatus({ matterProfileKnown, tenantIdentityKnown }) {
  if (!tenantIdentityKnown) return "assignment_required_tenant_identity_missing";
  if (!matterProfileKnown) return "assignment_required_matter_profile_missing";
  return "assignment_required_no_matching_human_role";
}

function inferRequiredActor({ artifact, deliveryAction, destinationGate, policyRule, linkedRequests, approvalRequest }) {
  if (approvalRequest?.required_actor) return normalizeRequiredActor(approvalRequest.required_actor, artifact ?? deliveryAction);
  const requestActor = linkedRequests?.find((request) => request?.required_actor)?.required_actor;
  if (requestActor) return normalizeRequiredActor(requestActor, artifact ?? deliveryAction);
  const artifactType = artifact?.artifact_type ?? deliveryAction?.artifact_type ?? destinationGate?.artifact_type ?? policyRule?.artifact_type;
  if (artifactType && REQUIRED_ACTOR_BY_ARTIFACT_TYPE[artifactType]) return REQUIRED_ACTOR_BY_ARTIFACT_TYPE[artifactType];
  const deliveryPolicy = destinationGate?.delivery_policy ?? policyRule?.delivery_policy;
  if (deliveryPolicy && REQUIRED_ACTOR_BY_DELIVERY_POLICY[deliveryPolicy]) return REQUIRED_ACTOR_BY_DELIVERY_POLICY[deliveryPolicy];
  const domainPack = artifact?.domain_pack ?? deliveryAction?.domain_pack ?? destinationGate?.domain_pack;
  return REQUIRED_ACTOR_BY_DOMAIN[domainPack] ?? "human_reviewer";
}

function normalizeRequiredActor(requiredActor, subject = {}) {
  if (requiredActor === "human_reviewer" && subject.domain_pack === "law-firm") return "attorney_reviewer";
  if (HUMAN_AUTHORITY_ACTORS.has(requiredActor)) return requiredActor;
  return "human_reviewer";
}

function actorPolicyFor(requiredActor) {
  return POLICY_BY_REQUIRED_ACTOR[requiredActor] ?? POLICY_BY_REQUIRED_ACTOR.human_reviewer;
}

function buildIdentityIndex(identityModel) {
  const contract = identityModel.identity_contract ?? {};
  const tenants = contract.tenants ?? [];
  const users = contract.users ?? [];
  const roles = contract.roles ?? [];
  const roleAssignments = contract.role_assignments ?? [];
  const roleById = new Map(roles.map((role) => [role.role_id, role]));
  const roleNamesByUserId = new Map();
  for (const assignment of roleAssignments) {
    if (!assignment.user_id || assignment.assignment_status !== "active") continue;
    const role = roleById.get(assignment.role_id);
    if (!role) continue;
    if (!roleNamesByUserId.has(assignment.user_id)) roleNamesByUserId.set(assignment.user_id, []);
    roleNamesByUserId.get(assignment.user_id).push(role.role_name);
  }
  const enrichedUsers = users.map((user) => ({
    ...user,
    tenant_role_names: [...new Set(roleNamesByUserId.get(user.user_id) ?? [])].sort(),
  }));
  return {
    tenantsById: new Map(tenants.map((tenant) => [tenant.tenant_id, tenant])),
    usersByTenantId: groupBy(enrichedUsers, "tenant_id"),
    userById: new Map(enrichedUsers.map((user) => [user.user_id, user])),
  };
}

function buildTeamIndex(matterProfileTeamLedger) {
  const contract = matterProfileTeamLedger.matter_team_contract ?? {};
  const profiles = contract.matter_profiles ?? [];
  const memberships = contract.matter_team_memberships ?? [];
  return {
    matterProfileById: new Map(profiles.map((profile) => [profile.matter_id, profile])),
    membershipsByMatterId: groupBy(memberships, "matter_id"),
  };
}

function validateApprovalAuthorityLedger({
  identityResult,
  matterTeamResult,
  gateApprovalResult,
  outputDeliveryResult,
  outputDestinationResult,
  projected,
}) {
  const items = [];
  pushCheck(items, "source.identity_model", "source_available", identityResult.ok, "Identity model must be readable.");
  pushCheck(items, "source.matter_profile_team_ledger", "source_available", matterTeamResult.ok, "Matter profile/team ledger must be readable.");
  pushCheck(items, "source.gate_approval_contract", "source_available", gateApprovalResult.ok, "Gate/Approval contract must be readable.");
  pushCheck(items, "source.output_delivery_contract", "source_available", outputDeliveryResult.ok, "Output/Delivery contract must be readable.");
  pushCheck(items, "source.output_destination_policy", "source_available", outputDestinationResult.ok, "Output Destination Policy must be readable.");
  pushCheck(items, "source.gate_approval_contract", "gate_approval_contract_complete", gateApprovalResult.value?.summary?.freeze_status === "complete", "Gate/Approval contract freeze must be complete.");
  pushCheck(items, "source.output_delivery_contract", "output_delivery_contract_complete", outputDeliveryResult.value?.summary?.freeze_status === "complete", "Output/Delivery contract freeze must be complete.");
  pushCheck(items, "source.output_destination_policy", "output_destination_policy_complete", outputDestinationResult.value?.summary?.output_destination_policy_status === "complete", "Output Destination Policy enforcement must be complete.");

  pushCheck(items, "approval_authority_catalog.authority_policies", "authority_policies_present", projected.authorityPolicies.length > 0, "At least one authority policy must be declared.");
  pushCheck(items, "approval_authority_catalog.artifact_authority_decisions", "artifact_decisions_cover_outputs", projected.artifactAuthorityDecisions.length === projected.outputArtifacts.length, "Every output artifact has an authority decision.");
  pushCheck(items, "approval_authority_catalog.approval_request_authority_decisions", "approval_request_decisions_cover_requests", projected.approvalRequestAuthorityDecisions.length === projected.approvalRequests.length, "Every approval request has an authority decision.");
  pushCheck(items, "approval_authority_catalog.delivery_action_authority_decisions", "delivery_action_decisions_cover_actions", projected.deliveryActionAuthorityDecisions.length === projected.deliveryActions.length, "Every delivery action has an authority decision.");

  const allDecisions = allAuthorityDecisions(projected);
  for (const decision of allDecisions) {
    const id = decision.artifact_authority_decision_id ?? decision.approval_request_authority_decision_id ?? decision.delivery_action_authority_decision_id;
    pushCheck(items, `approval_authority_decisions.${id}`, "required_authority_role_declared", Boolean(decision.required_authority_role), "Authority decision declares the required authority role.");
    pushCheck(items, `approval_authority_decisions.${id}`, "human_authority_not_runtime", decision.nonhuman_authority_blocked === true && decision.required_authority_role !== "runtime" && decision.required_authority_role !== "model", "Authority decisions cannot assign runtime or model actors as approvers.");
    if (decision.domain_pack === "law-firm") {
      pushCheck(items, `approval_authority_decisions.${id}`, "law_firm_requires_human_authority", decision.human_authority_required === true && decision.law_firm_human_required === true, "Law-firm outputs require human authority.");
      const outputLike = ["output_artifact", "delivery_action", "approval"].includes(decision.subject_ref?.subject_type);
      const boundaryPresent = outputLike
        ? Boolean(decision.tenant_id) && Boolean(decision.matter_id)
        : Boolean(decision.matter_id);
      pushCheck(items, `approval_authority_decisions.${id}`, "law_firm_matter_boundary_present", boundaryPresent, "Law-firm authority decisions keep matter boundaries and require tenant boundaries for output/delivery actions.");
    }
  }

  pushCheck(items, "approval_authority_catalog.authority_policies", "unique_authority_policy_ids", duplicates(projected.authorityPolicies.map((policy) => policy.authority_policy_id)).length === 0, "Authority policy ids must be unique.");
  pushCheck(items, "approval_authority_catalog.artifact_authority_decisions", "unique_artifact_decision_ids", duplicates(projected.artifactAuthorityDecisions.map((decision) => decision.artifact_authority_decision_id)).length === 0, "Artifact authority decision ids must be unique.");
  pushCheck(items, "approval_authority_catalog.approval_request_authority_decisions", "unique_approval_request_decision_ids", duplicates(projected.approvalRequestAuthorityDecisions.map((decision) => decision.approval_request_authority_decision_id)).length === 0, "Approval request authority decision ids must be unique.");
  pushCheck(items, "approval_authority_catalog.delivery_action_authority_decisions", "unique_delivery_action_decision_ids", duplicates(projected.deliveryActionAuthorityDecisions.map((decision) => decision.delivery_action_authority_decision_id)).length === 0, "Delivery action authority decision ids must be unique.");
  return items;
}

function summarizeApprovalAuthority(projected, validationItems, validation, sources) {
  const allDecisions = allAuthorityDecisions(projected);
  const assigned = allDecisions.filter((decision) => decision.authority_status === "assigned");
  const assignmentRequired = allDecisions.filter((decision) => decision.authority_status !== "assigned");
  const lawFirmDecisions = allDecisions.filter((decision) => decision.domain_pack === "law-firm");
  return {
    approval_authority_status: validation.valid ? "complete" : "blocked",
    source_identity_model_status: sources.identityResult.value?.summary?.identity_model_status ?? (sources.identityResult.ok ? "unknown" : "unavailable"),
    source_matter_profile_team_ledger_status: sources.matterTeamResult.value?.summary?.ledger_status ?? (sources.matterTeamResult.ok ? "unknown" : "unavailable"),
    source_gate_approval_contract_status: sources.gateApprovalResult.value?.summary?.freeze_status ?? (sources.gateApprovalResult.ok ? "unknown" : "unavailable"),
    source_output_delivery_contract_status: sources.outputDeliveryResult.value?.summary?.freeze_status ?? (sources.outputDeliveryResult.ok ? "unknown" : "unavailable"),
    source_output_destination_policy_status: sources.outputDestinationResult.value?.summary?.output_destination_policy_status ?? (sources.outputDestinationResult.ok ? "unknown" : "unavailable"),
    authority_policy_count: projected.authorityPolicies.length,
    artifact_authority_decision_count: projected.artifactAuthorityDecisions.length,
    approval_request_authority_decision_count: projected.approvalRequestAuthorityDecisions.length,
    delivery_action_authority_decision_count: projected.deliveryActionAuthorityDecisions.length,
    authority_decision_count: allDecisions.length,
    human_authority_required_decision_count: allDecisions.filter((decision) => decision.human_authority_required).length,
    law_firm_authority_decision_count: lawFirmDecisions.length,
    law_firm_human_required_decision_count: lawFirmDecisions.filter((decision) => decision.human_authority_required && decision.law_firm_human_required).length,
    assigned_authority_decision_count: assigned.length,
    assignment_required_decision_count: assignmentRequired.length,
    tenant_identity_missing_decision_count: allDecisions.filter((decision) => !decision.tenant_identity_known).length,
    matter_profile_missing_decision_count: allDecisions.filter((decision) => !decision.matter_profile_known).length,
    nonhuman_authority_blocked_count: allDecisions.filter((decision) => decision.nonhuman_authority_blocked).length,
    missing_authority_role_count: allDecisions.filter((decision) => !decision.required_authority_role).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_required_authority_role: countBy(allDecisions, "required_authority_role"),
    by_required_actor: countBy(allDecisions, "required_actor"),
    by_assignment_status: countBy(allDecisions, "assignment_status"),
    by_domain_pack: countBy(allDecisions, "domain_pack"),
    by_delivery_policy: countBy(allDecisions, "delivery_policy"),
  };
}

function allAuthorityDecisions(projected) {
  return [
    ...projected.artifactAuthorityDecisions,
    ...projected.approvalRequestAuthorityDecisions,
    ...projected.deliveryActionAuthorityDecisions,
  ];
}

function summarizeIdentitySource(result) {
  return {
    schema_version: result.value?.schema_version ?? null,
    status: result.value?.summary?.identity_model_status ?? (result.ok ? "unknown" : "unavailable"),
    tenant_count: result.value?.summary?.tenant_count ?? 0,
    user_count: result.value?.summary?.user_count ?? 0,
    role_assignment_count: result.value?.summary?.role_assignment_count ?? 0,
    error: result.error ?? null,
  };
}

function summarizeMatterTeamSource(result) {
  return {
    schema_version: result.value?.schema_version ?? null,
    status: result.value?.summary?.ledger_status ?? (result.ok ? "unknown" : "unavailable"),
    matter_profile_count: result.value?.summary?.matter_profile_count ?? 0,
    team_membership_count: result.value?.summary?.team_membership_count ?? 0,
    matter_access_subject_count: result.value?.summary?.matter_access_subject_count ?? 0,
    error: result.error ?? null,
  };
}

function summarizeGateApprovalSource(result) {
  return {
    schema_version: result.value?.schema_version ?? null,
    status: result.value?.summary?.freeze_status ?? (result.ok ? "unknown" : "unavailable"),
    approval_request_count: result.value?.summary?.approval_request_count ?? 0,
    approval_authority_declared_count: result.value?.summary?.approval_authority_declared_count ?? 0,
    error: result.error ?? null,
  };
}

function summarizeOutputDeliverySource(result) {
  return {
    schema_version: result.value?.schema_version ?? null,
    status: result.value?.summary?.freeze_status ?? (result.ok ? "unknown" : "unavailable"),
    output_artifact_count: result.value?.summary?.output_artifact_count ?? 0,
    delivery_action_count: result.value?.summary?.delivery_action_count ?? 0,
    error: result.error ?? null,
  };
}

function summarizeOutputDestinationSource(result) {
  return {
    schema_version: result.value?.schema_version ?? null,
    status: result.value?.summary?.output_destination_policy_status ?? (result.ok ? "unknown" : "unavailable"),
    artifact_destination_gate_count: result.value?.summary?.artifact_destination_gate_count ?? 0,
    delivery_action_destination_gate_count: result.value?.summary?.delivery_action_destination_gate_count ?? 0,
    error: result.error ?? null,
  };
}

function renderApprovalAuthorityMarkdown(result) {
  const lines = [];
  lines.push("# Approval Authority Ledger");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.approval_authority_status}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Authority policies: ${result.summary.authority_policy_count}`);
  lines.push(`- Artifact authority decisions: ${result.summary.artifact_authority_decision_count}`);
  lines.push(`- Approval request authority decisions: ${result.summary.approval_request_authority_decision_count}`);
  lines.push(`- Delivery action authority decisions: ${result.summary.delivery_action_authority_decision_count}`);
  lines.push(`- Assigned authority decisions: ${result.summary.assigned_authority_decision_count}`);
  lines.push(`- Assignment-required decisions: ${result.summary.assignment_required_decision_count}`);
  lines.push(`- Law-firm decisions requiring human authority: ${result.summary.law_firm_human_required_decision_count}/${result.summary.law_firm_authority_decision_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Authority Decisions");
  lines.push("");
  lines.push("| Subject | Role | Level | Assignment | Candidate | Matter |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const decision of [
    ...result.approval_authority_catalog.artifact_authority_decisions,
    ...result.approval_authority_catalog.delivery_action_authority_decisions,
  ]) {
    lines.push(`| ${decision.subject_ref.subject_id} | ${decision.required_authority_role} | ${decision.required_approval_level} | ${decision.assignment_status} | ${decision.assigned_user_id ?? ""} | ${decision.matter_id ?? ""} |`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options = {}) {
  return {
    identity_model_path: path.resolve(options.identityModelPath ?? DEFAULT_APPROVAL_AUTHORITY_LEDGER_INPUTS.identityModelPath),
    matter_profile_team_ledger_path: path.resolve(options.matterProfileTeamLedgerPath ?? DEFAULT_APPROVAL_AUTHORITY_LEDGER_INPUTS.matterProfileTeamLedgerPath),
    gate_approval_contract_freeze_path: path.resolve(options.gateApprovalContractFreezePath ?? DEFAULT_APPROVAL_AUTHORITY_LEDGER_INPUTS.gateApprovalContractFreezePath),
    output_delivery_contract_freeze_path: path.resolve(options.outputDeliveryContractFreezePath ?? DEFAULT_APPROVAL_AUTHORITY_LEDGER_INPUTS.outputDeliveryContractFreezePath),
    output_destination_policy_enforcement_path: path.resolve(options.outputDestinationPolicyEnforcementPath ?? DEFAULT_APPROVAL_AUTHORITY_LEDGER_INPUTS.outputDestinationPolicyEnforcementPath),
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
    else if (arg === "--identity-model") parsed.identityModelPath = argv[++index];
    else if (arg === "--matter-profile-team-ledger") parsed.matterProfileTeamLedgerPath = argv[++index];
    else if (arg === "--gate-approval-contract") parsed.gateApprovalContractFreezePath = argv[++index];
    else if (arg === "--output-delivery-contract") parsed.outputDeliveryContractFreezePath = argv[++index];
    else if (arg === "--output-destination-policy") parsed.outputDestinationPolicyEnforcementPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/approval-authority-ledger.mjs [options]

Options:
  --check                         Fail when validation errors are present.
  --no-write                      Build without writing artifacts.
  --out-dir <path>                Output directory.
  --identity-model <path>         identity-model.json path.
  --matter-profile-team-ledger <path>
                                  matter-profile-team-ledger.json path.
  --gate-approval-contract <path> gate-approval-contract-freeze.json path.
  --output-delivery-contract <path>
                                  output-delivery-contract-freeze.json path.
  --output-destination-policy <path>
                                  output-destination-policy-enforcement.json path.
`);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readJsonOrError(filePath) {
  try {
    return { ok: true, path: filePath, value: await readJson(filePath) };
  } catch (error) {
    return { ok: false, path: filePath, value: null, error: error.message };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableLedger(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: item.subject_id, message: item.message }));
  return { valid: errors.length === 0, errors };
}

function pushCheck(items, subjectType, checkId, passed, message, metadata = {}) {
  items.push({
    schema_version: "approval-authority-validation.v1",
    validation_id: `approval-authority-validation.${slugify(subjectType)}.${slugify(checkId)}`,
    subject_type: subjectType,
    subject_id: subjectType,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
    metadata,
  });
}

function groupBy(items, key) {
  const grouped = new Map();
  for (const item of items ?? []) {
    const value = item?.[key] ?? null;
    if (!grouped.has(value)) grouped.set(value, []);
    grouped.get(value).push(item);
  }
  return grouped;
}

function countBy(items, key) {
  const counts = {};
  for (const item of items ?? []) {
    const value = item?.[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function duplicates(values) {
  const seen = new Set();
  const duplicated = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicated.add(value);
    seen.add(value);
  }
  return [...duplicated].sort();
}

function uniqueBy(items, key) {
  const seen = new Set();
  const unique = [];
  for (const item of items) {
    const value = item[key];
    if (seen.has(value)) continue;
    seen.add(value);
    unique.push(item);
  }
  return unique;
}

function intersects(left, right) {
  const rightSet = new Set(right ?? []);
  return (left ?? []).some((value) => rightSet.has(value));
}

function firstPresent(...values) {
  return values.find((value) => value !== undefined && value !== null) ?? null;
}

function by(key) {
  return (left, right) => String(left?.[key] ?? "").localeCompare(String(right?.[key] ?? ""));
}

function slugify(value) {
  return String(value ?? "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.TZ]/g, "").slice(0, 14);
}
