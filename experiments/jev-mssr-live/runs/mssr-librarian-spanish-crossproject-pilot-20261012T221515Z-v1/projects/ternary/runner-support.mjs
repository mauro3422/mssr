import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const isSha256 = (value) => typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
const sha256Text = (value) => createHash("sha256").update(Buffer.from(value, "utf8")).digest("hex");
const sha256Bytes = (value) => createHash("sha256").update(value).digest("hex");
const rangeFingerprintPayload = (rangeKind, text) => rangeKind === "section" ? text.trim() : text;
const ownerKey = (value) => typeof value === "string"
  ? path.normalize(value.trim()).replace(/[\\/]+$/u, "").toLocaleLowerCase("en-US")
  : "";

export const PROJECT_CONTEXT_METADATA_MODES = Object.freeze([
  "off",
  "project-context-single-section",
  "project-context-librarian-sidecar",
]);

export const PROJECT_CONTEXT_METADATA_CONTROL_PATHS = Object.freeze([
  ".mssr/project-context.json",
  ".mssr/project-context-librarian.json",
  ".mssr/project-context-segments.json",
  ".mssr/project-context-refs.json",
]);

export function resolveMetadataRunConfig(manifest, cases) {
  const defaultMode = manifest.runtime?.metadataMode ?? "off";
  assert.ok(PROJECT_CONTEXT_METADATA_MODES.includes(defaultMode), `unsupported runtime metadataMode: ${defaultMode}`);
  assert.ok(Array.isArray(cases), "cases.json must contain a cases array");
  const byCaseId = new Map();
  let requiresProjectContextControls = false;

  for (const item of cases) {
    const mode = item.metadataMode ?? defaultMode;
    assert.ok(PROJECT_CONTEXT_METADATA_MODES.includes(mode), `case ${item.id} has unsupported metadataMode: ${mode}`);
    const metadata = item.metadata;
    if (metadata !== undefined) {
      assert.ok(metadata && typeof metadata === "object" && !Array.isArray(metadata), `case ${item.id} metadata must be an object`);
      const entries = Object.entries(metadata);
      assert.ok(entries.length > 0, `case ${item.id} metadata cannot be empty`);
      assert.notEqual(mode, "off", `case ${item.id} cannot apply metadata filters when metadataMode is off`);
      for (const [key, value] of entries) {
        assert.ok(typeof key === "string" && key.trim().length > 0, `case ${item.id} metadata keys must be non-empty strings`);
        assert.ok(typeof value === "string" || (typeof value === "number" && Number.isFinite(value)) || typeof value === "boolean",
          `case ${item.id} metadata values must be strings, finite numbers, or booleans`);
        if (typeof value === "string") assert.ok(value.length <= 240, `case ${item.id} metadata value exceeds 240 characters`);
      }
    }
    if (mode !== "off") requiresProjectContextControls = true;
    byCaseId.set(item.id, { metadataMode: mode, metadata: metadata ?? null });
  }
  return { byCaseId, requiresProjectContextControls };
}

async function optionalFileBytes(filePath) {
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export async function validateProjectContextMetadataControls({ manifest, runDir, projectRoot, required = false }) {
  const entries = manifest.corpus?.metadataControlFiles;
  if (entries === undefined) {
    assert.ok(!required, "Project Context metadata runs require frozen metadataControlFiles for all four control paths");
    return [];
  }
  assert.ok(Array.isArray(entries), "corpus.metadataControlFiles must be an array");
  assert.equal(entries.length, PROJECT_CONTEXT_METADATA_CONTROL_PATHS.length,
    "metadataControlFiles must explicitly freeze all four Project Context control paths");
  const byPath = new Map();
  for (const entry of entries) {
    assert.ok(entry && typeof entry === "object", "metadata control entry must be an object");
    assert.ok(PROJECT_CONTEXT_METADATA_CONTROL_PATHS.includes(entry.path), `unsupported Project Context metadata control path: ${entry.path}`);
    assert.ok(!byPath.has(entry.path), `duplicate Project Context metadata control path: ${entry.path}`);
    byPath.set(entry.path, entry);
  }
  for (const controlPath of PROJECT_CONTEXT_METADATA_CONTROL_PATHS) {
    assert.ok(byPath.has(controlPath), `missing explicit Project Context metadata control state: ${controlPath}`);
  }

  const frozen = [];
  for (const controlPath of PROJECT_CONTEXT_METADATA_CONTROL_PATHS) {
    const entry = byPath.get(controlPath);
    const actualBytes = await optionalFileBytes(path.join(projectRoot, ...controlPath.split("/")));
    if (entry.state === "absent") {
      assert.equal(entry.sha256, null, `${controlPath} absent state must use sha256: null`);
      assert.equal(entry.snapshotPath, null, `${controlPath} absent state must use snapshotPath: null`);
      assert.equal(actualBytes, null, `${controlPath} was absent at freeze but now exists`);
      frozen.push({ path: controlPath, state: "absent", sha256: null });
      continue;
    }

    assert.equal(entry.state, "present", `${controlPath} state must be present or absent`);
    assert.ok(isSha256(entry.sha256), `${controlPath} present state needs a SHA-256 digest`);
    assert.ok(typeof entry.snapshotPath === "string" && entry.snapshotPath.startsWith("inputs/metadata/"),
      `${controlPath} snapshotPath must be inside inputs/metadata/`);
    const snapshotFile = path.resolve(runDir, entry.snapshotPath);
    const metadataRoot = path.resolve(runDir, "inputs/metadata");
    const metadataRootReal = await fs.realpath(metadataRoot);
    const snapshotFileReal = await fs.realpath(snapshotFile);
    const relativeSnapshot = path.relative(metadataRootReal, snapshotFileReal);
    assert.ok(relativeSnapshot && !relativeSnapshot.startsWith(`..${path.sep}`) && relativeSnapshot !== ".." && !path.isAbsolute(relativeSnapshot),
      `${controlPath} snapshotPath escapes inputs/metadata`);
    const snapshotBytes = await fs.readFile(snapshotFile);
    assert.equal(sha256Bytes(snapshotBytes), entry.sha256, `${controlPath} frozen snapshot changed`);
    assert.ok(actualBytes !== null, `${controlPath} was present at freeze but is now absent`);
    assert.equal(sha256Bytes(actualBytes), entry.sha256, `${controlPath} changed since freeze`);
    frozen.push({ path: controlPath, state: "present", sha256: entry.sha256 });
  }
  return frozen;
}

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
    const matchingCase = cases.find((item) => item.id === label.caseId);
    assert.ok(matchingCase, `label has no matching case ${label.caseId}`);
    if (label.sourceRef !== undefined) {
      assert.equal(label.sourceRef, matchingCase.sourceRef, `label ${label.caseId} sourceRef must match its case`);
    }
    const answerability = label.answerability ?? "answerable";
    assert.ok(["answerable", "unanswerable"].includes(answerability), `label ${label.caseId} answerability must be answerable or unanswerable`);
    if (answerability === "unanswerable") {
      for (const key of ["expectedHeading", "expectedStartLine", "expectedEndLine", "acceptableRanges", "relevantRanges"]) {
        assert.equal(label[key], undefined, `unanswerable label ${label.caseId} must not define ${key}`);
      }
      continue;
    }
    assert.ok(typeof label.expectedHeading === "string" && label.expectedHeading.trim().length > 0, `label ${label.caseId} needs an expectedHeading`);
    const hasStart = label.expectedStartLine !== undefined;
    const hasEnd = label.expectedEndLine !== undefined;
    assert.equal(hasStart, hasEnd, `label ${label.caseId} must provide both expectedStartLine and expectedEndLine`);
    if (hasStart) {
      assert.ok(Number.isInteger(label.expectedStartLine) && label.expectedStartLine > 0, `label ${label.caseId} expectedStartLine must be a positive integer`);
      assert.ok(Number.isInteger(label.expectedEndLine) && label.expectedEndLine >= label.expectedStartLine, `label ${label.caseId} expectedEndLine must be an integer at or after expectedStartLine`);
    }
    if (label.acceptableRanges !== undefined) {
      assert.ok(Array.isArray(label.acceptableRanges) && label.acceptableRanges.length > 0, `label ${label.caseId} acceptableRanges must be a non-empty array`);
      for (const range of label.acceptableRanges) {
        assert.ok(range && typeof range === "object", `label ${label.caseId} acceptable range must be an object`);
        assert.equal(range.sourceRef, matchingCase.sourceRef, `label ${label.caseId} acceptable range must use its case sourceRef`);
        assert.ok(typeof range.expectedHeading === "string" && range.expectedHeading.trim().length > 0, `label ${label.caseId} acceptable range needs an expectedHeading`);
        assert.ok(Number.isInteger(range.startLine) && range.startLine > 0, `label ${label.caseId} acceptable range startLine must be a positive integer`);
        assert.ok(Number.isInteger(range.endLine) && range.endLine >= range.startLine, `label ${label.caseId} acceptable range endLine must be an integer at or after startLine`);
      }
      assert.ok(label.acceptableRanges.some((range) =>
        range.sourceRef === matchingCase.sourceRef
          && range.expectedHeading === label.expectedHeading
          && range.startLine === label.expectedStartLine
          && range.endLine === label.expectedEndLine),
      `label ${label.caseId} primary heading/range must appear in acceptableRanges`);
    }
    if (label.relevantRanges !== undefined) {
      assert.ok(Array.isArray(label.relevantRanges) && label.relevantRanges.length > 0, `label ${label.caseId} relevantRanges must be a non-empty array`);
      for (const range of label.relevantRanges) {
        assert.ok(range && typeof range === "object", `label ${label.caseId} relevant range must be an object`);
        assert.equal(range.sourceRef, matchingCase.sourceRef, `label ${label.caseId} relevant range must use its case sourceRef`);
        assert.ok(typeof range.expectedHeading === "string" && range.expectedHeading.trim().length > 0, `label ${label.caseId} relevant range needs an expectedHeading`);
        assert.ok(Number.isInteger(range.startLine) && range.startLine > 0, `label ${label.caseId} relevant range startLine must be a positive integer`);
        assert.ok(Number.isInteger(range.endLine) && range.endLine >= range.startLine, `label ${label.caseId} relevant range endLine must be an integer at or after startLine`);
      }
    }
  }

  assert.equal(labelIds.size, caseIds.size, "cases and labels must form a one-to-one mapping");
  for (const id of caseIds) assert.ok(labelIds.has(id), `missing label for case ${id}`);
  for (const id of labelIds) assert.ok(caseIds.has(id), `label has no matching case ${id}`);
  return true;
}

function markdownHeadingPathsByLine(markdown) {
  const stack = [];
  const lines = String(markdown).replace(/\r\n?/gu, "\n").split("\n");
  const paths = new Map();
  let fence = null;
  for (let index = 0; index < lines.length; index += 1) {
    const fenceMatch = /^( {0,3})(`{3,}|~{3,})(.*)$/u.exec(lines[index]);
    if (fenceMatch) {
      const marker = fenceMatch[2][0];
      if (fence === null) fence = { marker, length: fenceMatch[2].length };
      else if (fence.marker === marker && fenceMatch[2].length >= fence.length && /^\s*$/u.test(fenceMatch[3])) fence = null;
      paths.set(index + 1, stack.filter(Boolean).slice());
      continue;
    }
    if (fence !== null) {
      paths.set(index + 1, stack.filter(Boolean).slice());
      continue;
    }
    const match = /^( {0,3})(#{1,6})\s+(.+?)\s*#*\s*$/u.exec(lines[index]);
    if (match) {
      const depth = match[2].length;
      stack.length = depth - 1;
      stack[depth - 1] = match[3].trim();
    }
    paths.set(index + 1, stack.filter(Boolean).slice());
  }
  return { lineCount: lines.length, paths };
}

export function validateLabelHeadingPaths(cases, labels, sourceTextByRef) {
  assert.ok(Array.isArray(cases), "cases.json must contain a cases array");
  assert.ok(labels && Array.isArray(labels.cases), "labels.json must contain a cases array");
  assert.ok(sourceTextByRef instanceof Map, "frozen source text must be provided as a Map");

  for (const label of labels.cases) {
    if (!label || (label.answerability ?? "answerable") !== "answerable") continue;
    const matchingCase = cases.find((item) => item.id === label.caseId);
    assert.ok(matchingCase, `label has no matching case ${label.caseId}`);
    const acceptedRanges = Array.isArray(label.acceptableRanges) && label.acceptableRanges.length > 0
      ? label.acceptableRanges
      : Number.isInteger(label.expectedStartLine)
        ? [{
          sourceRef: label.sourceRef ?? matchingCase.sourceRef,
          expectedHeading: label.expectedHeading,
          startLine: label.expectedStartLine,
          endLine: label.expectedEndLine,
        }]
        : [];
    const ranges = [...acceptedRanges, ...(Array.isArray(label.relevantRanges) ? label.relevantRanges : [])];

    for (const range of ranges) {
      const sourceRef = range.sourceRef ?? label.sourceRef ?? matchingCase.sourceRef;
      const markdown = sourceTextByRef.get(sourceRef);
      assert.equal(typeof markdown, "string", `label ${label.caseId} source text is missing for ${sourceRef}`);
      const { lineCount, paths } = markdownHeadingPathsByLine(markdown);
      assert.ok(range.startLine <= lineCount, `label ${label.caseId} startLine ${range.startLine} exceeds ${sourceRef} line count ${lineCount}`);
      if (Number.isInteger(range.endLine)) {
        assert.ok(range.endLine <= lineCount, `label ${label.caseId} endLine ${range.endLine} exceeds ${sourceRef} line count ${lineCount}`);
      }
      const expectedHeading = String(range.expectedHeading ?? "").trim().replace(/^#{1,6}\s+/u, "").trim();
      const actualPath = paths.get(range.startLine) ?? [];
      assert.ok(actualPath.includes(expectedHeading),
        `label ${label.caseId} expectedHeading ${JSON.stringify(expectedHeading)} is not in the heading path at ${sourceRef}:${range.startLine}; actual path: ${actualPath.join(" / ") || "(no heading)"}`);
    }
  }
  return true;
}

function sameHandleIdentity(actual, expected) {
  const keys = [
    "id", "version", "owner", "sourceRef", "revision", "rangeId", "rangeKind",
    "startLine", "endLine", "startOffset", "endOffset", "fingerprint", "privacyClass",
  ];
  return Boolean(actual && expected && keys.every((key) => actual[key] === expected[key]));
}

export function validateFetchResult(fetched, expectedHandle, expectedText) {
  const errors = [];
  if (!fetched || typeof fetched !== "object") return { passed: false, errors: ["fetch result is not an object"] };
  if (typeof fetched.text !== "string") errors.push("fetch text is missing or not a string");
  if (typeof expectedText !== "string") errors.push("exact source range from the frozen snapshot is missing");
  else if (typeof fetched.text === "string" && fetched.text !== expectedText) errors.push("fetch text does not match the exact frozen source range");
  if (!sameHandleIdentity(fetched.handle, expectedHandle)) errors.push("returned fetch handle does not match the selected handle");
  if (typeof fetched.projectOwner !== "string" || ownerKey(fetched.projectOwner) !== ownerKey(expectedHandle?.owner)) {
    errors.push("Bridge projectOwner does not match the selected handle owner");
  }
  if (!isSha256(fetched.fingerprint)) errors.push("fetch fingerprint is not a SHA-256 hex digest");
  if (!isSha256(fetched.handle?.fingerprint)) errors.push("returned handle fingerprint is not a SHA-256 hex digest");
  if (typeof fetched.text === "string" && isSha256(fetched.fingerprint)
    && sha256Text(rangeFingerprintPayload(expectedHandle?.rangeKind, fetched.text)) !== fetched.fingerprint) {
    errors.push("fetch fingerprint does not match the selected range fingerprint contract");
  }
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
  if (typeof paragraph?.exactText === "string"
    && citation?.fingerprint !== sha256Text(rangeFingerprintPayload(expectedHandle?.rangeKind, paragraph.exactText))) {
    errors.push("evidence-pack citation fingerprint does not match the selected range fingerprint contract");
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
