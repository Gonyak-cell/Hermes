import { spawn } from "node:child_process";
import { mkdir, access, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_PROTECTED_PATHS = [".env", "infra/**", "migrations/**", "**/*secret*", "**/*credential*"];

export async function prepareAgentWorkspace(options = {}) {
  const repoPath = path.resolve(options.repoPath ?? process.cwd());
  const projectId = options.projectId ?? "project";
  const taskId = options.taskId ?? "task";
  const branchName = options.branchName ?? `codex/${slug(taskId)}-${slug(projectId)}`;
  const outDir = path.resolve(options.outDir ?? "artifacts/worktree-manager/latest");
  const worktreeRoot = path.resolve(options.worktreeRoot ?? path.join(outDir, "worktrees"));
  const fallbackWorkspacePath = path.resolve(options.workspaceFallbackPath ?? path.join(outDir, "workspace"));
  const protectedPaths = options.protectedPaths ?? DEFAULT_PROTECTED_PATHS;
  const create = options.create ?? true;
  const commandLog = [];
  const repoInfo = await inspectGitRepository(repoPath, commandLog);

  if (!repoInfo.is_git_repo) {
    return createFallbackManifest({
      repoPath,
      branchName,
      fallbackWorkspacePath,
      protectedPaths,
      fallbackReason: repoInfo.reason,
      commandLog,
      create,
    });
  }

  if (!repoInfo.head_sha) {
    return createFallbackManifest({
      repoPath,
      repoRoot: repoInfo.repo_root,
      branchName,
      fallbackWorkspacePath,
      protectedPaths,
      fallbackReason: "git repository has no HEAD commit",
      commandLog,
      create,
    });
  }

  const workspacePath = path.resolve(options.workspacePath ?? path.join(worktreeRoot, branchName.replace(/[/:]/g, "-")));
  const manifestBase = {
    schema_version: "worktree-manager.v1",
    requested_isolation: "git_worktree",
    actual_isolation: "git_worktree",
    repo_path: repoPath,
    repo_root: repoInfo.repo_root,
    branch_name: branchName,
    base_ref: options.baseRef ?? "HEAD",
    base_sha: repoInfo.head_sha,
    workspace_path: workspacePath,
    created: false,
    reused_existing_path: false,
    fallback_reason: null,
    dirty_checkout: repoInfo.dirty_files.length > 0,
    dirty_files: repoInfo.dirty_files,
    protected_paths: protectedPaths,
    command_log: commandLog,
  };

  if (await pathExists(workspacePath)) {
    return {
      ...manifestBase,
      reused_existing_path: true,
      notes: ["workspace path already exists; no git command was run"],
    };
  }

  if (!create) {
    return {
      ...manifestBase,
      notes: ["plan only; worktree was not created"],
    };
  }

  await mkdir(path.dirname(workspacePath), { recursive: true });
  const branchExists = await gitBranchExists(repoInfo.repo_root, branchName, commandLog);
  const args = branchExists
    ? ["worktree", "add", workspacePath, branchName]
    : ["worktree", "add", "-b", branchName, workspacePath, options.baseRef ?? "HEAD"];
  const addResult = await runGit(repoInfo.repo_root, args, commandLog);

  if (addResult.exit_code !== 0) {
    return createFallbackManifest({
      repoPath,
      repoRoot: repoInfo.repo_root,
      branchName,
      fallbackWorkspacePath,
      protectedPaths,
      fallbackReason: `git worktree add failed: ${addResult.stderr || addResult.stdout || "unknown error"}`,
      commandLog,
      create,
      dirtyFiles: repoInfo.dirty_files,
      baseSha: repoInfo.head_sha,
    });
  }

  return {
    ...manifestBase,
    created: true,
    branch_preexisted: branchExists,
    notes: ["git worktree created"],
  };
}

export async function writeWorkspaceManifest(manifest, outDir) {
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "workspace-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export async function runWorktreeManagerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const manifest = await prepareAgentWorkspace({
    repoPath: args.repoPath,
    outDir: args.outDir,
    worktreeRoot: args.worktreeRoot,
    workspacePath: args.workspacePath,
    workspaceFallbackPath: args.workspaceFallbackPath,
    projectId: args.projectId,
    taskId: args.taskId,
    branchName: args.branchName,
    create: !args.planOnly,
  });
  await writeWorkspaceManifest(manifest, args.outDir);

  console.log(`Workspace manifest written to ${path.resolve(args.outDir, "workspace-manifest.json")}`);
  console.log(`Isolation: ${manifest.actual_isolation}`);
  console.log(`Workspace: ${manifest.workspace_path}`);
  if (manifest.fallback_reason) console.log(`Fallback: ${manifest.fallback_reason}`);
}

async function inspectGitRepository(repoPath, commandLog) {
  const topLevel = await runGit(repoPath, ["rev-parse", "--show-toplevel"], commandLog);
  if (topLevel.exit_code !== 0) {
    return {
      is_git_repo: false,
      reason: "source repository is not a git repository",
    };
  }

  const repoRoot = topLevel.stdout.trim();
  const head = await runGit(repoRoot, ["rev-parse", "HEAD"], commandLog);
  const status = await runGit(repoRoot, ["status", "--porcelain=v1"], commandLog);
  return {
    is_git_repo: true,
    repo_root: repoRoot,
    head_sha: head.exit_code === 0 ? head.stdout.trim() : null,
    dirty_files: status.exit_code === 0 ? status.stdout.split("\n").filter(Boolean) : [],
  };
}

async function gitBranchExists(repoRoot, branchName, commandLog) {
  const result = await runGit(repoRoot, ["rev-parse", "--verify", "--quiet", `refs/heads/${branchName}`], commandLog);
  return result.exit_code === 0;
}

async function createFallbackManifest({
  repoPath,
  repoRoot = null,
  branchName,
  fallbackWorkspacePath,
  protectedPaths,
  fallbackReason,
  commandLog,
  create,
  dirtyFiles = [],
  baseSha = null,
}) {
  if (create) await mkdir(fallbackWorkspacePath, { recursive: true });
  return {
    schema_version: "worktree-manager.v1",
    requested_isolation: "git_worktree",
    actual_isolation: "isolated_workspace",
    repo_path: repoPath,
    repo_root: repoRoot,
    branch_name: branchName,
    base_ref: "HEAD",
    base_sha: baseSha,
    workspace_path: fallbackWorkspacePath,
    created: create,
    reused_existing_path: false,
    fallback_reason: fallbackReason,
    dirty_checkout: dirtyFiles.length > 0,
    dirty_files: dirtyFiles,
    protected_paths: protectedPaths,
    command_log: commandLog,
    notes: ["fallback workspace is not a git worktree"],
  };
}

function runGit(cwd, args, commandLog) {
  return new Promise((resolve) => {
    const child = spawn("git", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", (code) => {
      const result = {
        command: ["git", ...args].join(" "),
        cwd,
        exit_code: code ?? 1,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      };
      commandLog.push(result);
      resolve(result);
    });
    child.on("error", (error) => {
      const result = {
        command: ["git", ...args].join(" "),
        cwd,
        exit_code: 127,
        stdout: "",
        stderr: String(error.message ?? error),
      };
      commandLog.push(result);
      resolve(result);
    });
  });
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseArgs(argv) {
  const parsed = {
    repoPath: process.cwd(),
    outDir: "artifacts/worktree-manager/latest",
    projectId: "HERMES-HARNESS",
    taskId: "TASK",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--repo") parsed.repoPath = argv[++index];
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--worktree-root") parsed.worktreeRoot = argv[++index];
    else if (arg === "--workspace") parsed.workspacePath = argv[++index];
    else if (arg === "--fallback-workspace") parsed.workspaceFallbackPath = argv[++index];
    else if (arg === "--project-id") parsed.projectId = argv[++index];
    else if (arg === "--task-id") parsed.taskId = argv[++index];
    else if (arg === "--branch") parsed.branchName = argv[++index];
    else if (arg === "--plan-only") parsed.planOnly = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/worktree-manager.mjs [options]

Options:
  --repo <path>                 Source repository path. Defaults to cwd.
  --out-dir <path>              Directory for workspace-manifest.json.
  --worktree-root <path>        Parent directory for git worktrees.
  --workspace <path>            Explicit git worktree path.
  --fallback-workspace <path>   Explicit isolated fallback workspace path.
  --project-id <id>             Project ID used in default branch naming.
  --task-id <id>                Task ID used in default branch naming.
  --branch <name>               Branch name to create or reuse.
  --plan-only                   Do not create a worktree or fallback directory.
  -h, --help                    Show this help.
`);
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
