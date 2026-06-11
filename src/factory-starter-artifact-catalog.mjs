export const FACTORY_STARTER_ARTIFACT_REFS_BY_PACK = {
  "pack.law_firm": [
    ["templates/law-firm/matter-intake.md", "matter_intake_template"],
    ["templates/law-firm/review-packet.md", "review_packet_template"],
  ],
  "pack.personal_dev": [
    ["templates/personal-dev/issue-intake.md", "issue_intake_template"],
    ["templates/personal-dev/review-packet.md", "review_packet_template"],
  ],
  "pack.platform": [
    ["templates/platform/product-operating-brief.md", "product_operating_brief_template"],
    ["templates/platform/review-packet.md", "review_packet_template"],
  ],
  "pack.human_resources": [
    ["templates/human-resources/intake.md", "hr_intake_template"],
    ["templates/human-resources/review-packet.md", "review_packet_template"],
  ],
  "pack.external_adapter": [
    ["templates/connectors/bridge-plan.md", "connector_bridge_plan_template"],
    ["templates/connectors/review-packet.md", "review_packet_template"],
  ],
  "pack.trading": [
    ["templates/trading/read-only-dashboard.md", "read_only_dashboard_template"],
    ["templates/trading/review-packet.md", "review_packet_template"],
  ],
};

export function buildFactoryStarterArtifactRefs(domainPackIds = [], productId = null) {
  const refs = [];
  for (const packId of domainPackIds) {
    for (const [artifactPath, artifactRole] of FACTORY_STARTER_ARTIFACT_REFS_BY_PACK[packId] ?? []) {
      refs.push({
        schema_version: "factory-candidate-artifact-ref.v1",
        artifact_ref_id: productId ? `artifact-ref.${normalizeKey(productId)}.${normalizeKey(artifactRole)}` : `artifact-ref.${normalizeKey(packId)}.${normalizeKey(artifactRole)}`,
        product_id: productId,
        domain_pack_id: packId,
        artifact_path: artifactPath,
        artifact_role: artifactRole,
        artifact_kind: "starter_template",
      });
    }
  }
  return refs;
}

export function normalizeFactoryPackId(packId) {
  return `pack.${String(packId).replaceAll("-", "_")}`;
}

export function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
