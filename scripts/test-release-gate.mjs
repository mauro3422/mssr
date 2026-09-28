import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import Ajv2020 from "ajv/dist/2020.js";
import { defaultReleaseGateCommand, materializeCanonicalPackageFiles, runReleaseGate } from "./release-gate.mjs";

const execFile = promisify(execFileCallback);

async function makeFixture({ impactState = "updated", rootCurrent = true, indexCurrent = true } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-release-gate-"));
  const version = "1.2.3";
  await execFile("git", ["init", "-q"], { cwd: root, windowsHide: true });
  await fs.mkdir(path.join(root, "changelogs"), { recursive: true });
  await fs.mkdir(path.join(root, ".mssr"), { recursive: true });
  await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ name: "@fixture/pkg", version }, null, 2));
  await fs.writeFile(path.join(root, "changelogs", `${version}.md`), [
    `# ${version} — 2026-08-18`,
    "",
    "- Summary: Fixture release.",
    "- Areas: release, testing",
    "- PROJECT_CONTEXT: reviewed-none",
    "- PROJECT_MEMORY: updated",
    `- PROJECT_STATE: ${impactState}`,
    "",
  ].join("\n"));
  await fs.writeFile(path.join(root, "changelogs", "INDEX.md"), indexCurrent ? `- [${version}](${version}.md)\n` : "- [1.2.2](1.2.2.md)\n");
  await fs.writeFile(path.join(root, "CHANGELOG.md"), rootCurrent ? `- Current release: [${version}](changelogs/${version}.md)\n` : "- Current release: [1.2.2](changelogs/1.2.2.md)\n");
  await fs.writeFile(path.join(root, ".mssr", "PROJECT_STATE.md"), "ORIGINAL STATE\n");
  return { root, version };
}

function fakeRunner(root, calls, options = {}) {
  return async (_command, args, meta) => {
    calls.push({ args: [...args], phase: meta.phase, cwd: meta.cwd });
    if (meta.phase === "verify") {
      return { exitCode: options.verifyExitCode ?? 0, stdout: "verify ok", stderr: "" };
    }
    const filename = options.filename ?? "fixture-pkg-1.2.3.tgz";
    if (meta.phase === "pack-list") {
      return {
        exitCode: options.previewExitCode ?? 0,
        stdout: JSON.stringify([{
          name: options.previewName ?? "@fixture/pkg",
          version: options.previewVersion ?? "1.2.3",
          filename,
          files: [{ path: "package.json" }],
        }]),
        stderr: "",
      };
    }
    if (meta.phase !== "pack") throw new Error(`unexpected phase ${meta.phase}`);
    const payload = Buffer.from(options.payload ?? "fixture package bytes\n", "utf8");
    await fs.writeFile(path.join(meta.cwd ?? root, filename), payload);
    return {
      exitCode: options.packExitCode ?? 0,
      stdout: JSON.stringify([{
        name: options.packName ?? "@fixture/pkg",
        version: options.packVersion ?? "1.2.3",
        filename,
        size: options.reportedSize ?? payload.byteLength,
        shasum: "a".repeat(40),
        integrity: "sha512-fixture",
      }]),
      stderr: "",
    };
  };
}

const schema = JSON.parse(await fs.readFile(new URL("../config/project-context/release-gate-receipt.schema.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateReceipt = ajv.compile(schema);

{
  const { root, version } = await makeFixture();
  const calls = [];
  const now = () => new Date("2026-08-18T22:00:00.000Z");
  const result = await runReleaseGate({ projectRoot: root, runCommand: fakeRunner(root, calls), now });
  assert.deepEqual(calls.map((call) => call.phase), ["verify", "pack-list", "pack"], "release:gate must run verify, one package preview, then one canonical pack");
  assert.equal(result.receipt.package.version, version);
  assert.equal(result.receipt.alias.startsWith("pkg:1.2.3#"), true);
  assert.equal(result.receipt.alias.length, "pkg:1.2.3#".length + 8);
  assert.equal(result.receipt.artifact.bytes, Buffer.byteLength("fixture package bytes\n"));
  assert.equal(result.receipt.artifact.sha256, createHash("sha256").update("fixture package bytes\n").digest("hex"));
  assert.equal(result.receipt.verification.status, "pass");
  assert.equal(validateReceipt(result.receipt), true, ajv.errorsText(validateReceipt.errors));
  assert.equal(await fs.readFile(path.join(root, ".mssr", "PROJECT_STATE.md"), "utf8"), "ORIGINAL STATE\n", "release:gate must not rewrite PROJECT_STATE");
  const stored = JSON.parse(await fs.readFile(path.join(root, ".mssr", "runtime", "releases", `${version}.json`), "utf8"));
  assert.deepEqual(stored, result.receipt);
}

{
  const { root } = await makeFixture({ impactState: "pending" });
  const calls = [];
  await assert.rejects(
    runReleaseGate({ projectRoot: root, runCommand: fakeRunner(root, calls) }),
    /must be explicitly reviewed before release:gate/,
  );
  assert.deepEqual(calls, [], "pending authority review must fail before verify/pack");
}

{
  const { root } = await makeFixture({ indexCurrent: false });
  const calls = [];
  await assert.rejects(runReleaseGate({ projectRoot: root, runCommand: fakeRunner(root, calls) }), /INDEX\.md does not reference/);
  assert.deepEqual(calls, []);
}

{
  const { root } = await makeFixture({ rootCurrent: false });
  const calls = [];
  await assert.rejects(runReleaseGate({ projectRoot: root, runCommand: fakeRunner(root, calls) }), /CHANGELOG\.md does not identify/);
  assert.deepEqual(calls, []);
}

{
  const { root } = await makeFixture();
  const calls = [];
  await assert.rejects(
    runReleaseGate({ projectRoot: root, runCommand: fakeRunner(root, calls, { verifyExitCode: 1 }) }),
    /npm run verify failed/,
  );
  assert.deepEqual(calls.map((call) => call.phase), ["verify"], "failed verify must prevent packaging");
}

{
  const { root } = await makeFixture();
  const calls = [];
  await assert.rejects(
    runReleaseGate({ projectRoot: root, runCommand: fakeRunner(root, calls, { packVersion: "1.2.4" }) }),
    /npm pack identity mismatch/,
  );
  assert.deepEqual(calls.map((call) => call.phase), ["verify", "pack-list", "pack"]);
}

{
  const { root } = await makeFixture();
  const calls = [];
  await assert.rejects(
    runReleaseGate({ projectRoot: root, runCommand: fakeRunner(root, calls, { reportedSize: 999 }) }),
    /size\/readback mismatch/,
  );
  await assert.rejects(fs.access(path.join(root, ".mssr", "runtime", "releases", "1.2.3.json")), "failed artifact readback must not persist a receipt");
}

{
  const { root } = await makeFixture();
  const calls = [];
  await assert.rejects(
    runReleaseGate({ projectRoot: root, runCommand: fakeRunner(root, calls, { filename: "../unsafe.tgz" }) }),
    /unsafe or missing artifact filename/,
  );
}

{
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-release-eol-repro-"));
  try {
    await execFile("git", ["init", "-q"], { cwd: root, windowsHide: true });
    await fs.writeFile(path.join(root, ".gitattributes"), "* text=auto eol=lf\n*.ps1 text eol=crlf\n", "utf8");
    await fs.writeFile(path.join(root, "package.json"), `${JSON.stringify({
      name: "eol-repro-fixture",
      version: "1.0.0",
      files: ["note.txt", "script.ps1"],
    }, null, 2)}\n`, "utf8");
    const packedFiles = [{ path: "package.json" }, { path: "note.txt" }, { path: "script.ps1" }];

    async function packVariant(noteText, scriptText) {
      await fs.writeFile(path.join(root, "note.txt"), noteText, "utf8");
      await fs.writeFile(path.join(root, "script.ps1"), scriptText, "utf8");
      const canonical = await materializeCanonicalPackageFiles(root, packedFiles);
      try {
        const canonicalNote = await fs.readFile(path.join(canonical.stagingRoot, "note.txt"), "utf8");
        const canonicalScript = await fs.readFile(path.join(canonical.stagingRoot, "script.ps1"), "utf8");
        const result = await defaultReleaseGateCommand("npm", ["pack", "--json"], { cwd: canonical.stagingRoot });
        const packed = JSON.parse(result.stdout)[0];
        const artifact = await fs.readFile(path.join(canonical.stagingRoot, packed.filename));
        return {
          sha256: createHash("sha256").update(artifact).digest("hex"),
          canonicalNote,
          canonicalScript,
        };
      } finally {
        await canonical.cleanup();
      }
    }

    const crlfCheckout = await packVariant("alpha\r\nbeta\r\n", "Write-Output alpha\nWrite-Output beta\n");
    const lfCheckout = await packVariant("alpha\nbeta\n", "Write-Output alpha\r\nWrite-Output beta\r\n");
    assert.equal(crlfCheckout.canonicalNote, "alpha\nbeta\n", "text files must materialize as canonical LF bytes");
    assert.equal(crlfCheckout.canonicalScript, "Write-Output alpha\r\nWrite-Output beta\r\n", "PowerShell files must preserve the declared CRLF contract");
    assert.equal(lfCheckout.canonicalNote, crlfCheckout.canonicalNote);
    assert.equal(lfCheckout.canonicalScript, crlfCheckout.canonicalScript);
    assert.equal(lfCheckout.sha256, crlfCheckout.sha256, "same logical package content must produce the same tgz SHA-256 across physical EOL variants");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

console.log("MSSR release:gate deterministic automation tests PASS");
