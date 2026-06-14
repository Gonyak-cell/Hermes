import { app, BrowserWindow, ipcMain, session } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { APP_TITLE, SHELL_SEED_STATE } from "../shared/shell-state.mjs";
import {
  ELECTRON_WEB_PREFERENCES,
  buildContentSecurityPolicy,
  isAllowedNavigationUrl,
  isAllowedRendererRequestUrl,
} from "./security-policy.mjs";
import { loadDesktopReadModel, loadDesktopSourcePreview } from "./read-model.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, "../..");
const REPO_ROOT = process.env.HERMES_REPO_ROOT ?? path.resolve(APP_DIR, "../..");
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL ?? null;

app.setName(APP_TITLE);

ipcMain.handle("desktop:get-app-info", () => ({
  title: APP_TITLE,
  repo_root: REPO_ROOT,
  dev_mode: Boolean(DEV_SERVER_URL),
}));

ipcMain.handle("desktop:get-shell-state", () => SHELL_SEED_STATE);
ipcMain.handle("desktop:get-read-model", async () => loadDesktopReadModel({ repoRoot: REPO_ROOT }));
ipcMain.handle("desktop:get-source-preview", async (_event, sourcePath) => loadDesktopSourcePreview({ repoRoot: REPO_ROOT, sourcePath }));

app.whenReady().then(async () => {
  installSessionGuards();
  const window = createWindow();
  if (DEV_SERVER_URL) {
    await window.loadURL(DEV_SERVER_URL);
  } else {
    await window.loadFile(path.join(APP_DIR, "dist", "renderer", "index.html"));
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

function createWindow() {
  const window = new BrowserWindow({
    title: APP_TITLE,
    width: 1440,
    height: 900,
    minWidth: 390,
    minHeight: 720,
    backgroundColor: "#f6f7f9",
    show: false,
    webPreferences: {
      ...ELECTRON_WEB_PREFERENCES,
      preload: path.join(__dirname, "..", "preload", "index.cjs"),
    },
  });

  window.once("ready-to-show", () => window.show());
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedNavigationUrl(url, { devServerUrl: DEV_SERVER_URL })) event.preventDefault();
  });
  return window;
}

function installSessionGuards() {
  const policy = buildContentSecurityPolicy({ devServerUrl: DEV_SERVER_URL });
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !isAllowedRendererRequestUrl(details.url, { devServerUrl: DEV_SERVER_URL }) });
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
