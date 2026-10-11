import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const isSha256 = (value) => typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
const sha256Text = (value) => createHash("sha256").update(Buffer.from(value, "utf8")).digest("hex");
const ownerKey = (value) => typeof value === "string"
  ? path.normalize(value.trim()).replace(/[\\/]+$/u, "").toLocaleLowerCase("en-US")
  : "";

export function validateRunInputs(cases, labels, sourceRefs) {
  assert.ok(Array.isArray(cases) && cases.length > 0, "cases.json must contain at least one case");
  assert.ok(labels && typeof labels === "object" && Array.isArray(labels.cases), "labels.json must contain a cases array");

  const caseIds = new Set();
  for (const [index, item] of cases.entries()) {
    assert.ok(item && typeof item === "object", `case ${index + 1} must be an object`);
    assert.ok(typeof item.id === "string" && item.id.trim().length > 0, `case ${index + 1} needs a non-empty id`);
    assert.ok(!caseIds.has(item.id), `duplicate case id: ${item.id}`);
    caseIds.add(item.id);
    assert.ok(typeof item.sourceRef === "string" && item.sourceRef.trim().length > 0, `case ${item.id} needs a sourceRef`);
    if (Array.isArray(sourceRefs)) assert.ok(sourceRefs.includes(item.sourceRef), `case ${item.id} references a source absent from the frozen corpus`);
    assert.ok(typeof item.query === "string" && item.query.trim().length > 0, `case ${item.id} needs a non-empty query`);
  }

  const labelIds = new Set();
  for (const [index, label] of labels.cases.entries()) {
    assert.ok(label && typeof label === "object", `label ${index + 1} must be an object`);
    assert.ok(typeof label.caseId === "string" && label.caseId.trim().length > 0, `label ${index + 1} needs a non-empty caseId`);
    assert.ok(!labelIds.has(label.caseId), `duplicate label caseId: ${label.caseId}`);
    labelIds.add(label.caseId);
    assert.ok(typeof label.expectedHeading === "string" && label.expectedHeading.trim().length > 0, `label ${label.caseId} needs an expectedHeading`);
    const hasStart = label.expectedStartLine !== undefined;
    const hasEnd = label.expectedEndLine !== undefined;
    assert.equal(hasStart, hasEnd, `label ${label.caseId} must provide both expectedStartLine and expectedEndLine`);
    if (hasStart) {
      assert.ok(Number.isInteger(label.expectedStartLine) && label.expectedStartLine > 0, `label ${label.caseId} expectedStartLine must be a positive integer`);
      assert.ok(Number.isInteger(label.expectedEndLine) && label.expectedEndLine >= label.expectedStartLine, `label ${label.caseId} expectedEndLine must be an integer at or after expectedStartLine`);
    }
  }

  assert.equal(labelIds.size, caseIds.size, "cases and labels must form a one-to-one mapping");
  for (const id of caseIds) assert.ok(labelIds.has(id), `missing label for case ${id}`);
  for (const id of labelIds) assert.ok(caseIds.has(id), `label has no matching case ${id}`);
  return true;
}

function sameHandleIdentity(actual, expected) {
  const keys = [
    "id", "version", "owner", "sourceRef", "revision", "rangeId", "rangeKind",
    "startLine", "endLine", "startOffset", "endOffset", "fingerprint", "privacyClass",
  ];
  return Boolean(actual && expected && keys.every((key) => actual[key] === expected[key]));
}

export function validateFetchResult(fetched, expectedHandle) {
  const errors = [];
  if (!fetched || typeof fetched !== "object") return { passed: false, errors: ["fetch result is not an object"] };
  if (typeof fetched.text !== "string") errors.push("fetch text is missing or not a string");
  if (!sameHandleIdentity(fetched.handle, expectedHandle)) errors.push("returned fetch handle does not match the selected handle");
  if (typeof fetched.projectOwner !== "string" || ownerKey(fetched.projectOwner) !== ownerKey(expectedHandle?.owner)) {
    errors.push("Bridge projectOwner does not match the selected handle owner");
  }
  if (!isSha256(fetched.fingerprint)) errors.push("fetch fingerprint is not a SHA-256 hex digest");
  if (!isSha256(fetched.handle?.fingerprint)) errors.push("returned handle fingerprint is not a SHA-256 hex digest");
  if (typeof fetched.text === "string" && isSha256(fetched.fingerprint)
    && sha256Text(fetched.text) !== fetched.fingerprint) errors.push("fetch fingerprint does not match exact text bytes");
  if (fetched.fingerprint !== expectedHandle?.fingerprint) errors.push("fetch fingerprint differs from the selected handle fingerprint");
  if (fetched.handle?.fingerprint !== fetched.fingerprint) errors.push("fetch result and returned handle fingerprints differ");
  if (fetched.advisoryOnly !== true || fetched.truthAuthority !== false) errors.push("fetch authority flags do not match the advisory contract");
  return { passed: errors.length === 0, errors };
}

export function validateEvidencePack(pack, expectedHandle, fetchedText) {
  const errors = [];
  if (!pack || typeof pack !== "object") return { passed: false, errors: ["evidence-pack result is not an object"] };
  if (pack.schemaVersion !== 1) errors.push("evidence-pack schemaVersion must be 1");
  if (pack.kind !== "mssr-librarian-evidence-pack") errors.push("evidence-pack kind is invalid");
  if (pack.assembly !== "verbatim-source-ranges") errors.push("evidence-pack assembly mode is invalid");
  if (typeof pack.projectOwner !== "string" || ownerKey(pack.projectOwner) !== ownerKey(expectedHandle?.owner)) {
    errors.push("Bridge projectOwner does not match the selected handle owner");
  }
  if (pack.sourceCount !== 1) errors.push("evidence-pack sourceCount must be 1 for this one-source request");
  if (!Array.isArray(pack.paragraphs) || pack.paragraphs.length !== 1) {
    errors.push("evidence-pack must contain exactly one paragraph for the selected handle");
  }
  const paragraph = Array.isArray(pack.paragraphs) ? pack.paragraphs[0] : null;
  const citation = paragraph?.citation;
  if (!paragraph || typeof paragraph.exactText !== "string") errors.push("evidence-pack paragraph exactText is missing");
  if (typeof paragraph?.exactText === "string" && paragraph.exactText !== fetchedText) errors.push("evidence-pack text differs from the validated fetch text");
  if (!citation || citation.handleId !== expectedHandle?.id) errors.push("evidence-pack citation does not bind to the selected handle");
  for (const key of ["owner", "sourceRef", "revision", "rangeId", "rangeKind", "startLine", "endLine", "privacyClass"]) {
    if (citation?.[key] !== expectedHandle?.[key]) errors.push(`evidence-pack citation ${key} differs from the selected handle`);
  }
  if (!isSha256(citation?.fingerprint) || citation?.fingerprint !== expectedHandle?.fingerprint) {
    errors.push("evidence-pack citation fingerprint does not match the selected handle");
  }
  if (typeof paragraph?.exactText === "string" && citation?.fingerprint !== sha256Text(paragraph.exactText)) {
    errors.push("evidence-pack citation fingerprint does not match paragraph exactText");
  }
  const totalChars = Array.isArray(pack.paragraphs)
    ? pack.paragraphs.reduce((sum, item) => sum + (typeof item?.exactText === "string" ? item.exactText.length : 0), 0)
    : -1;
  if (!Number.isInteger(pack.totalFetchedChars) || pack.totalFetchedChars !== totalChars) errors.push("evidence-pack totalFetchedChars is inconsistent");
  if (pack.advisoryOnly !== true || pack.truthAuthority !== false || pack.canonicalRewriteAllowed !== false) {
    errors.push("evidence-pack authority flags do not match the read-only contract");
  }
  return { passed: errors.length === 0, errors };
}

export async function acquireExclusiveRunLock(lockPath) {
  let handle;
  try {
    handle = await fs.open(lockPath, "wx");
    await handle.writeFile(`${JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() })}\n`, "utf8");
  } catch (error) {
    if (handle) {
      await handle.close().catch(() => {});
      await fs.rm(lockPath, { force: true }).catch(() => {});
    }
    if (error?.code === "EEXIST") {
      throw new Error(`An exclusive run lock already exists at ${lockPath}; preserve this packet and inspect the lock owner before proceeding.`, { cause: error });
    }
    throw error;
  }

  let released = false;
  return async () => {
    if (released) return;
    released = true;
    try {
      await handle.close();
    } finally {
      await fs.rm(lockPath, { force: false });
    }
  };
}
