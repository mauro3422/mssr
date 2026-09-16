import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Server build identity for stale-process detection.
 *
 * The identity is a hash over the compiled `dist/*.js` bytes plus the package
 * version as a label. Source edits never change it; only a finished compiler
 * run does. Comparing the identity captured at process start (loaded) against
 * a fresh read (available) therefore detects a stale persistent server without
 * confusing dirty worktrees with deployed builds.
 *
 * Two guards keep partial or failed compilations from fabricating identities:
 * a finished build writes an atomic `.build-receipt.json` marker that is
 * authoritative only when the recomputed content hash equals it, and
 * receipt-less reads report `unknown` while any output file is still
 * settling (fresh mtime). A receipt mismatch stays `unknown` at any age:
 * torn output is never promoted into an identity by growing old.
 */

export const MSSR_BUILD_RECEIPT_SCHEMA = "mssr-build-receipt-v1" as const;
export const MSSR_BUILD_RECEIPT_FILE = ".build-receipt.json" as const;
/** Fresh output is treated as a write in progress, never as a new identity. */
export const MSSR_SERVER_BUILD_SETTLE_MS = 60_000;

export type MssrServerBuildId =
  | Readonly<{
    status: "known";
    /** Stable fingerprint, e.g. `mssr-build:sha256:<16 hex>`. */
    id: string;
    version: string;
    files: number;
    bytes: number;
  }>
  | Readonly<{ status: "unknown"; reason: string }>;

export type MssrServerBuildReceipt = Readonly<{
  schema: typeof MSSR_BUILD_RECEIPT_SCHEMA;
  id: string;
  version: string;
  files: number;
  bytes: number;
  builtAt: string;
}>;

const MAX_BUILD_BYTES = 32 * 1024 * 1024;

type DistEntry = { name: string; size: number; mtimeMs: number };

/**
 * Distribution directory whose compiled bytes define the build. Honors
 * `MSSR_SERVER_DIST_DIR` for vendored/embedded layouts; otherwise resolves to
 * the directory holding the running module (the `dist/` output).
 */
export function resolveMssrServerDistDir(fromFile?: string): string {
  const override = process.env.MSSR_SERVER_DIST_DIR?.trim();
  if (override) return path.resolve(override);
  try {
    return path.dirname(fileURLToPath(fromFile ?? import.meta.url));
  } catch {
    return path.resolve(process.cwd(), "dist");
  }
}

function listDistEntries(distDir: string): DistEntry[] | null {
  try {
    const names = fs.readdirSync(distDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
      .map((entry) => entry.name)
      .sort();
    if (!names.length) return null;
    return names.map((name) => {
      const stat = fs.statSync(path.join(distDir, name));
      return { name, size: stat.size, mtimeMs: stat.mtimeMs };
    });
  } catch {
    return null;
  }
}

/** Single shared byte-hash implementation used by readers and the build script. */
export function computeMssrServerBuildHash(distDir: string, names: readonly string[]): { id: string; bytes: number } {
  const hash = createHash("sha256");
  let bytes = 0;
  for (const name of names) {
    const data = fs.readFileSync(path.join(distDir, name));
    bytes += data.length;
    hash.update(name);
    hash.update(data);
  }
  return { id: `mssr-build:sha256:${hash.digest("hex").slice(0, 16)}`, bytes };
}

function readPackageVersion(distDir: string): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(distDir, "..", "package.json"), "utf8")) as { version?: unknown };
    if (typeof pkg?.version === "string" && pkg.version.trim()) return pkg.version.trim().slice(0, 32);
  } catch {
    // The version label is advisory; the byte identity remains authoritative.
  }
  return "unknown";
}

/** Read the finished-build marker written atomically by the build script. */
export function readMssrServerBuildReceipt(distDir: string): MssrServerBuildReceipt | null {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(distDir, MSSR_BUILD_RECEIPT_FILE), "utf8")) as Record<string, unknown>;
    if (raw.schema !== MSSR_BUILD_RECEIPT_SCHEMA) return null;
    if (typeof raw.id !== "string" || !raw.id.trim() || raw.id.length > 80) return null;
    if (typeof raw.version !== "string" || raw.version.length > 32) return null;
    if (!Number.isInteger(raw.files) || (raw.files as number) <= 0) return null;
    if (!Number.isInteger(raw.bytes) || (raw.bytes as number) <= 0) return null;
    return {
      schema: MSSR_BUILD_RECEIPT_SCHEMA,
      id: raw.id.trim(),
      version: raw.version,
      files: raw.files as number,
      bytes: raw.bytes as number,
      builtAt: typeof raw.builtAt === "string" ? raw.builtAt.slice(0, 64) : "",
    };
  } catch {
    return null;
  }
}

/** Read the available build identity without touching source files. */
export function readMssrServerBuildId(distDir: string = resolveMssrServerDistDir()): MssrServerBuildId {
  const entries = listDistEntries(distDir);
  if (!entries) {
    try {
      fs.readdirSync(distDir);
      return { status: "unknown", reason: "no built modules" };
    } catch (error) {
      return { status: "unknown", reason: error instanceof Error ? error.message.slice(0, 120) : "unreadable" };
    }
  }
  const totalBytes = entries.reduce((sum, entry) => sum + entry.size, 0);
  if (totalBytes > MAX_BUILD_BYTES) return { status: "unknown", reason: "build exceeds bounds" };

  // A finished-build receipt is authoritative only when the recomputed
  // content hash equals it. Failed compilations never rewrite the receipt,
  // and any mismatch — torn writes, same-size edits, aged failures — stays
  // `unknown` at any age instead of being promoted into an identity.
  const receipt = readMssrServerBuildReceipt(distDir);
  if (receipt) {
    if (receipt.files === entries.length && receipt.bytes === totalBytes) {
      try {
        const { id } = computeMssrServerBuildHash(distDir, entries.map((entry) => entry.name));
        if (id === receipt.id) {
          return { status: "known", id, version: receipt.version, files: entries.length, bytes: totalBytes };
        }
      } catch {
        // A read error during validation is itself evidence of torn output.
      }
    }
    return { status: "unknown", reason: "build receipt mismatch" };
  }

  // Without any receipt (legacy layouts), freshly written output is a
  // compilation in progress (or its immediate aftermath), never a new
  // identity.
  const now = Date.now();
  if (entries.some((entry) => entry.mtimeMs > now || now - entry.mtimeMs < MSSR_SERVER_BUILD_SETTLE_MS)) {
    return { status: "unknown", reason: "build settling" };
  }

  try {
    const { id } = computeMssrServerBuildHash(distDir, entries.map((entry) => entry.name));
    return { status: "known", id, version: readPackageVersion(distDir), files: entries.length, bytes: totalBytes };
  } catch (error) {
    return { status: "unknown", reason: error instanceof Error ? error.message.slice(0, 120) : "unreadable" };
  }
}

export function isSameMssrServerBuild(a: MssrServerBuildId, b: MssrServerBuildId): boolean {
  return a.status === "known" && b.status === "known" && a.id === b.id;
}

export function mssrServerBuildLabel(build: MssrServerBuildId): string {
  return build.status === "known" ? `${build.id} (v${build.version})` : "unknown build";
}
