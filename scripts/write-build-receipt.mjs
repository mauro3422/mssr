import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MSSR_BUILD_RECEIPT_FILE,
  MSSR_BUILD_RECEIPT_SCHEMA,
  computeMssrServerBuildHash,
} from "../dist/server-build.js";

/**
 * Finished-build marker for stale-process detection. Runs only after a clean
 * `tsc` (chained with `&&`), so failed compilations never advance the
 * available build identity. Written atomically: readers see the previous
 * receipt or the new one, never a half file.
 */
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(projectRoot, "dist");
const names = (await fs.readdir(distDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
  .map((entry) => entry.name)
  .sort();
if (!names.length) throw new Error("No built modules in dist/; refusing to write a build receipt.");
const { id, bytes } = computeMssrServerBuildHash(distDir, names);
const pkg = JSON.parse(await fs.readFile(path.join(projectRoot, "package.json"), "utf8"));
const receipt = {
  schema: MSSR_BUILD_RECEIPT_SCHEMA,
  id,
  version: typeof pkg?.version === "string" ? pkg.version : "unknown",
  files: names.length,
  bytes,
};
const temporary = path.join(distDir, `.${process.pid}.${Date.now()}.tmp`);
await fs.writeFile(temporary, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
await fs.rename(temporary, path.join(distDir, MSSR_BUILD_RECEIPT_FILE));
const readback = JSON.parse(await fs.readFile(path.join(distDir, MSSR_BUILD_RECEIPT_FILE), "utf8"));
if (readback.id !== id) throw new Error("Build receipt readback mismatch.");
// Lifecycle output must stay on stderr: `npm pack` runs `prepare` (hence the
// build) and parses its own stdout as JSON.
console.error(JSON.stringify({ ok: true, ...receipt }));
