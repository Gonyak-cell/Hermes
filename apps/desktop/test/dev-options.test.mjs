import assert from "node:assert/strict";
import net from "node:net";
import test from "node:test";
import {
  DEFAULT_DEV_PORT,
  buildViteArgs,
  findAvailablePort,
  parseDevOptions,
  readPortFlag,
  resolveDevServerOptions,
} from "../scripts/dev-options.mjs";

test("desktop dev options default to localhost 5173 when no override is supplied", () => {
  const options = parseDevOptions({ argv: [], env: {} });

  assert.equal(options.host, "127.0.0.1");
  assert.equal(options.port, DEFAULT_DEV_PORT);
  assert.equal(options.explicitPort, false);
  assert.equal(options.smoke, false);
});

test("desktop dev options accept CLI and env port overrides", () => {
  assert.equal(readPortFlag(["--port", "5174"]), 5174);
  assert.equal(readPortFlag(["--port=5175"]), 5175);
  assert.equal(parseDevOptions({ argv: ["--port", "5176"], env: { DESKTOP_DEV_PORT: "5177" } }).port, 5176);
  assert.equal(parseDevOptions({ argv: [], env: { DESKTOP_DEV_PORT: "5178" } }).port, 5178);
  assert.equal(parseDevOptions({ argv: [], env: { HERMES_DESKTOP_DEV_PORT: "5179" } }).port, 5179);
});

test("desktop dev options reject invalid ports", () => {
  assert.throws(() => parseDevOptions({ argv: ["--port", "abc"], env: {} }), /integer TCP port/);
  assert.throws(() => parseDevOptions({ argv: ["--port", "80"], env: {} }), /between 1024 and 65535/);
  assert.throws(() => parseDevOptions({ argv: ["--port=70000"], env: {} }), /between 1024 and 65535/);
});

test("desktop dev options build strict Vite args for the selected port", () => {
  assert.deepEqual(buildViteArgs({ host: "127.0.0.1", port: 5180 }), [
    "--host",
    "127.0.0.1",
    "--port",
    "5180",
    "--strictPort",
  ]);
});

test("desktop dev options find the next available port when default is occupied", async () => {
  const server = await listenOnEphemeralPort();
  try {
    const occupied = server.address().port;
    const available = await findAvailablePort(occupied, { host: "127.0.0.1", maxAttempts: 5 });

    assert.notEqual(available, occupied);
    assert.equal(available, occupied + 1);
  } finally {
    await closeServer(server);
  }
});

test("desktop dev server resolver falls back only for implicit default ports", async () => {
  const server = await listenOnEphemeralPort();
  try {
    const occupied = server.address().port;
    const implicit = await resolveDevServerOptions({ argv: [], env: { DESKTOP_DEV_PORT: "" } });
    const explicit = await resolveDevServerOptions({ argv: ["--port", String(occupied)], env: {} });

    assert.equal(implicit.explicitPort, false);
    assert.equal(explicit.explicitPort, true);
    assert.equal(explicit.port, occupied);
    assert.equal(explicit.url, `http://127.0.0.1:${occupied}`);
  } finally {
    await closeServer(server);
  }
});

function listenOnEphemeralPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0 }, () => resolve(server));
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
