import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { deflateSync } from "node:zlib";
import {
  buildAmplitudeUiReferenceAudit,
  runAmplitudeUiReferenceAudit,
} from "../src/amplitude-ui-reference-audit.mjs";

const RUN_AT = "2026-06-13T00:00:00.000Z";

function options(sourceDir, overrides = {}) {
  return {
    runAt: RUN_AT,
    sourceDir,
    write: false,
    fontPaths: fontPathsForFixture(sourceDir),
    expectedScreenshotCount: 3,
    expectedMinIndex: 0,
    expectedMaxIndex: 2,
    ...overrides,
  };
}

test("Amplitude UI reference audit inventories screenshots, crops, tokens, and Hermes mappings", async () => {
  const sourceDir = await createReferenceFixture();

  try {
    const result = await buildAmplitudeUiReferenceAudit(options(sourceDir));

    assert.equal(result.validation.valid, true);
    assert.equal(result.schema_version, "amplitude-ui-reference-audit.v1");
    assert.equal(result.summary.amplitude_ui_reference_status, "ready_for_hermes_ui_execution_package");
    assert.equal(result.summary.screenshot_count, 3);
    assert.equal(result.summary.crop_row_count, 3);
    assert.equal(result.summary.measurement_queue_count, 3);
    assert.equal(result.summary.locale_count, 2);
    assert.equal(result.summary.korean_font_count, 7);
    assert.equal(result.summary.korean_font_available_count, 7);
    assert.equal(result.summary.pixel_measurement_count, 3);
    assert.equal(result.summary.pixel_measurement_complete_count, 3);
    assert.equal(result.pixel_measurement_rows.every((row) => row.exact_pixel_measurement_complete === true), true);
    assert.equal(result.pixel_measurement_summary_rows.some((row) => row.ready_for_token_promotion === true), true);
    assert.equal(result.pixel_measurement_rows[0].derived_metrics.topbar_height_px, 56);
    assert.equal(result.pixel_measurement_rows[0].derived_metrics.left_rail_width_px, 56);
    assert.equal(result.summary.design_token_seed_count, 27);
    assert.equal(result.ui_reference_boundary.literal_clone_allowed, false);
    assert.equal(result.ui_reference_boundary.amplitude_brand_assets_copied, false);
    assert.equal(result.ui_reference_boundary.mobbin_footer_used_as_ui, false);
    assert.equal(result.ui_reference_boundary.locale_switch_ready, true);
    assert.equal(result.ui_reference_boundary.korean_font_manifest_ready, true);
    assert.equal(result.html.includes("data-locale-select"), true);
    assert.equal(result.html.includes("@font-face"), true);
  } finally {
    await rm(sourceDir, { recursive: true, force: true });
  }
});

test("Amplitude UI reference audit requires numeric continuity and 1920x1320 screenshots", async () => {
  const sourceDir = await mkdtemp(path.join(os.tmpdir(), "amplitude-ui-reference-invalid-"));
  await writeFile(path.join(sourceDir, "Amplitude web Feb 2025 0.png"), pngHeader(1920, 1320));
  await writeFile(path.join(sourceDir, "Amplitude web Feb 2025 2.png"), pngHeader(1900, 1320));
  await writeFile(path.join(sourceDir, "showcase-preview.png"), pngHeader(1440, 900));
  await writeFile(path.join(sourceDir, "showcase.html"), "<!doctype html><title>fixture</title>\n", "utf8");

  try {
    const result = await buildAmplitudeUiReferenceAudit(options(sourceDir));
    const errorIds = new Set(result.validation.errors.map((item) => item.item_id));

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.amplitude_ui_reference_status, "blocked_amplitude_ui_reference_audit");
    assert.equal(result.ui_reference_boundary.ready_for_hermes_ui_execution_package, false);
    assert.equal(errorIds.has("screenshots.count"), true);
    assert.equal(errorIds.has("screenshots.range"), true);
    assert.equal(errorIds.has("screenshots.dimensions"), true);
  } finally {
    await rm(sourceDir, { recursive: true, force: true });
  }
});

test("Amplitude UI reference audit --check does not overwrite artifacts", async () => {
  const sourceDir = await createReferenceFixture();
  const outDir = await mkdtemp(path.join(os.tmpdir(), "amplitude-ui-reference-out-"));
  const sentinelPath = path.join(outDir, "amplitude-ui-reference-audit.json");
  const sentinel = "{ \"sentinel\": \"amplitude-ui-reference-audit\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runAmplitudeUiReferenceAudit(options(sourceDir, { outDir, check: true, write: false }));

    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(sourceDir, { recursive: true, force: true });
    await rm(outDir, { recursive: true, force: true });
  }
});

async function createReferenceFixture() {
  const sourceDir = await mkdtemp(path.join(os.tmpdir(), "amplitude-ui-reference-"));
  for (let index = 0; index < 3; index += 1) {
    await writeFile(path.join(sourceDir, `Amplitude web Feb 2025 ${index}.png`), pngRgba(1920, 1320, true));
  }
  await writeFile(path.join(sourceDir, "showcase-preview.png"), pngRgba(1440, 900, false));
  await writeFile(path.join(sourceDir, "showcase.html"), "<!doctype html><title>fixture</title>\n", "utf8");
  for (const fontPath of Object.values(fontPathsForFixture(sourceDir))) {
    await writeFile(fontPath, "fixture-font\n", "utf8");
  }
  return sourceDir;
}

function fontPathsForFixture(sourceDir) {
  return {
    "ko.body.regular": path.join(sourceDir, "Pretendard-Regular.otf"),
    "ko.body.medium": path.join(sourceDir, "Pretendard-Medium.otf"),
    "ko.body.semibold": path.join(sourceDir, "Pretendard-SemiBold.otf"),
    "ko.body.bold": path.join(sourceDir, "Pretendard-Bold.otf"),
    "ko.heading.regular": path.join(sourceDir, "SUITE-Regular.otf"),
    "ko.heading.medium": path.join(sourceDir, "SUITE-Medium.otf"),
    "ko.heading.bold": path.join(sourceDir, "SUITE-Bold.otf"),
  };
}

function pngHeader(width, height) {
  const buffer = Buffer.alloc(24);
  Buffer.from("89504e470d0a1a0a", "hex").copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function pngRgba(width, height, drawUiLines) {
  const bytesPerPixel = 4;
  const rowLength = 1 + width * bytesPerPixel;
  const raw = Buffer.alloc(rowLength * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * rowLength;
    raw[rowOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = rowOffset + 1 + x * bytesPerPixel;
      const isLine = drawUiLines && (
        x === 56
        || x === 304
        || x === 1560
        || y === 56
        || y === 300
        || y === 344
        || y === 388
        || y === 432
      );
      const value = isLine ? 16 : 248;
      raw[offset] = value;
      raw[offset + 1] = value;
      raw[offset + 2] = value;
      raw[offset + 3] = 255;
    }
  }
  const chunks = [
    pngChunk("IHDR", ihdr(width, height)),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ];
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), ...chunks]);
}

function ihdr(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data.writeUInt8(8, 8);
  data.writeUInt8(6, 9);
  data.writeUInt8(0, 10);
  data.writeUInt8(0, 11);
  data.writeUInt8(0, 12);
  return data;
}

function pngChunk(type, data) {
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, "ascii");
  data.copy(chunk, 8);
  chunk.writeUInt32BE(0, 8 + data.length);
  return chunk;
}
