import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_IDENTITY_MODEL_OUT_DIR = "artifacts/identity-model/latest";
export const DEFAULT_IDENTITY_MODEL_INPUTS = {
  verticalSlicePath: "examples/core/vertical-slice-example.json",
};

const PRINCIPAL_CLASS_BY_ACTOR_TYPE = new Map([
  ["human", "human_actor"],
  ["harness", "service_actor"],
  ["hermes", "service_actor"],
  ["claude_code", "runtime_actor"],
  ["codex", "runtime_actor"],
  ["script", "runtime_actor"],
  ["connector", "connector_actor"],
  ["renderer", "runtime_actor"],
  ["mcp_tool", "runtime_actor"],
  ["browser", "runtime_actor"],
  ["manual", "manual_actor"],
]);

export async function runIdentityModel(options = {}) {
  const result = await buildIdentityModel(options);
  if (options.write !== false) await writeIdentityModel(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Identity model validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildIdentityModel(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_IDENTITY_MODEL_OUT_DIR);
  const verticalSlicePath = path.resolve(options.verticalSlicePath ?? DEFAULT_IDENTITY_MODEL_INPUTS.verticalSlicePath);
  const source = await readJson(verticalSlicePath);
  const identityPolicy = source.schema_version === "identity-policy.v1" ? source : source.identity_policy;
  const projected = projectIdentityModel(identityPolicy, source, generatedAt);
  const validationItems = validateIdentityModel(identityPolicy, source, projected);
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "identity-model.v1",
    generated_at: generatedAt,
    identity_model_id: `identity-model.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs: {
      vertical_slice_path: verticalSlicePath,
    },
    source_identity_policy: {
      schema_version: identityPolicy?.schema_version ?? null,
      tenant_count: identityPolicy?.tenants?.length ?? 0,
      user_count: identityPolicy?.users?.length ?? 0,
      client_count: identityPolicy?.clients?.length ?? 0,
      matter_count: identityPolicy?.matters?.length ?? 0,
      policy_snapshot_count: identityPolicy?.policy_snapshots?.length ?? 0,
    },
    identity_contract: {
      schema_version: "identity-contract.v1",
      generated_at: generatedAt,
      tenants: projected.tenants,
      users: projected.users,
      roles: projected.roles,
      role_assignments: projected.roleAssignments,
      actor_principals: projected.actorPrincipals,
      actor_user_bindings: projected.actorUserBindings,
    },
    validation_items: validationItems,
    validation,
    summary: summarizeIdentityModel(projected, validationItems, validation),
  };
  return {
    ...result,
    markdown: renderIdentityModelMarkdown(result),
  };
}

export async function writeIdentityModel(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableIdentityModel(result);
  await writeJson(path.join(outDir, "identity-model.json"), serializable);
  await writeJson(path.join(outDir, "identity-users.json"), {
    generated_at: result.generated_at,
    user_count: result.identity_contract.users.length,
    users: result.identity_contract.users,
  });
  await writeJson(path.join(outDir, "actor-principals.json"), {
    generated_at: result.generated_at,
    actor_principal_count: result.identity_contract.actor_principals.length,
    actor_principals: result.identity_contract.actor_principals,
  });
  await writeJson(path.join(outDir, "role-assignments.json"), {
    generated_at: result.generated_at,
    role_assignment_count: result.identity_contract.role_assignments.length,
    role_assignments: result.identity_contract.role_assignments,
  });
  await writeJson(path.join(outDir, "actor-user-bindings.json"), {
    generated_at: result.generated_at,
    actor_user_binding_count: result.identity_contract.actor_user_bindings.length,
    actor_user_bindings: result.identity_contract.actor_user_bindings,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    identity_model_id: result.identity_model_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runIdentityModelCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runIdentityModel(args);
    console.log(`Identity model written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.identity_model_status}`);
    console.log(`Users: ${result.summary.user_count}`);
    console.log(`Actor principals: ${result.summary.actor_principal_count}`);
    console.log(`Role assignments: ${result.summary.role_assignment_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectIdentityModel(identityPolicy, source, generatedAt) {
  const tenantsSource = identityPolicy?.tenants ?? [];
  const usersSource = identityPolicy?.users ?? [];
  const mattersSource = identityPolicy?.matters ?? [];
  const tenantById = new Map(tenantsSource.map((tenant) => [tenant.id, tenant]));
  const roleCatalog = new Map();
  const roleAssignments = [];
  const actorPrincipalMap = new Map();
  const actorUserBindings = [];

  const tenants = tenantsSource.map((tenant) => ({
    schema_version: "identity-tenant.v1",
    tenant_id: tenant.id,
    display_name: tenant.name,
    tenant_type: tenant.tenant_type,
    default_policy_id: tenant.default_policy_id,
    created_at: tenant.created_at ?? generatedAt,
    source_schema_version: tenant.schema_version,
    metadata: tenant.metadata ?? {},
  })).sort((left, right) => left.tenant_id.localeCompare(right.tenant_id));

  const users = usersSource.map((user) => {
    const humanActorPrincipalId = actorPrincipalId("human", humanActorId(user.id));
    return {
      schema_version: "identity-user.v1",
      user_id: user.id,
      tenant_id: user.tenant_id,
      display_name: user.display_name,
      status: user.status,
      tenant_role_ids: (user.roles ?? []).map((role) => tenantRoleId(role)).sort(),
      human_actor_principal_id: humanActorPrincipalId,
      created_at: user.created_at ?? generatedAt,
      source_schema_version: user.schema_version,
      metadata: user.metadata ?? {},
    };
  }).sort((left, right) => left.user_id.localeCompare(right.user_id));

  for (const user of usersSource) {
    for (const role of user.roles ?? []) {
      const roleId = ensureRole(roleCatalog, {
        role_id: tenantRoleId(role),
        role_name: role,
        role_scope: "tenant",
        tenant_id: user.tenant_id,
        matter_id: null,
        description: `Tenant role ${role}`,
      });
      const actorId = humanActorId(user.id);
      const actorPrincipal = ensureActorPrincipal(actorPrincipalMap, {
        actor_type: "human",
        actor_id: actorId,
        display_name: user.display_name,
        tenant_id: user.tenant_id,
        human_user_id: user.id,
        discovered_from: "identity_policy.users",
        generated_at: generatedAt,
      });
      roleAssignments.push(roleAssignment({
        assignmentSource: "tenant_user_role",
        userId: user.id,
        actorPrincipalId: actorPrincipal.actor_principal_id,
        tenantId: user.tenant_id,
        matterId: null,
        roleId,
        roleScope: "tenant",
        sourceRef: user.id,
      }));
    }
    actorUserBindings.push({
      schema_version: "actor-user-binding.v1",
      binding_id: `actor-user-binding.${slugify(user.id)}`,
      tenant_id: user.tenant_id,
      binding_type: "human_user_actor",
      user_id: user.id,
      actor_principal_id: actorPrincipalId("human", humanActorId(user.id)),
      actor_type: "human",
      binding_status: user.status === "active" ? "active" : "inactive",
      role_assignment_ids: roleAssignments
        .filter((assignment) => assignment.user_id === user.id && assignment.assignment_scope === "tenant")
        .map((assignment) => assignment.role_assignment_id)
        .sort(),
    });
  }

  for (const matter of mattersSource) {
    for (const member of matter.matter_team ?? []) {
      const sourceUser = usersSource.find((user) => user.id === member.user_id);
      const roleId = ensureRole(roleCatalog, {
        role_id: matterRoleId(member.matter_role),
        role_name: member.matter_role,
        role_scope: "matter",
        tenant_id: matter.tenant_id,
        matter_id: matter.id,
        description: `Matter role ${member.matter_role}`,
      });
      roleAssignments.push(roleAssignment({
        assignmentSource: "matter_team_role",
        userId: member.user_id,
        actorPrincipalId: sourceUser ? actorPrincipalId("human", humanActorId(sourceUser.id)) : null,
        tenantId: matter.tenant_id,
        matterId: matter.id,
        roleId,
        roleScope: "matter",
        sourceRef: `${matter.id}:${member.user_id}`,
      }));
    }
  }

  for (const hint of discoverActorHints(source, identityPolicy)) {
    const actorPrincipal = ensureActorPrincipal(actorPrincipalMap, {
      ...hint,
      generated_at: generatedAt,
    });
    if (actorPrincipal.principal_class !== "human_actor") {
      const roleId = ensureRole(roleCatalog, {
        role_id: systemRoleId(actorPrincipal.actor_type),
        role_name: actorPrincipal.actor_type,
        role_scope: "system_actor",
        tenant_id: actorPrincipal.tenant_id,
        matter_id: null,
        description: `System actor role for ${actorPrincipal.actor_type}`,
      });
      roleAssignments.push(roleAssignment({
        assignmentSource: "actor_system_role",
        userId: null,
        actorPrincipalId: actorPrincipal.actor_principal_id,
        tenantId: actorPrincipal.tenant_id,
        matterId: null,
        roleId,
        roleScope: "system_actor",
        sourceRef: actorPrincipal.actor_id,
      }));
      actorUserBindings.push({
        schema_version: "actor-user-binding.v1",
        binding_id: `actor-user-binding.${slugify(actorPrincipal.actor_principal_id)}`,
        tenant_id: actorPrincipal.tenant_id,
        binding_type: "system_actor_tenant",
        user_id: null,
        actor_principal_id: actorPrincipal.actor_principal_id,
        actor_type: actorPrincipal.actor_type,
        binding_status: "active",
        role_assignment_ids: roleAssignments
          .filter((assignment) => assignment.actor_principal_id === actorPrincipal.actor_principal_id)
          .map((assignment) => assignment.role_assignment_id)
          .sort(),
      });
    }
  }

  return {
    tenants,
    users,
    roles: [...roleCatalog.values()].sort((left, right) => left.role_id.localeCompare(right.role_id)),
    roleAssignments: dedupeBy(roleAssignments, "role_assignment_id").sort((left, right) => left.role_assignment_id.localeCompare(right.role_assignment_id)),
    actorPrincipals: [...actorPrincipalMap.values()].sort((left, right) => left.actor_principal_id.localeCompare(right.actor_principal_id)),
    actorUserBindings: dedupeBy(actorUserBindings, "binding_id").sort((left, right) => left.binding_id.localeCompare(right.binding_id)),
  };
}

function discoverActorHints(source, identityPolicy) {
  const hints = [];
  const defaultTenantId = identityPolicy?.tenants?.[0]?.id ?? "tenant.unknown";
  for (const user of identityPolicy?.users ?? []) {
    hints.push({
      actor_type: "human",
      actor_id: humanActorId(user.id),
      display_name: user.display_name,
      tenant_id: user.tenant_id,
      human_user_id: user.id,
      discovered_from: "identity_policy.users",
    });
  }

  for (const resource of source.resource_evidence?.resources ?? []) {
    if (resource.created_by) hints.push(actorHint(resource.created_by, resource.tenant_id ?? defaultTenantId, null, "resource.created_by"));
  }
  for (const workflowRun of source.workflow_runtime?.workflow_runs ?? []) {
    if (workflowRun.created_by) hints.push(actorHint(workflowRun.created_by, workflowRun.tenant_id ?? defaultTenantId, workflowRun.matter_id ?? null, "workflow_run.created_by"));
  }
  for (const event of source.governance_output?.audit_events ?? []) {
    if (event.actor) hints.push(actorHint(event.actor, event.tenant_id ?? defaultTenantId, event.data?.matter_id ?? null, "audit_event.actor"));
  }
  for (const workflow of source.workflow_runtime?.workflows ?? []) {
    for (const step of workflow.steps ?? []) hints.push(runtimeHint(step.runtime_id, defaultTenantId, null, "workflow.step.runtime_id"));
  }
  for (const agentRun of source.workflow_runtime?.agent_runs ?? []) {
    hints.push(runtimeHint(agentRun.runtime_id, defaultTenantId, null, "agent_run.runtime_id"));
  }
  return dedupeHints(hints);
}

function actorHint(actor, tenantId, matterId, discoveredFrom) {
  return {
    actor_type: actor.actor_type,
    actor_id: actor.actor_id,
    display_name: actor.display_name ?? actor.actor_id,
    tenant_id: tenantId,
    matter_id: matterId,
    human_user_id: actor.actor_type === "human" ? actor.actor_id.replace(/^human\./, "") : null,
    discovered_from: discoveredFrom,
  };
}

function runtimeHint(runtimeId, tenantId, matterId, discoveredFrom) {
  return {
    actor_type: runtimeActorType(runtimeId),
    actor_id: `runtime.${runtimeId}`,
    display_name: `Runtime ${runtimeId}`,
    tenant_id: tenantId,
    matter_id: matterId,
    human_user_id: null,
    discovered_from: discoveredFrom,
  };
}

function ensureRole(roleCatalog, role) {
  if (!roleCatalog.has(role.role_id)) {
    roleCatalog.set(role.role_id, {
      schema_version: "identity-role.v1",
      role_id: role.role_id,
      role_name: role.role_name,
      role_scope: role.role_scope,
      tenant_id: role.tenant_id ?? null,
      matter_id: role.matter_id ?? null,
      description: role.description,
      permissions_hint: [],
    });
  }
  return role.role_id;
}

function ensureActorPrincipal(actorPrincipalMap, actor) {
  const principalId = actorPrincipalId(actor.actor_type, actor.actor_id);
  if (!actorPrincipalMap.has(principalId)) {
    actorPrincipalMap.set(principalId, {
      schema_version: "actor-principal.v1",
      actor_principal_id: principalId,
      actor_type: actor.actor_type,
      actor_id: actor.actor_id,
      display_name: actor.display_name ?? actor.actor_id,
      tenant_id: actor.tenant_id,
      principal_class: PRINCIPAL_CLASS_BY_ACTOR_TYPE.get(actor.actor_type) ?? "service_actor",
      human_user_id: actor.actor_type === "human" ? actor.human_user_id : null,
      discovered_from: [actor.discovered_from ?? "unknown"],
      binding_status: "active",
      created_at: actor.generated_at,
      metadata: {
        matter_id: actor.matter_id ?? null,
      },
    });
  } else {
    const existing = actorPrincipalMap.get(principalId);
    existing.discovered_from = unique([...existing.discovered_from, actor.discovered_from ?? "unknown"]).sort();
  }
  return actorPrincipalMap.get(principalId);
}

function roleAssignment({ assignmentSource, userId, actorPrincipalId, tenantId, matterId, roleId, roleScope, sourceRef }) {
  return {
    schema_version: "role-assignment.v1",
    role_assignment_id: `role-assignment.${slugify(assignmentSource)}.${slugify(roleId)}.${slugify(sourceRef)}`,
    assignment_source: assignmentSource,
    assignment_scope: roleScope,
    tenant_id: tenantId,
    matter_id: matterId,
    user_id: userId,
    actor_principal_id: actorPrincipalId,
    role_id: roleId,
    assignment_status: "active",
  };
}

function validateIdentityModel(identityPolicy, source, projected) {
  const items = [];
  const tenantIds = new Set(projected.tenants.map((tenant) => tenant.tenant_id));
  const userIds = new Set(projected.users.map((user) => user.user_id));
  const roleIds = new Set(projected.roles.map((role) => role.role_id));
  const actorPrincipalIds = new Set(projected.actorPrincipals.map((actor) => actor.actor_principal_id));
  const humanActors = projected.actorPrincipals.filter((actor) => actor.principal_class === "human_actor");

  addValidation(items, {
    path: "source_identity_policy",
    check_id: "source_identity_policy_available",
    passed: identityPolicy?.schema_version === "identity-policy.v1",
    message: `Source identity policy schema is ${identityPolicy?.schema_version ?? "missing"}.`,
  });
  addValidation(items, {
    path: "identity_contract.tenants",
    check_id: "tenant_present",
    passed: projected.tenants.length > 0,
    message: `${projected.tenants.length} tenant(s) projected.`,
  });
  addValidation(items, {
    path: "identity_contract.users",
    check_id: "human_user_present",
    passed: projected.users.length > 0,
    message: `${projected.users.length} user(s) projected.`,
  });
  for (const user of projected.users) {
    addValidation(items, {
      path: `identity_contract.users.${user.user_id}.tenant_id`,
      check_id: "user_tenant_exists",
      passed: tenantIds.has(user.tenant_id),
      message: `${user.user_id} tenant is ${user.tenant_id}.`,
    });
    addValidation(items, {
      path: `identity_contract.users.${user.user_id}.tenant_role_ids`,
      check_id: "user_has_tenant_role",
      passed: user.tenant_role_ids.length > 0,
      message: `${user.user_id} has ${user.tenant_role_ids.length} tenant role(s).`,
    });
    addValidation(items, {
      path: `identity_contract.users.${user.user_id}.human_actor_principal_id`,
      check_id: "user_has_distinct_human_actor",
      passed: actorPrincipalIds.has(user.human_actor_principal_id) && user.human_actor_principal_id !== user.user_id,
      message: `${user.user_id} is bound to ${user.human_actor_principal_id}.`,
    });
  }
  for (const actor of projected.actorPrincipals) {
    addValidation(items, {
      path: `identity_contract.actor_principals.${actor.actor_principal_id}.tenant_id`,
      check_id: "actor_tenant_exists",
      passed: tenantIds.has(actor.tenant_id),
      message: `${actor.actor_principal_id} tenant is ${actor.tenant_id}.`,
    });
    addValidation(items, {
      path: `identity_contract.actor_principals.${actor.actor_principal_id}.human_user_id`,
      check_id: "actor_user_boundary_enforced",
      passed: actor.principal_class === "human_actor" ? userIds.has(actor.human_user_id) : actor.human_user_id === null,
      message: `${actor.actor_principal_id} class is ${actor.principal_class}.`,
    });
  }
  for (const assignment of projected.roleAssignments) {
    addValidation(items, {
      path: `identity_contract.role_assignments.${assignment.role_assignment_id}.role_id`,
      check_id: "role_assignment_role_exists",
      passed: roleIds.has(assignment.role_id),
      message: `${assignment.role_assignment_id} role is ${assignment.role_id}.`,
    });
    addValidation(items, {
      path: `identity_contract.role_assignments.${assignment.role_assignment_id}.principal`,
      check_id: "role_assignment_principal_exists",
      passed: Boolean(assignment.user_id ? userIds.has(assignment.user_id) : actorPrincipalIds.has(assignment.actor_principal_id)),
      message: `${assignment.role_assignment_id} principal is ${assignment.user_id ?? assignment.actor_principal_id}.`,
    });
  }
  for (const approval of source.governance_output?.approvals ?? []) {
    const user = projected.users.find((item) => item.user_id === approval.requested_from);
    addValidation(items, {
      path: `governance_output.approvals.${approval.id}.requested_from`,
      check_id: "approval_requested_from_maps_to_human_user",
      passed: Boolean(user && actorPrincipalIds.has(user.human_actor_principal_id)),
      message: `${approval.id} requested_from is ${approval.requested_from}.`,
    });
  }
  addValidation(items, {
    path: "identity_contract.actor_user_bindings",
    check_id: "human_user_actor_binding_complete",
    passed: projected.actorUserBindings.filter((binding) => binding.binding_type === "human_user_actor").length === projected.users.length,
    message: `${projected.actorUserBindings.filter((binding) => binding.binding_type === "human_user_actor").length}/${projected.users.length} human user binding(s).`,
  });
  addValidation(items, {
    path: "identity_contract.actor_principals",
    check_id: "human_and_system_actors_distinguished",
    passed: humanActors.length > 0 && projected.actorPrincipals.some((actor) => actor.principal_class !== "human_actor"),
    message: `${humanActors.length} human actor(s), ${projected.actorPrincipals.length - humanActors.length} non-human actor(s).`,
  });
  return items;
}

function summarizeIdentityModel(projected, validationItems, validation) {
  const humanActors = projected.actorPrincipals.filter((actor) => actor.principal_class === "human_actor");
  return {
    identity_model_status: validation.valid ? "complete" : "blocked",
    tenant_count: projected.tenants.length,
    user_count: projected.users.length,
    role_count: projected.roles.length,
    tenant_role_count: projected.roles.filter((role) => role.role_scope === "tenant").length,
    matter_role_count: projected.roles.filter((role) => role.role_scope === "matter").length,
    system_role_count: projected.roles.filter((role) => role.role_scope === "system_actor").length,
    role_assignment_count: projected.roleAssignments.length,
    human_user_role_assignment_count: projected.roleAssignments.filter((assignment) => assignment.user_id).length,
    actor_role_assignment_count: projected.roleAssignments.filter((assignment) => assignment.actor_principal_id).length,
    actor_principal_count: projected.actorPrincipals.length,
    human_actor_principal_count: humanActors.length,
    service_actor_principal_count: projected.actorPrincipals.filter((actor) => actor.principal_class !== "human_actor").length,
    actor_user_binding_count: projected.actorUserBindings.length,
    human_actor_user_binding_count: projected.actorUserBindings.filter((binding) => binding.binding_type === "human_user_actor").length,
    system_actor_binding_count: projected.actorUserBindings.filter((binding) => binding.binding_type === "system_actor_tenant").length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_tenant_id: countBy(projected.users, "tenant_id"),
    by_actor_type: countBy(projected.actorPrincipals, "actor_type"),
    by_principal_class: countBy(projected.actorPrincipals, "principal_class"),
    by_role_scope: countBy(projected.roles, "role_scope"),
  };
}

function addValidation(items, { path: itemPath, check_id: checkId, passed, message }) {
  items.push({
    validation_item_id: `identity-model.${slugify(itemPath)}.${checkId}`,
    path: itemPath,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  });
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: item.path, message: item.message, check_id: item.check_id }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function renderIdentityModelMarkdown(result) {
  const lines = [];
  lines.push("# Identity Model");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.identity_model_status}`);
  lines.push("");
  lines.push(`- Tenants: ${result.summary.tenant_count}`);
  lines.push(`- Human users: ${result.summary.user_count}`);
  lines.push(`- Actor principals: ${result.summary.actor_principal_count}`);
  lines.push(`- Human actor principals: ${result.summary.human_actor_principal_count}`);
  lines.push(`- Service/runtime actor principals: ${result.summary.service_actor_principal_count}`);
  lines.push(`- Roles: ${result.summary.role_count}`);
  lines.push(`- Role assignments: ${result.summary.role_assignment_count}`);
  lines.push(`- Actor-user bindings: ${result.summary.actor_user_binding_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--vertical-slice") parsed.verticalSlicePath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/identity-model.mjs [options]

Options:
  --vertical-slice <path>  Vertical slice or identity-policy JSON path.
  --out-dir <path>         Output directory.
  --run-at <iso>           Fixed generation timestamp.
  --check                  Exit non-zero when validation fails.
  -h, --help               Show this help.
`);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableIdentityModel(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function actorPrincipalId(actorType, actorId) {
  return `actor-principal.${slugify(actorType)}.${slugify(actorId)}`;
}

function humanActorId(userId) {
  return `human.${userId}`;
}

function tenantRoleId(role) {
  return `tenant-role.${slugify(role)}`;
}

function matterRoleId(role) {
  return `matter-role.${slugify(role)}`;
}

function systemRoleId(actorType) {
  return `system-role.${slugify(actorType)}`;
}

function runtimeActorType(runtimeId) {
  if (runtimeId === "local_script") return "script";
  if (runtimeId === "harness") return "harness";
  if (runtimeId === "manual") return "manual";
  return "script";
}

function dedupeHints(hints) {
  const seen = new Set();
  const result = [];
  for (const hint of hints) {
    const key = `${hint.actor_type}:${hint.actor_id}:${hint.tenant_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(hint);
  }
  return result;
}

function dedupeBy(items, key) {
  const seen = new Map();
  for (const item of items) {
    if (!seen.has(item[key])) seen.set(item[key], item);
  }
  return [...seen.values()];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function countBy(items, key) {
  return Object.fromEntries(
    [...items.reduce((counts, item) => {
      const value = item[key] ?? "unknown";
      counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map()).entries()].sort(([left], [right]) => String(left).localeCompare(String(right))),
  );
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 160) || "unknown";
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
