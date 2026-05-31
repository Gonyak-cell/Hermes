import assert from "node:assert/strict";
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { buildAdapterSelectionPolicy, selectAdapterChain } from "../src/adapter-selection-policy.mjs";
import { buildPublicWebConnector, validatePublicWebRequest } from "../src/public-web-connector.mjs";
import { extractResourceFile } from "../src/resource-extract.mjs";
import { buildResourceIngest } from "../src/resource-ingest.mjs";
import { buildSwarmTopologyContract } from "../src/swarm-topology-contract.mjs";

test("adapter selection keeps Office primary probes and promotes PDF/image local chain", () => {
  const report = buildAdapterSelectionPolicy({ runAt: "2026-05-30T00:00:00.000Z" });
  assert.equal(report.validation.valid, true);
  assert.equal(report.summary.trading_pack_untouched, true);

  assert.equal(selectAdapterChain("pdf").primary_adapter_id, "liteparse_local");
  assert.equal(selectAdapterChain("png").fallback_adapter_ids.includes("paddleocr_local"), true);
  assert.equal(selectAdapterChain("docx").primary_adapter_id, "docx_word_xml_probe");
  assert.equal(selectAdapterChain("docx").sidecar_adapter_ids.includes("liteparse_layout_sidecar"), true);
});

test("public web connector materializes only allowlisted P0/P1 fixture pages", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-public-web-"));
  try {
    const fixturePath = path.join(root, "fixture.html");
    const inputPath = path.join(root, "input.json");
    const outDir = path.join(root, "out");
    await writeFile(fixturePath, "<html><head><title>Fixture</title></head><body><h1>Fixture</h1><p>Public only.</p></body></html>", "utf8");
    await writeFile(inputPath, `${JSON.stringify({
      allowed_domains: ["example.com"],
      pages: [
        {
          url: "https://example.com/public-alpha",
          fixture_path: fixturePath,
          matter_id: "matter.public.alpha",
          classification: "P0_PUBLIC",
          purpose: "test fixture",
        },
        {
          url: "https://example.com/privileged",
          matter_id: "matter.public.alpha",
          classification: "P3_PRIVILEGED",
          purpose: "blocked fixture",
        },
      ],
    }, null, 2)}\n`, "utf8");

    const result = await buildPublicWebConnector({
      inputPath,
      outDir,
      runAt: "2026-05-30T00:00:00.000Z",
      write: false,
    });

    assert.equal(result.summary.materialized_page_count, 1);
    assert.equal(result.summary.blocked_page_count, 1);
    assert.equal(result.public_web_resource_items[0].resource_expansion_candidate.extraction.extractor, "plain_text_probe");
    assert.equal(result.public_web_resource_items[0].resource_expansion_candidate.extraction.metadata.connector_extractor, "crawl4ai_public_web_connector");
    await assert.rejects(readdir(outDir));

    const blocked = validatePublicWebRequest({
      url: "http://127.0.0.1:3000/internal",
      matter_id: "matter.public.alpha",
      classification: "P0_PUBLIC",
      purpose: "blocked private target",
    }, { allowlist: ["127.0.0.1"] });
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.reason, "private_network_target");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("image extraction falls back to local manual review when optional parsers are absent", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-image-extract-"));
  try {
    const imagePath = path.join(root, "scan.png");
    await writeFile(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const record = await extractResourceFile({
      path: imagePath,
      relative_path: "scan.png",
      size_bytes: 8,
      extension: "png",
      candidate_domain: "resource",
      resource_type: "document",
      extractor_family: "image",
    }, { command: "__hermes_missing_parser__", timeoutMs: 1000 });

    assert.equal(record.extraction_status, "extracted");
    assert.equal(record.extractor, "manual_review_image_probe");
    assert.equal(record.metadata.adapter_chain.selected_extractor, "manual_review");
    assert.equal(record.metadata.adapter_chain.external_service_allowed, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("resource ingest preserves adapter source spans for evidence lineage", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-resource-ingest-"));
  try {
    const jobPath = path.join(root, "resource-expansion-job.json");
    await writeFile(jobPath, `${JSON.stringify({
      job_id: "job.safe-adapter-test",
      items: [
        {
          item_id: "item.scan",
          status: "extracted",
          source_path: "scan.png",
          relative_path: "scan.png",
          extension: "png",
          resource_id: "resource.scan",
          resource_version_id: "resource.scan.v1",
          raw_hash_sha256: "raw-hash",
          data_classification: "P2_CLIENT_CONFIDENTIAL",
          matter_id: "matter.alpha",
          resource_type: "document",
          candidate_domain: "law-firm",
          extraction: {
            extractor: "paddleocr_local",
            text_preview: "Signed page",
            text_length: 11,
            text_truncated: false,
            metadata: {
              language: "en",
              adapter_chain: {
                selected_extractor: "paddleocr_local",
                external_service_allowed: false,
                network_access_allowed: false,
              },
              source_spans: [
                { page_number: 1, bbox: [1, 2, 3, 4], text: "Signed page", confidence: 0.91 },
              ],
            },
          },
        },
      ],
    }, null, 2)}\n`, "utf8");

    const result = await buildResourceIngest({
      inputPath: jobPath,
      outDir: path.join(root, "out"),
      runAt: "2026-05-30T00:00:00.000Z",
    });

    assert.equal(result.resource_evidence.source_spans.length, 2);
    assert.deepEqual(result.resource_evidence.evidence_items[0].source_span_ids, [
      "span.scan.whole_document",
      "span.scan.bbox.1",
    ]);
    assert.equal(result.resource_evidence.normalized_texts[0].metadata.source_span_count, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("swarm topology contract projects dry-run Hermes commands without worker execution", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-swarm-topology-"));
  try {
    const workflowRunnerPath = path.join(root, "workflow-runner.json");
    const workPacketsPath = path.join(root, "work-packets.json");
    const packagePath = path.join(root, "package.json");
    await mkdir(root, { recursive: true });
    await writeFile(workflowRunnerPath, `${JSON.stringify({
      workflow_runner_plans: [
        {
          workflow_runner_plan_id: "runner.ldd",
          workflow_run_id: "workflow-run.ldd",
          workflow_id: "law-firm.ldd",
          capability_id: "law_firm.ldd_document_batch",
          domain_pack: "law-firm",
          runner_plan_status: "ready",
        },
      ],
    }, null, 2)}\n`, "utf8");
    await writeFile(workPacketsPath, `${JSON.stringify({ work_items: [] }, null, 2)}\n`, "utf8");
    await writeFile(packagePath, `${JSON.stringify({
      scripts: { "workflows:swarm-topology": "node scripts/swarm-topology-contract.mjs" },
    }, null, 2)}\n`, "utf8");

    const result = await buildSwarmTopologyContract({
      workflowRunnerPath,
      workPacketsPath,
      packagePath,
      outDir: path.join(root, "out"),
      runAt: "2026-05-30T00:00:00.000Z",
      write: false,
    });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.topology_count, 1);
    assert.equal(result.swarm_topologies[0].runtime_projection_only, true);
    assert.equal(result.hermes_swarm_command_projections[0].mode, "dry-run");
    assert.equal(result.hermes_swarm_command_projections[0].worker_execution_performed, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
