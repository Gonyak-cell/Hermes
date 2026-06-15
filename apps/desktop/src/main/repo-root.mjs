import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";

const HERMES_PACKAGE_NAME = "hermes-project-ops-harness";

export function resolveHermesRepoRoot({ appDir, env = process.env } = {}) {
  if (!appDir) throw new Error("appDir is required to resolve the Hermes repo root");
  const defaultRoot = path.resolve(appDir, "../..");
  const envRoot = typeof env.HERMES_REPO_ROOT === "string" ? env.HERMES_REPO_ROOT.trim() : "";

  if (!envRoot) return realpathOrFallback(defaultRoot);

  const candidateRoot = path.resolve(envRoot);
  if (isHermesRepoRoot(candidateRoot)) return realpathOrFallback(candidateRoot);
  return realpathOrFallback(defaultRoot);
}

export function isHermesRepoRoot(rootPath) {
  const realRoot = realpathOrNull(rootPath);
  if (!realRoot) return false;

  const packageJsonPath = path.join(realRoot, "package.json");
  if (!existsSync(packageJsonPath)) return false;
  if (!existsSync(path.join(realRoot, "src", "desktop-read-model.mjs"))) return false;
  if (!existsSync(path.join(realRoot, "apps", "desktop", "package.json"))) return false;

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    return packageJson.name === HERMES_PACKAGE_NAME;
  } catch {
    return false;
  }
}

function realpathOrFallback(rootPath) {
  return realpathOrNull(rootPath) ?? path.resolve(rootPath);
}

function realpathOrNull(rootPath) {
  try {
    return realpathSync(rootPath);
  } catch {
    return null;
  }
}
