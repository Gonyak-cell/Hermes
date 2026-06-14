import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ELECTRON_REMOTE_MODULE_ENABLED,
  ELECTRON_WEB_PREFERENCES,
  PERMISSION_REQUESTS_ALLOWED,
  PRELOAD_API_KEYS,
  buildContentSecurityPolicy,
  hasUnsafePreloadApi,
  isAllowedNavigationUrl,
  isAllowedRendererRequestUrl,
} from "../src/main/security-policy.mjs";
import {
  SHELL_SEED_STATE,
  containsForbiddenDesktopTrustCopy,
  unsafeAuthorityFlagCount,
} from "../src/shared/shell-state.mjs";

const PRELOAD_PATH = new URL("../src/preload/index.cjs", import.meta.url);

const DEV_SERVER_URL = "http://127.0.0.1:5173";

test("Electron webPreferences keep the desktop renderer sandboxed and isolated", () => {
  assert.equal(ELECTRON_WEB_PREFERENCES.sandbox, true);
  assert.equal(ELECTRON_WEB_PREFERENCES.contextIsolation, true);
  assert.equal(ELECTRON_WEB_PREFERENCES.webSecurity, true);
  assert.equal(ELECTRON_WEB_PREFERENCES.allowRunningInsecureContent, false);
  assert.equal(ELECTRON_WEB_PREFERENCES.nodeIntegration, false);
  assert.equal(ELECTRON_WEB_PREFERENCES.nodeIntegrationInWorker, false);
  assert.equal(ELECTRON_REMOTE_MODULE_ENABLED, false);
  assert.equal(PERMISSION_REQUESTS_ALLOWED, false);
});

test("preload API exposes read-only methods only", () => {
  assert.deepEqual(PRELOAD_API_KEYS, ["getAppInfo", "getShellState", "getReadModel", "getSourcePreview"]);
  assert.equal(hasUnsafePreloadApi(PRELOAD_API_KEYS), false);
  assert.equal(hasUnsafePreloadApi(["writeArtifact"]), true);
  assert.equal(hasUnsafePreloadApi(["runShellCommand"]), true);
  assert.equal(hasUnsafePreloadApi(["approveRelease"]), true);
});

test("preload implementation does not expose direct runtime or filesystem surfaces", async () => {
  const source = await readFile(PRELOAD_PATH, "utf8");
  assert.match(source, /contextBridge\.exposeInMainWorld\("hermesOperator"/);
  assert.doesNotMatch(source, /node:fs|fs\/promises|require\(["']fs["']\)|require\(["']child_process["']\)|process\.env/i);
  assert.doesNotMatch(source, /desktop:(write|apply|deploy|push|approve|exec|secret)/i);
});

test("renderer network policy allows local app resources and blocks external origins", () => {
  assert.equal(isAllowedRendererRequestUrl("file:///tmp/index.html", { devServerUrl: DEV_SERVER_URL }), true);
  assert.equal(isAllowedRendererRequestUrl("data:image/png;base64,AA==", { devServerUrl: DEV_SERVER_URL }), true);
  assert.equal(isAllowedRendererRequestUrl("http://127.0.0.1:5173/src/renderer/App.jsx", { devServerUrl: DEV_SERVER_URL }), true);
  assert.equal(isAllowedRendererRequestUrl("https://example.com/track", { devServerUrl: DEV_SERVER_URL }), false);
  assert.equal(isAllowedRendererRequestUrl("http://127.0.0.1:9000/other", { devServerUrl: DEV_SERVER_URL }), false);
});

test("navigation policy blocks external navigation", () => {
  assert.equal(isAllowedNavigationUrl("file:///tmp/index.html", { devServerUrl: DEV_SERVER_URL }), true);
  assert.equal(isAllowedNavigationUrl("http://127.0.0.1:5173/", { devServerUrl: DEV_SERVER_URL }), true);
  assert.equal(isAllowedNavigationUrl("https://github.com/Gonyak-cell/Hermes", { devServerUrl: DEV_SERVER_URL }), false);
});

test("content security policy keeps object and external network surfaces closed", () => {
  const policy = buildContentSecurityPolicy({ devServerUrl: DEV_SERVER_URL });
  assert.match(policy, /default-src 'self'/);
  assert.match(policy, /style-src 'self'(?:;|$)/);
  assert.doesNotMatch(policy, /'unsafe-inline'/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /connect-src 'self' http:\/\/127\.0\.0\.1:5173 ws:\/\/127\.0\.0\.1:5173/);
});

test("seed shell state does not open protected desktop authority or trust claims", () => {
  assert.equal(unsafeAuthorityFlagCount(SHELL_SEED_STATE.authority_flags), 0);
  assert.equal(SHELL_SEED_STATE.authority_flags.deployment_allowed_now, false);
  assert.equal(SHELL_SEED_STATE.authority_flags.secret_read_allowed_now, false);
  assert.equal(SHELL_SEED_STATE.authority_flags.desktop_write_authority_enabled, false);
  assert.equal(containsForbiddenDesktopTrustCopy(JSON.stringify(SHELL_SEED_STATE)), false);
});
