import { access } from "node:fs/promises";
import path from "node:path";

export const RENDERER_ENTRY_RELATIVE_PATH = "dist/renderer/index.html";
export const MISSING_BUILD_FALLBACK_RELATIVE_PATH = "src/main/build-missing.html";

export async function resolveRendererEntry({ appDir }) {
  const rendererPath = path.join(appDir, RENDERER_ENTRY_RELATIVE_PATH);
  if (await pathExists(rendererPath)) {
    return {
      status: "ready",
      load_path: rendererPath,
      missing_path: null,
      query: undefined,
    };
  }

  return {
    status: "missing_build",
    load_path: path.join(appDir, MISSING_BUILD_FALLBACK_RELATIVE_PATH),
    missing_path: rendererPath,
    query: {
      missing: rendererPath,
      command: "npm run desktop:build",
    },
  };
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
