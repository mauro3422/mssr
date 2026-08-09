#!/usr/bin/env node
// Portable npm script launcher: invokes a Python script with the interpreter
// that exists on the host platform. npm scripts must run on Windows with
// `python` and on Unix with `python3` only.
//
// Usage: node scripts/run-python.mjs <script.py> [args...]

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const script = process.argv[2];
const args = process.argv.slice(3);

if (!script) {
  console.error("usage: node scripts/run-python.mjs <script.py> [args...]");
  process.exit(2);
}

const target = isAbsolute(script) ? script : join(here, script);
const configured = process.env.MSSR_PYTHON?.trim();
const candidates = configured
  ? [{ command: configured, prefix: [] }]
  : process.platform === "win32"
    ? [{ command: "python", prefix: [] }, { command: "py", prefix: ["-3"] }]
    : [{ command: "python3", prefix: [] }, { command: "python", prefix: [] }];

function launch(index) {
  const candidate = candidates[index];
  if (!candidate) {
    console.error("Failed to find a usable Python 3 interpreter.");
    process.exit(1);
  }
  const child = spawn(candidate.command, [...candidate.prefix, target, ...args], { stdio: "inherit", shell: false });
  let failedToSpawn = false;
  child.once("error", (error) => {
    failedToSpawn = true;
    if (error.code === "ENOENT" && !configured) launch(index + 1);
    else {
      console.error(`Failed to run the configured Python interpreter: ${error.message}`);
      process.exit(1);
    }
  });
  child.once("exit", (code) => {
    if (!failedToSpawn) process.exit(code ?? 1);
  });
}

launch(0);
