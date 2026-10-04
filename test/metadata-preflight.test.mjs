import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  assertExternalRunRoot,
  assertPinnedInputMap,
  parseArgs,
  MetadataPreflightError,
  validateOptionalReferencesManifestPin,
} from "../experiments/jev-metadata-integration/metadata-preflight.mjs";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-sidecar-preflight-test-"));
try {
  const repo = path.join(scratch, "repo");
  const product = path.join(scratch, "product");
  await fs.mkdir(repo);
  await fs.mkdir(product);
  const valid = path.join(scratch, "artifacts", "sidecar-preflight");
  assert.equal(await assertExternalRunRoot(valid, [repo, product]), valid);

  await assert.rejects(
    () => assertExternalRunRoot(path.join(repo, "outputs"), [repo, product]),
    (error) => error instanceof MetadataPreflightError && error.code === "repository-path-forbidden",
  );
  await assert.rejects(
    () => assertExternalRunRoot(path.join(scratch, "outputs", "runs", "sidecar"), [repo, product]),
    (error) => error instanceof MetadataPreflightError && error.code === "runs-path-forbidden",
  );

  const runsTarget = path.join(scratch, "runs", "sidecar");
  const runsAlias = path.join(scratch, "artifacts", "alias");
  await fs.mkdir(runsTarget, { recursive: true });
  await fs.mkdir(path.dirname(runsAlias), { recursive: true });
  await fs.symlink(path.join(scratch, "runs"), runsAlias, "junction");
  await assert.rejects(
    () => assertExternalRunRoot(path.join(runsAlias, "sidecar"), [repo, product]),
    (error) => error instanceof MetadataPreflightError && error.code === "runs-path-forbidden",
  );

  const nonEmpty = path.join(scratch, "artifacts", "already-used");
  await fs.mkdir(nonEmpty, { recursive: true });
  await fs.writeFile(path.join(nonEmpty, "keep.txt"), "do not overwrite");
  await assert.rejects(
    () => assertExternalRunRoot(nonEmpty, [repo, product]),
    (error) => error instanceof MetadataPreflightError && error.code === "run-root-not-empty",
  );

  const sidecar = Buffer.from('{"entries":[]}');
  const expected = { ".mssr/project-context-librarian.json": sha(sidecar) };
  assert.equal(assertPinnedInputMap(new Map([[Object.keys(expected)[0], sidecar]]), expected), true);
  assert.throws(
    () => assertPinnedInputMap(new Map(), expected),
    (error) => error instanceof MetadataPreflightError && error.code === "pinned-input-missing",
  );
  assert.throws(
    () => assertPinnedInputMap(new Map([[Object.keys(expected)[0], Buffer.from("{}")]]), expected),
    (error) => error instanceof MetadataPreflightError && error.code === "pinned-input-hash-mismatch",
  );
  assert.equal(validateOptionalReferencesManifestPin({ path: ".mssr/project-context-refs.json", present: false }), true);
  assert.throws(
    () => validateOptionalReferencesManifestPin({ path: ".mssr/project-context-refs.json", present: true }),
    (error) => error instanceof MetadataPreflightError && error.code === "references-manifest-hash-required",
  );
  assert.throws(
    () => validateOptionalReferencesManifestPin({ path: "../refs.json", present: false }),
    (error) => error instanceof MetadataPreflightError && error.code === "invalid-references-manifest-pin",
  );

  const parsed = parseArgs(["--preflight", "--candidate-root", product, "--run-root", valid]);
  assert.equal(parsed.preflight, true);
  assert.throws(
    () => parseArgs(["--preflight", "--allow-network", "--candidate-root", product, "--run-root", valid]),
    (error) => error instanceof MetadataPreflightError && error.code === "unsupported-flag",
  );
  assert.throws(
    () => parseArgs(["--live", "--candidate-root", product, "--run-root", valid]),
    (error) => error instanceof MetadataPreflightError && error.code === "unsupported-flag",
  );
} finally {
  await fs.rm(scratch, { recursive: true, force: true });
}
process.stdout.write("PASS metadata preflight: output-root isolation, no-overwrite, pin hashes, and offline-only CLI\n");
