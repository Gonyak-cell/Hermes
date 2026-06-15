export function sectionForNav(navId) {
  return {
    queue: "__queue__",
    projects: "projects",
    requirements: "release",
    evidence: "__all__",
    release: "release",
    factory: "factory",
    reviews: "reviews",
    gates: "factory",
    conversations: "__none__",
    governance: "authority_boundary",
    sources: "__all__",
    artifacts: "__all__",
    settings: "authority_boundary",
  }[navId] ?? "release";
}

export function rowsForNav(navId, readModel = {}) {
  const rows = readModel.source_rows ?? [];
  const sectionId = sectionForNav(navId);
  if (navId === "settings") return [];
  if (sectionId === "__all__") return rows;
  if (sectionId === "__none__") return [];
  if (sectionId === "__queue__") {
    const blockedRows = rows.filter((row) => row.status !== "ready");
    return blockedRows.length > 0 ? blockedRows : rows.filter((row) => ["release", "factory", "reviews"].includes(row.section_id));
  }
  return rows.filter((row) => row.section_id === sectionId);
}

export function rowKey(row) {
  return `${row?.section_id ?? "unknown"}.${row?.source_id ?? row?.source_path ?? "unknown"}`;
}

export function summarizeRows(rows = []) {
  return {
    total: rows.length,
    ready: rows.filter((row) => row.status === "ready").length,
    blocked: rows.filter((row) => row.status !== "ready").length,
  };
}
