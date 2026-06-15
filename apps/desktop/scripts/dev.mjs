#!/usr/bin/env node
import http from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildViteArgs, resolveDevServerOptions } from "./dev-options.mjs";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BIN_DIR = path.join(APP_DIR, "node_modules", ".bin");
const VITE_BIN = path.join(BIN_DIR, process.platform === "win32" ? "vite.cmd" : "vite");
const ELECTRON_BIN = path.join(BIN_DIR, process.platform === "win32" ? "electron.cmd" : "electron");
const devServer = await resolveDevServerOptions({ argv: process.argv.slice(2), env: process.env });

if (devServer.smoke) {
  console.log(`Hermes Operator Desktop dev command target: ${devServer.url}`);
  process.exit(0);
}

const vite = spawn(VITE_BIN, buildViteArgs(devServer), {
  cwd: APP_DIR,
  stdio: "inherit",
});

const cleanup = () => {
  if (!vite.killed) vite.kill("SIGTERM");
};

process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(143);
});

try {
  await waitForServer(devServer.url);
  const electron = spawn(ELECTRON_BIN, ["."], {
    cwd: APP_DIR,
    stdio: "inherit",
    env: { ...process.env, VITE_DEV_SERVER_URL: devServer.url },
  });
  electron.on("exit", (code) => {
    cleanup();
    process.exitCode = code ?? 0;
  });
} catch (error) {
  cleanup();
  console.error(error.message);
  process.exitCode = 1;
}

function waitForServer(url, timeoutMs = 30000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });
      request.on("error", () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(tick, 250);
      });
    };
    tick();
  });
}
