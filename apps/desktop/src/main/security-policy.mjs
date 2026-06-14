export const ELECTRON_WEB_PREFERENCES = Object.freeze({
  sandbox: true,
  contextIsolation: true,
  webSecurity: true,
  allowRunningInsecureContent: false,
  nodeIntegration: false,
  nodeIntegrationInWorker: false,
});

export const ELECTRON_REMOTE_MODULE_ENABLED = false;
export const PERMISSION_REQUESTS_ALLOWED = false;

export const PRELOAD_API_KEYS = Object.freeze([
  "getAppInfo",
  "getShellState",
  "getReadModel",
  "getSourcePreview",
]);

export function buildContentSecurityPolicy({ devServerUrl = null } = {}) {
  const connectSources = ["'self'"];
  if (devServerUrl) {
    const parsed = new URL(devServerUrl);
    connectSources.push(`${parsed.protocol}//${parsed.host}`);
    connectSources.push(`ws://${parsed.host}`);
  }
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    `connect-src ${connectSources.join(" ")}`,
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function isAllowedRendererRequestUrl(rawUrl, { devServerUrl = null } = {}) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (["file:", "data:", "devtools:"].includes(url.protocol)) return true;
  if (devServerUrl && sameOrigin(url, new URL(devServerUrl))) return true;
  return false;
}

export function isAllowedNavigationUrl(rawUrl, { devServerUrl = null } = {}) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol === "file:") return true;
  if (devServerUrl && sameOrigin(url, new URL(devServerUrl))) return true;
  return false;
}

export function hasUnsafePreloadApi(keys = PRELOAD_API_KEYS) {
  const unsafePatterns = [
    /write/i,
    /apply/i,
    /deploy/i,
    /exec/i,
    /run.*shell/i,
    /shell.*exec/i,
    /secret/i,
    /push/i,
    /approve/i,
  ];
  return keys.some((key) => unsafePatterns.some((pattern) => pattern.test(key)));
}

function sameOrigin(left, right) {
  return left.protocol === right.protocol && left.hostname === right.hostname && left.port === right.port;
}
