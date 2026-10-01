import { createHash } from "node:crypto";

export const MSSR_DOCUMENT_SURFACE_SCHEMA_VERSION = 1 as const;
export const MSSR_DOCUMENT_SURFACE_REVISION_SCHEME = "sha256-normalized-lf-v1" as const;

export const MSSR_DOCUMENT_SURFACE_BLOCK_KINDS = [
  "prose",
  "list",
  "quote",
  "table",
  "code",
  "other",
] as const;

export type MssrDocumentSurfaceBlockKind = typeof MSSR_DOCUMENT_SURFACE_BLOCK_KINDS[number];

export type MssrDocumentSurfaceHeading = {
  id: string;
  ordinal: number;
  level: number;
  title: string;
  selector: string;
  headingPath: string[];
  parentId: string | null;
  headingLine: number;
  startLine: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
  startByte: number;
  endByte: number;
  chars: number;
  bytes: number;
  directBlockCount: number;
  descendantHeadingCount: number;
  hint: string | null;
  terms: string[];
  fingerprint: string;
};

export type MssrDocumentSurfaceBlock = {
  id: string;
  ordinal: number;
  kind: MssrDocumentSurfaceBlockKind;
  sectionId: string | null;
  startLine: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
  startByte: number;
  endByte: number;
  chars: number;
  bytes: number;
  hint: string;
  terms: string[];
  fingerprint: string;
};

export type MssrDocumentSurface = {
  schemaVersion: typeof MSSR_DOCUMENT_SURFACE_SCHEMA_VERSION;
  revisionScheme: typeof MSSR_DOCUMENT_SURFACE_REVISION_SCHEME;
  sourceRef: string;
  revision: string;
  title: string | null;
  lineCount: number;
  charCount: number;
  byteCount: number;
  headingCount: number;
  blockCount: number;
  maxHeadingLevel: number;
  headings: MssrDocumentSurfaceHeading[];
  blocks: MssrDocumentSurfaceBlock[];
  preambleBlockIds: string[];
};

export type MssrDocumentSurfaceMaterializedRange = {
  sourceRef: string;
  revision: string;
  id: string;
  startLine: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
  text: string;
  fingerprint: string;
};

type LineRecord = {
  text: string;
  startOffset: number;
  endOffset: number;
  endWithNewlineOffset: number;
};

type ScannedHeading = {
  id: string;
  ordinal: number;
  level: number;
  title: string;
  selector: string;
  headingPath: string[];
  parentId: string | null;
  lineIndex: number;
  startOffset: number;
  endOffset: number;
};

type ScannedBlock = {
  id: string;
  ordinal: number;
  kind: MssrDocumentSurfaceBlockKind;
  sectionId: string | null;
  startLine: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
  hint: string;
  terms: string[];
  fingerprint: string;
};

const HEADING_RE = /^ {0,3}(#{1,6})[ \t]+(.+?)[ \t]*$/;
const FENCE_START_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const MAX_DEFAULT_HINT_CHARS = 220;
const MAX_TERMS = 8;

const STOP_WORDS = new Set([
  "the", "and", "for", "that", "with", "from", "this", "into", "when", "then", "than", "must", "should", "would", "could", "will", "are", "was", "were", "has", "have", "not", "its", "our", "your",
  "que", "los", "las", "una", "uno", "para", "por", "con", "del", "como", "pero", "sus", "este", "esta", "esto", "cuando", "donde", "son", "sea", "ser", "sin", "más", "mas", "todo", "cada",
  "project", "current", "actual", "file", "archivo", "system", "sistema", "section", "seccion", "sección",
]);

function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/\r\n?/g, "\n");
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeHeadingText(raw: string): string {
  return raw.replace(/[ \t]+#+[ \t]*$/, "").trim();
}

function lineRecords(source: string): LineRecord[] {
  if (source.length === 0) return [];
  const records: LineRecord[] = [];
  let start = 0;
  while (start <= source.length) {
    const newline = source.indexOf("\n", start);
    if (newline < 0) {
      records.push({ text: source.slice(start), startOffset: start, endOffset: source.length, endWithNewlineOffset: source.length });
      break;
    }
    records.push({ text: source.slice(start, newline), startOffset: start, endOffset: newline, endWithNewlineOffset: newline + 1 });
    start = newline + 1;
    if (start === source.length) {
      records.push({ text: "", startOffset: start, endOffset: start, endWithNewlineOffset: start });
      break;
    }
  }
  return records;
}

function fenceClose(line: string, marker: string): boolean {
  const char = marker[0];
  const re = char === "`" ? /^ {0,3}(`{3,})[ \t]*$/ : /^ {0,3}(~{3,})[ \t]*$/;
  const hit = line.match(re);
  return Boolean(hit && hit[1].length >= marker.length);
}

function scanHeadings(lines: readonly LineRecord[], sourceLength: number): ScannedHeading[] {
  const raw: Array<Omit<ScannedHeading, "id" | "ordinal" | "headingPath" | "parentId" | "endOffset">> = [];
  let fence: string | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].text;
    if (fence) {
      if (fenceClose(line, fence)) fence = null;
      continue;
    }
    const fenceStart = line.match(FENCE_START_RE);
    if (fenceStart) {
      fence = fenceStart[1];
      continue;
    }
    const hit = line.match(HEADING_RE);
    if (!hit) continue;
    const title = normalizeHeadingText(hit[2]);
    if (!title) continue;
    raw.push({
      level: hit[1].length,
      title,
      selector: line.trim(),
      lineIndex: index,
      startOffset: lines[index].startOffset,
    });
  }

  const out: ScannedHeading[] = [];
  const stack: ScannedHeading[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const current = raw[index];
    while (stack.length > 0 && stack[stack.length - 1].level >= current.level) stack.pop();
    const parent = stack[stack.length - 1] ?? null;
    let endOffset = sourceLength;
    for (let next = index + 1; next < raw.length; next += 1) {
      if (raw[next].level <= current.level) {
        endOffset = raw[next].startOffset;
        break;
      }
    }
    const heading: ScannedHeading = {
      id: `heading-${index + 1}`,
      ordinal: index + 1,
      level: current.level,
      title: current.title,
      selector: current.selector,
      headingPath: [...(parent?.headingPath ?? []), current.title],
      parentId: parent?.id ?? null,
      lineIndex: current.lineIndex,
      startOffset: current.startOffset,
      endOffset,
    };
    out.push(heading);
    stack.push(heading);
  }
  return out;
}

function blockKind(lines: readonly string[]): MssrDocumentSurfaceBlockKind {
  const first = lines.find((line) => line.trim().length > 0)?.trim() ?? "";
  if (/^ {0,3}(`{3,}|~{3,})/.test(first)) return "code";
  if (/^(?:[-*+]\s+|\d+[.)]\s+)/.test(first)) return "list";
  if (/^>/.test(first)) return "quote";
  if (/^\|.*\|\s*$/.test(first)) return "table";
  if (first.length > 0 && !/^#{1,6}\s/.test(first)) return "prose";
  return "other";
}

function boundedHint(text: string, kind: MssrDocumentSurfaceBlockKind, maxChars: number): string {
  if (kind === "code") {
    const first = text.split("\n", 1)[0].trim();
    const info = first.replace(/^ {0,3}(?:`{3,}|~{3,})/, "").trim();
    return info ? `code block: ${info.slice(0, Math.max(1, maxChars - 12))}` : "code block";
  }
  const collapsed = text
    .replace(/^ {0,3}#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/[`*_~]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (collapsed.length <= maxChars) return collapsed;
  return `${collapsed.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

function termsFor(text: string): string[] {
  const counts = new Map<string, number>();
  const normalized = Array.from(text.toLowerCase().normalize("NFC"), (point) => point === "ñ" ? point : point.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")).join("");
  for (const token of normalized.match(/[\p{L}\p{N}][\p{L}\p{N}_-]{2,}/gu) ?? []) {
    if (STOP_WORDS.has(token) || /^\d+$/.test(token)) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, MAX_TERMS)
    .map(([token]) => token);
}

function deepestContainingSection(headings: readonly ScannedHeading[], startOffset: number, endOffset: number): ScannedHeading | null {
  let selected: ScannedHeading | null = null;
  for (const heading of headings) {
    if (heading.startOffset > startOffset) break;
    if (startOffset >= heading.startOffset && endOffset <= heading.endOffset) {
      if (!selected || heading.level >= selected.level) selected = heading;
    }
  }
  return selected;
}

function scanBlocks(args: {
  source: string;
  lines: readonly LineRecord[];
  headings: readonly ScannedHeading[];
  maxHintChars: number;
  maxBlocks: number;
}): ScannedBlock[] {
  const headingLines = new Set(args.headings.map((heading) => heading.lineIndex));
  const out: ScannedBlock[] = [];
  let index = 0;
  while (index < args.lines.length && out.length < args.maxBlocks) {
    const current = args.lines[index];
    if (current.text.trim().length === 0 || headingLines.has(index)) {
      index += 1;
      continue;
    }

    let endLineIndex = index;
    const fenceStart = current.text.match(FENCE_START_RE);
    if (fenceStart) {
      const marker = fenceStart[1];
      for (let cursor = index + 1; cursor < args.lines.length; cursor += 1) {
        endLineIndex = cursor;
        if (fenceClose(args.lines[cursor].text, marker)) break;
      }
    } else {
      while (endLineIndex + 1 < args.lines.length) {
        const nextIndex = endLineIndex + 1;
        const next = args.lines[nextIndex];
        if (next.text.trim().length === 0 || headingLines.has(nextIndex) || FENCE_START_RE.test(next.text)) break;
        endLineIndex = nextIndex;
      }
    }

    const startOffset = args.lines[index].startOffset;
    const endOffset = args.lines[endLineIndex].endOffset;
    const text = args.source.slice(startOffset, endOffset).trim();
    if (text.length > 0) {
      const localStart = args.source.slice(startOffset, endOffset).indexOf(text);
      const exactStart = startOffset + Math.max(0, localStart);
      const exactEnd = exactStart + text.length;
      const rawLines = text.split("\n");
      const kind = blockKind(rawLines);
      const section = deepestContainingSection(args.headings, exactStart, exactEnd);
      out.push({
        id: `block-${out.length + 1}`,
        ordinal: out.length + 1,
        kind,
        sectionId: section?.id ?? null,
        startLine: index + 1,
        endLine: endLineIndex + 1,
        startOffset: exactStart,
        endOffset: exactEnd,
        hint: boundedHint(text, kind, args.maxHintChars),
        terms: termsFor(kind === "code" ? "" : text),
        fingerprint: sha256(text),
      });
    }
    index = endLineIndex + 1;
  }
  return out;
}

function byteOffsetsAt(source: string, offsets: readonly number[]): Map<number, number> {
  const wanted = [...new Set(offsets.map((offset) => Math.max(0, Math.min(source.length, offset))))].sort((a, b) => a - b);
  const out = new Map<number, number>();
  let cursor = 0;
  let bytes = 0;
  for (const offset of wanted) {
    if (offset > cursor) {
      bytes += Buffer.byteLength(source.slice(cursor, offset), "utf8");
      cursor = offset;
    }
    out.set(offset, bytes);
  }
  return out;
}

function lineForOffset(lines: readonly LineRecord[], offset: number): number {
  if (lines.length === 0) return 0;
  for (let index = 0; index < lines.length; index += 1) {
    if (offset < lines[index].endWithNewlineOffset || index === lines.length - 1) return index + 1;
  }
  return lines.length;
}

function descendantHeadingCount(headings: readonly ScannedHeading[], heading: ScannedHeading): number {
  return headings.filter((candidate) => candidate.id !== heading.id && candidate.startOffset > heading.startOffset && candidate.endOffset <= heading.endOffset).length;
}

/**
 * Build a bounded metadata-only map of Markdown. The returned surface never stores
 * document bodies: headings, blocks and hints only point back to a revision-bound
 * source range so hosts can acquire exact evidence progressively.
 */
export function buildMssrMarkdownDocumentSurface(args: {
  sourceRef: string;
  markdown: string;
  maxHintChars?: number;
  maxBlocks?: number;
}): MssrDocumentSurface {
  const source = normalizeMarkdown(args.markdown);
  const lines = lineRecords(source);
  const headings = scanHeadings(lines, source.length);
  const maxHintChars = Math.max(40, Math.min(500, Math.floor(args.maxHintChars ?? MAX_DEFAULT_HINT_CHARS)));
  const maxBlocks = Math.max(1, Math.min(2048, Math.floor(args.maxBlocks ?? 1024)));
  const blocks = scanBlocks({ source, lines, headings, maxHintChars, maxBlocks });

  const offsets = [0, source.length];
  for (const heading of headings) offsets.push(heading.startOffset, heading.endOffset);
  for (const block of blocks) offsets.push(block.startOffset, block.endOffset);
  const bytes = byteOffsetsAt(source, offsets);

  const publicBlocks: MssrDocumentSurfaceBlock[] = blocks.map((block) => ({
    ...block,
    startByte: bytes.get(block.startOffset) ?? 0,
    endByte: bytes.get(block.endOffset) ?? Buffer.byteLength(source, "utf8"),
    chars: block.endOffset - block.startOffset,
    bytes: (bytes.get(block.endOffset) ?? 0) - (bytes.get(block.startOffset) ?? 0),
  }));

  const publicHeadings: MssrDocumentSurfaceHeading[] = headings.map((heading) => {
    const directBlocks = publicBlocks.filter((block) => block.sectionId === heading.id);
    const descendantBlocks = publicBlocks.filter((block) => block.startOffset >= heading.startOffset && block.endOffset <= heading.endOffset);
    const lead = directBlocks.find((block) => block.kind !== "code") ?? directBlocks[0] ?? descendantBlocks.find((block) => block.kind !== "code") ?? descendantBlocks[0] ?? null;
    const startByte = bytes.get(heading.startOffset) ?? 0;
    const endByte = bytes.get(heading.endOffset) ?? Buffer.byteLength(source, "utf8");
    return {
      id: heading.id,
      ordinal: heading.ordinal,
      level: heading.level,
      title: heading.title,
      selector: heading.selector,
      headingPath: heading.headingPath,
      parentId: heading.parentId,
      headingLine: heading.lineIndex + 1,
      startLine: heading.lineIndex + 1,
      endLine: lineForOffset(lines, Math.max(heading.startOffset, heading.endOffset - 1)),
      startOffset: heading.startOffset,
      endOffset: heading.endOffset,
      startByte,
      endByte,
      chars: heading.endOffset - heading.startOffset,
      bytes: endByte - startByte,
      directBlockCount: directBlocks.length,
      descendantHeadingCount: descendantHeadingCount(headings, heading),
      hint: lead?.hint ?? null,
      terms: [...new Set([...termsFor(heading.title), ...(lead?.terms ?? [])])].slice(0, MAX_TERMS),
      fingerprint: sha256(source.slice(heading.startOffset, heading.endOffset).trim()),
    };
  });

  return {
    schemaVersion: MSSR_DOCUMENT_SURFACE_SCHEMA_VERSION,
    revisionScheme: MSSR_DOCUMENT_SURFACE_REVISION_SCHEME,
    sourceRef: args.sourceRef,
    revision: sha256(source),
    title: publicHeadings.find((heading) => heading.level === 1)?.title ?? publicHeadings[0]?.title ?? null,
    lineCount: lines.length,
    charCount: source.length,
    byteCount: Buffer.byteLength(source, "utf8"),
    headingCount: publicHeadings.length,
    blockCount: publicBlocks.length,
    maxHeadingLevel: publicHeadings.reduce((max, heading) => Math.max(max, heading.level), 0),
    headings: publicHeadings,
    blocks: publicBlocks,
    preambleBlockIds: publicBlocks.filter((block) => block.sectionId === null).map((block) => block.id),
  };
}

function validateSurfaceRevision(markdown: string, surface: MssrDocumentSurface): string {
  const source = normalizeMarkdown(markdown);
  const revision = sha256(source);
  if (revision !== surface.revision) {
    throw new Error(`Document surface revision mismatch for ${surface.sourceRef}: expected ${surface.revision}, observed ${revision}.`);
  }
  return source;
}

export function findMssrDocumentSurfaceHeadingBySelector(
  surface: MssrDocumentSurface,
  selector: string,
): MssrDocumentSurfaceHeading | null {
  const target = selector.trim();
  return surface.headings.find((heading) => heading.selector === target) ?? null;
}

export function materializeMssrDocumentSurfaceSection(args: {
  markdown: string;
  surface: MssrDocumentSurface;
  sectionId: string;
}): MssrDocumentSurfaceMaterializedRange {
  const source = validateSurfaceRevision(args.markdown, args.surface);
  const section = args.surface.headings.find((heading) => heading.id === args.sectionId);
  if (!section) throw new Error(`Document surface section not found: ${args.sectionId}`);
  const text = source.slice(section.startOffset, section.endOffset).trimEnd();
  return {
    sourceRef: args.surface.sourceRef,
    revision: args.surface.revision,
    id: section.id,
    startLine: section.startLine,
    endLine: section.endLine,
    startOffset: section.startOffset,
    endOffset: section.endOffset,
    text,
    fingerprint: sha256(text.trim()),
  };
}

export function materializeMssrDocumentSurfaceBlock(args: {
  markdown: string;
  surface: MssrDocumentSurface;
  blockId: string;
}): MssrDocumentSurfaceMaterializedRange {
  const source = validateSurfaceRevision(args.markdown, args.surface);
  const block = args.surface.blocks.find((candidate) => candidate.id === args.blockId);
  if (!block) throw new Error(`Document surface block not found: ${args.blockId}`);
  const text = source.slice(block.startOffset, block.endOffset);
  return {
    sourceRef: args.surface.sourceRef,
    revision: args.surface.revision,
    id: block.id,
    startLine: block.startLine,
    endLine: block.endLine,
    startOffset: block.startOffset,
    endOffset: block.endOffset,
    text,
    fingerprint: sha256(text.trim()),
  };
}
