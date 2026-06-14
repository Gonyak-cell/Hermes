export function sectionForNav(navId) {
  return {
    release: "release",
    factory: "factory",
    reviews: "reviews",
    artifacts: "artifacts",
    settings: "authority_boundary",
  }[navId] ?? "release";
}

export function summarizeRows(rows = []) {
  return {
    total: rows.length,
    ready: rows.filter((row) => row.status === "ready").length,
    blocked: rows.filter((row) => row.status !== "ready").length,
  };
}
