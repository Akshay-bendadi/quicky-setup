import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npmExecPath = process.env.npm_execpath;

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.signal) {
    console.error(`${command} was terminated by ${result.signal}.`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!npmExecPath) {
  console.error("npm_execpath is missing. Run publish commands through npm.");
  process.exit(1);
}

run(process.execPath, [path.join(repoRoot, "scripts", "guard-publish-ci.mjs")]);
run(process.execPath, [npmExecPath, "run", "check"]);
run(process.execPath, [npmExecPath, "run", "pack:dry-run"]);
