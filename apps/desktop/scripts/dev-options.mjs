import net from "node:net";

export const DEFAULT_DEV_HOST = "127.0.0.1";
export const DEFAULT_DEV_PORT = 5173;
export const DEV_PORT_ENV_KEYS = ["DESKTOP_DEV_PORT", "HERMES_DESKTOP_DEV_PORT"];

export function parseDevOptions({ argv = [], env = {} } = {}) {
  const cliPort = readPortFlag(argv);
  const envPort = readPortEnv(env);
  const port = cliPort ?? envPort ?? DEFAULT_DEV_PORT;
  assertValidPort(port);
  return {
    host: DEFAULT_DEV_HOST,
    port,
    explicitPort: cliPort !== null || envPort !== null,
    smoke: argv.includes("--smoke"),
  };
}

export async function resolveDevServerOptions({ argv = [], env = {} } = {}) {
  const options = parseDevOptions({ argv, env });
  if (options.explicitPort) return withUrl(options);

  const port = await findAvailablePort(options.port, { host: options.host });
  return withUrl({ ...options, port });
}

export function buildViteArgs({ host, port }) {
  return ["--host", host, "--port", String(port), "--strictPort"];
}

export function withUrl(options) {
  return {
    ...options,
    url: `http://${options.host}:${options.port}`,
  };
}

export async function findAvailablePort(startPort, { host = DEFAULT_DEV_HOST, maxAttempts = 50 } = {}) {
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const port = startPort + offset;
    if (await isPortAvailable(port, { host })) return port;
  }
  throw new Error(`No available desktop dev port found from ${startPort} to ${startPort + maxAttempts - 1}.`);
}

export function readPortFlag(argv = []) {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--port" || arg === "-p") return parsePortValue(argv[index + 1], arg);
    if (arg.startsWith("--port=")) return parsePortValue(arg.slice("--port=".length), "--port");
  }
  return null;
}

export function readPortEnv(env = {}) {
  for (const key of DEV_PORT_ENV_KEYS) {
    if (env[key] !== undefined && env[key] !== "") return parsePortValue(env[key], key);
  }
  return null;
}

function parsePortValue(value, source) {
  const port = Number(value);
  if (!Number.isInteger(port)) throw new Error(`${source} must be an integer TCP port.`);
  assertValidPort(port, source);
  return port;
}

function assertValidPort(port, source = "desktop dev port") {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error(`${source} must be an integer between 1024 and 65535.`);
  }
}

function isPortAvailable(port, { host }) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen({ host, port }, () => {
      server.close(() => resolve(true));
    });
  });
}
