#!/usr/bin/env node
import { app, BrowserWindow, ipcMain, session } from "electron";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { APP_TITLE, SHELL_SEED_STATE, findForbiddenDesktopTrustCopy } from "../src/shared/shell-state.mjs";
import {
  ELECTRON_WEB_PREFERENCES,
  buildContentSecurityPolicy,
  isAllowedNavigationUrl,
  isAllowedRendererRequestUrl,
} from "../src/main/security-policy.mjs";
import { loadDesktopReadModel, loadDesktopSourcePreview } from "../src/main/read-model.mjs";
import { resolveHermesRepoRoot } from "../src/main/repo-root.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, "..");
const REPO_ROOT = resolveHermesRepoRoot({ appDir: APP_DIR });
const outPath = resolveRepoPath(readStringArg("--out=", "tmp/desktop-render-smoke.png"));
const rendererPath = path.join(APP_DIR, "dist", "renderer", "index.html");
const width = readPositiveIntArg("--width=", 1440);
const height = readPositiveIntArg("--height=", 900);
const screen = readStringArg("--screen=", "queue");
const previewPath = readStringArg("--preview=", "");
const textOutPath = resolveOptionalRepoPath(readStringArg("--text-out=", ""));
const assertNoForbiddenTrustCopy = process.argv.includes("--assert-no-forbidden-trust-copy");

app.disableHardwareAcceleration();
app.setName(`${APP_TITLE} Smoke`);

ipcMain.handle("desktop:get-app-info", () => ({
  title: APP_TITLE,
  repo_root: REPO_ROOT,
  dev_mode: false,
}));
ipcMain.handle("desktop:get-shell-state", () => SHELL_SEED_STATE);
ipcMain.handle("desktop:get-read-model", async () => loadDesktopReadModel({ repoRoot: REPO_ROOT }));
ipcMain.handle("desktop:get-source-preview", async (_event, sourcePath) => loadDesktopSourcePreview({ repoRoot: REPO_ROOT, sourcePath }));

app.whenReady().then(async () => {
  installSessionGuards();
  const window = new BrowserWindow({
    title: APP_TITLE,
    width,
    height,
    show: true,
    backgroundColor: "#f6f7f9",
    webPreferences: {
      ...ELECTRON_WEB_PREFERENCES,
      preload: path.join(APP_DIR, "src", "preload", "index.cjs"),
    },
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedNavigationUrl(url)) event.preventDefault();
  });

  await window.loadFile(rendererPath, { query: { screen } });
  await waitForRenderer(window, screen);
  if (previewPath) await openPreview(window, previewPath);
  const renderText = await readRendererText(window);
  const forbiddenMatches = findForbiddenDesktopTrustCopy(renderText);
  if (textOutPath) {
    await writeRenderTextReport({
      screen,
      previewPath,
      renderText,
      forbiddenMatches,
      assertedNoForbiddenTrustCopy: assertNoForbiddenTrustCopy,
    });
  }
  if (assertNoForbiddenTrustCopy && forbiddenMatches.length > 0) {
    throw new Error(`Forbidden desktop trust copy found: ${forbiddenMatches.join(", ")}`);
  }
  const image = await window.capturePage();
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, image.toPNG());
  console.log(`Hermes Operator Desktop screenshot written to ${outPath}`);
  window.destroy();
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});

function installSessionGuards() {
  const policy = buildContentSecurityPolicy();
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !isAllowedRendererRequestUrl(details.url) });
  });
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [policy],
      },
    });
  });
}

function readPositiveIntArg(prefix, fallback) {
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readStringArg(prefix, fallback) {
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function resolveRepoPath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(REPO_ROOT, filePath);
}

function resolveOptionalRepoPath(filePath) {
  return filePath ? resolveRepoPath(filePath) : "";
}

function readRendererText(window) {
  return window.webContents.executeJavaScript("document.body?.innerText ?? ''");
}

function waitForRenderer(window, targetScreen) {
  const targetText = targetScreen === "factory"
    ? "Factory gate readiness"
    : targetScreen === "agents"
      ? "Agent Bridge"
    : targetScreen === "queue"
      ? "Hermes Harness"
      : targetScreen === "projects"
        ? "Hermes Harness"
        : ["governance", "reviews", "gates", "evidence", "sources"].includes(targetScreen)
          ? "Project control"
          : "Candidate commit";
  return window.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const started = Date.now();
      const targetText = ${JSON.stringify(targetText)};
      const tick = () => {
        const text = document.body?.innerText ?? "";
        if (text.includes("Hermes Operator Desktop") && text.includes(targetText)) {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve(text.length)));
          return;
        }
        if (Date.now() - started > 5000) {
          reject(new Error("Timed out waiting for Hermes Operator Desktop renderer text"));
          return;
        }
        setTimeout(tick, 100);
      };
      tick();
    })
  `);
}

function openPreview(window, sourcePath) {
  return window.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const sourcePath = ${JSON.stringify(sourcePath)};
      const button = [...document.querySelectorAll(".path-button")]
        .find((candidate) => candidate.textContent.includes(sourcePath));
      if (!button) {
        reject(new Error("Preview source button not found: " + sourcePath));
        return;
      }
      button.click();
      const started = Date.now();
      const tick = () => {
        const text = document.body?.innerText ?? "";
        if (text.includes(sourcePath) && text.includes("redacted")) {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve(text.length)));
          return;
        }
        if (Date.now() - started > 5000) {
          reject(new Error("Timed out waiting for source preview: " + sourcePath));
          return;
        }
        setTimeout(tick, 100);
      };
      tick();
    })
  `);
}

async function writeRenderTextReport({ screen, previewPath, renderText, forbiddenMatches, assertedNoForbiddenTrustCopy }) {
  await mkdir(path.dirname(textOutPath), { recursive: true });
  await writeFile(textOutPath, `${JSON.stringify({
    schema_version: "desktop-render-smoke-report.v1",
    generated_at: new Date().toISOString(),
    screen,
    preview_path: previewPath || null,
    render_text_length: renderText.length,
    forbidden_trust_copy_matches: forbiddenMatches,
    asserted_no_forbidden_trust_copy: assertedNoForbiddenTrustCopy,
  }, null, 2)}\n`);
}
