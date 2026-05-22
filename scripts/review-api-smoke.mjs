#!/usr/bin/env node
import assert from "node:assert/strict";
import { startReviewApiServer } from "../src/review-api.mjs";

const args = parseArgs(process.argv.slice(2));
const { server, url } = await startReviewApiServer({
  ...args,
  port: 0,
});

try {
  const health = await fetchJson(`${url}/health`);
  assert.equal(health.status, "ok");
  assert.equal(health.dashboard_available, true);

  const index = await fetchJson(`${url}/api`);
  assert.equal(index.schema_version, "review-api-index.v1");
  assert.ok(index.routes.some((route) => route.path === "/api/dashboard"));

  const dashboard = await fetchJson(`${url}/api/dashboard`);
  assert.equal(dashboard.schema_version, "review-dashboard.v1");

  const stages = await fetchJson(`${url}/api/stages`);
  assert.equal(stages.collection, "stage_statuses");
  assert.ok(stages.count > 0);

  const actions = await fetchJson(`${url}/api/actions?limit=5`);
  assert.equal(actions.collection, "action_items");
  assert.ok(actions.count <= 5);

  const html = await fetch(`${url}/`);
  assert.equal(html.status, 200);
  assert.match(await html.text(), /Hermes Review Dashboard/);

  console.log(`Review API smoke test passed at ${url}`);
} finally {
  await new Promise((resolve) => server.close(resolve));
}

async function fetchJson(url) {
  const response = await fetch(url);
  assert.equal(response.status, 200, `${url} returned ${response.status}`);
  return response.json();
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dashboard") parsed.dashboardPath = argv[++index];
    else if (arg === "--index") parsed.indexPath = argv[++index];
    else if (arg === "--summary") parsed.summaryPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}
