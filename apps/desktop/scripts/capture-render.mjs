#!/usr/bin/env node
import { app, BrowserWindow, ipcMain, session } from "electron";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { APP_TITLE, SHELL_SEED_STATE } from "../src/shared/shell-state.mjs";
import {
  ELECTRON_WEB_PREFERENCES,
  buildContentSecurityPolicy,
  isAllowedNavigationUrl,
  isAllowedRendererRequestUrl,
} from "../src/main/security-policy.mjs";
import { loadDesktopReadModel } from "../src/main/read-model.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, "..");
const REPO_ROOT = process.env.HERMES_REPO_ROOT ?? path.resolve(APP_DIR, "../..");
const outputArg = process.argv.find((arg) => arg.startsWith("--out="));
const outPath = outputArg?.slice("--out=".length) ?? path.join(REPO_ROOT, "tmp", "desktop-render-smoke.png");
const rendererPath = path.join(APP_DIR, "dist", "renderer", "index.html");
const width = readPositiveIntArg("--width=", 1440);
const height = readPositiveIntArg("--height=", 900);

app.disableHardwareAcceleration();
app.setName(`${APP_TITLE} Smoke`);

ipcMain.handle("desktop:get-app-info", () => ({
  title: APP_TITLE,
  repo_root: REPO_ROOT,
  dev_mode: false,
}));
ipcMain.handle("desktop:get-shell-state", () => SHELL_SEED_STATE);
ipcMain.handle("desktop:get-read-model", async () => loadDesktopReadModel({ repoRoot: REPO_ROOT }));

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

  await window.loadFile(rendererPath);
  await waitForRenderer(window);
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

function waitForRenderer(window) {
  return window.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        const text = document.body?.innerText ?? "";
        if (text.includes("Hermes Operator Desktop")) {
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
