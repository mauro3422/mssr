import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

export const MSSR_RELEASE_RECEIPT_SCHEMA_VERSION = "mssr-release-receipt-v1";
const FINAL_IMPACT_STATUSES = new Set(["updated", "reviewed-none"]);

function requiredBullet(markdown, key) {
  const match = markdown.match(new RegExp(`^[-*]\\s+${key}\\s*:\\s*(.+?)\\s*$`, "im"));
  if (!match) throw new Error(`Missing changelog contract field '${key}'.`);
  return match[1].trim();
}

export function parseReleaseGateChangelog(markdown) {
  const heading = markdown.match(/^#\s+(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)\s+[—-]\s+(\d{4}-\d{2}-\d{2})\s*$/m);
  if (!heading) throw new Error("Version changelog must begin with '# X.Y.Z — YYYY-MM-DD'.");
  const impact = {
    context: requiredBullet(markdown, "PROJECT_CONTEXT"),
    memory: requiredBullet(markdown, "PROJECT_MEMORY"),
    state: requiredBullet(markdown, "PROJECT_STATE"),
  };
  for (const [kind, status] of Object.entries(impact)) {
    if (!FINAL_IMPACT_STATUSES.has(status)) {
      throw new Error(`PROJECT_${kind.toUpperCase()} must be explicitly reviewed before release:gate; received '${status}'.`);
    }
  }
  return {
    version: heading[1],
    date: heading[2],
    summary: requiredBullet(markdown, "Summary"),
    areas: requiredBullet(markdown, "Areas"),
    knowledgeImpact: impact,
  };
}

function parsePackStdout(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`npm pack did not return valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!Array.isArray(parsed) || parsed.length !== 1 || !parsed[0] || typeof parsed[0] !== "object") {
    throw new Error("npm pack must return exactly one package result.");
  }
  return parsed[0];
}

function boundedCommandEvidence(result, command) {
  if (!result || typeof result !== "object") throw new Error(`${command} returned no execution result.`);
  const exitCode = Number(result.exitCode ?? result.code ?? 0);
  if (!Number.isInteger(exitCode)) throw new Error(`${command} returned an invalid exit code.`);
  if (exitCode !== 0) throw new Error(`${command} failed with exit code ${exitCode}.`);
  return { command, status: "pass", exitCode };
}

function releaseAlias(version, sha256) {
  return `pkg:${version}#${sha256.slice(0, 8)}`;
}

async function sha256File(filePath) {
  const bytes = await fs.readFile(filePath);
  return {
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

async function writeJsonAtomic(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const content = `${JSON.stringify(value, null, 2)}\n`;
  await fs.writeFile(tempPath, content, "utf8");
  await fs.rename(tempPath, filePath);
  const readback = JSON.parse(await fs.readFile(filePath, "utf8"));
  if (JSON.stringify(readback) !== JSON.stringify(value)) {
    throw new Error(`Release receipt readback mismatch: ${filePath}`);
  }
}

export async function defaultReleaseGateCommand(command, args, options = {}) {
  let executable = command;
  let executableArgs = args;
  if (process.platform === "win32") {
    const commandKey = [command, ...args].join(" ");
    const fixedCommand = commandKey === "npm run verify"
      ? "npm run verify"
      : commandKey === "npm pack --json"
        ? "npm pack --json"
        : null;
    if (!fixedCommand) {
      throw new Error(`Windows release:gate runner only supports fixed internal npm commands; received '${commandKey}'.`);
    }
    executable = process.env.ComSpec || "cmd.exe";
    executableArgs = ["/d", "/s", "/c", fixedCommand];
  }
  const result = await execFile(executable, executableArgs, {
    cwd: options.cwd,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  return { exitCode: 0, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

export async function runReleaseGate(options = {}) {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const runCommand = options.runCommand ?? defaultReleaseGateCommand;
  const observedAt = (options.now ?? (() => new Date()))().toISOString();

  const packagePath = path.join(projectRoot, "package.json");
  const packageJson = JSON.parse(await fs.readFile(packagePath, "utf8"));
  const packageName = packageJson?.name;
  const version = packageJson?.version;
  if (typeof packageName !== "string" || packageName.length === 0) throw new Error("package.json is missing package name.");
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error("package.json has an invalid release version.");
  }

  const changelogRelative = `changelogs/${version}.md`;
  const changelog = parseReleaseGateChangelog(await fs.readFile(path.join(projectRoot, changelogRelative), "utf8"));
  if (changelog.version !== version) throw new Error(`Package version ${version} does not match changelog ${changelog.version}.`);

  const [indexText, rootChangelog] = await Promise.all([
    fs.readFile(path.join(projectRoot, "changelogs", "INDEX.md"), "utf8"),
    fs.readFile(path.join(projectRoot, "CHANGELOG.md"), "utf8"),
  ]);
  if (!indexText.includes(`[${version}](${version}.md)`)) throw new Error(`changelogs/INDEX.md does not reference ${version}.`);
  if (!rootChangelog.includes(`[${version}](changelogs/${version}.md)`)) throw new Error(`CHANGELOG.md does not identify ${version} as the current release.`);

  const npmCommand = "npm";
  const verifyResult = await runCommand(npmCommand, ["run", "verify"], { cwd: projectRoot, phase: "verify" });
  const verify = boundedCommandEvidence(verifyResult, "npm run verify");

  const packResult = await runCommand(npmCommand, ["pack", "--json"], { cwd: projectRoot, phase: "pack" });
  boundedCommandEvidence(packResult, "npm pack --json");
  const packed = parsePackStdout(packResult.stdout ?? "");
  if (packed.name !== packageName || packed.version !== version) {
    throw new Error(`npm pack identity mismatch: expected ${packageName}@${version}, received ${packed.name}@${packed.version}.`);
  }
  if (typeof packed.filename !== "string" || packed.filename.length === 0 || path.basename(packed.filename) !== packed.filename) {
    throw new Error("npm pack returned an unsafe or missing artifact filename.");
  }

  const artifactPath = path.join(projectRoot, packed.filename);
  const artifact = await sha256File(artifactPath);
  if (Number.isFinite(packed.size) && Number(packed.size) !== artifact.bytes) {
    throw new Error(`npm pack size/readback mismatch: metadata ${packed.size}, file ${artifact.bytes}.`);
  }

  const alias = releaseAlias(version, artifact.sha256);
  const receipt = {
    schemaVersion: MSSR_RELEASE_RECEIPT_SCHEMA_VERSION,
    package: { name: packageName, version },
    changelog: {
      path: changelogRelative,
      date: changelog.date,
      knowledgeImpact: changelog.knowledgeImpact,
    },
    verification: verify,
    artifact: {
      filename: packed.filename,
      bytes: artifact.bytes,
      sha256: artifact.sha256,
      ...(typeof packed.shasum === "string" ? { npmShasum: packed.shasum } : {}),
      ...(typeof packed.integrity === "string" ? { npmIntegrity: packed.integrity } : {}),
    },
    alias,
    observedAt,
    advisoryOnly: true,
  };

  const receiptRelative = `.mssr/runtime/releases/${version}.json`;
  const receiptPath = path.join(projectRoot, ...receiptRelative.split("/"));
  await writeJsonAtomic(receiptPath, receipt);

  return { receipt, receiptPath, receiptRelative };
}

function isDirectRun() {
  if (!process.argv[1]) return false;
  return path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
}

if (isDirectRun()) {
  try {
    const result = await runReleaseGate();
    process.stdout.write(`${JSON.stringify({ ok: true, ...result.receipt, receiptPath: result.receiptRelative }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`release:gate failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
